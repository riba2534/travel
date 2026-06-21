import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const FILES = {
  summary: 'summary.json',
  places: 'places.json',
  points: 'points.geojson',
  track: 'track.geojson',
} as const;

type FileKey = keyof typeof FILES;

interface Summary {
  totalPoints: number;
  segments: number;
  years: number[];
  countries: string[];
  kmTraveled: number;
  bbox: [number, number, number, number];
  citiesTotal: number;
  generatedAt: string;
}

interface UploadTarget {
  bucket: string;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function argValue(name: string): string | undefined {
  const flag = `--${name}`;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag) return argv[i + 1];
    if (argv[i].startsWith(`${flag}=`)) return argv[i].slice(flag.length + 1);
  }
  return undefined;
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function amzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function contentType(file: string): string {
  if (file.endsWith('.geojson')) return 'application/geo+json; charset=utf-8';
  return 'application/json; charset=utf-8';
}

function cacheControl(key: string): string {
  return key === 'manifest.json'
    ? 'public, max-age=60, must-revalidate'
    : 'public, max-age=31536000, immutable';
}

async function putObject(target: UploadTarget, key: string, body: Buffer, type: string): Promise<void> {
  const now = new Date();
  const date = yyyymmdd(now);
  const timestamp = amzDate(now);
  const host = `${target.accountId}.r2.cloudflarestorage.com`;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const pathname = `/${target.bucket}/${encodedKey}`;
  const payloadHash = sha256Hex(body);

  const headers: Record<string, string> = {
    'cache-control': cacheControl(key),
    'content-type': type,
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': timestamp,
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((h) => `${h}:${headers[h].trim()}\n`)
    .join('');
  const canonicalRequest = [
    'PUT',
    pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${date}/auto/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const kDate = hmac(`AWS4${target.secretAccessKey}`, date);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${target.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}${pathname}`, {
    method: 'PUT',
    headers: { ...headers, authorization },
    body: body as unknown as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`R2 PUT ${key} failed: HTTP ${res.status} ${await res.text()}`);
  }
}

async function main(): Promise<void> {
  const dir = path.resolve(argValue('dir') ?? 'dist-data/current');
  const summaryPath = path.join(dir, FILES.summary);
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as Summary;
  const version = argValue('version') ?? summary.generatedAt.slice(0, 10);
  const prefix = argValue('prefix') ?? 'snapshots';
  const bucket = argValue('bucket') ?? process.env.R2_BUCKET ?? 'travel-data';

  const target: UploadTarget = {
    bucket,
    accountId: required('CF_ACCOUNT_ID', process.env.CF_ACCOUNT_ID),
    accessKeyId: required('R2_ACCESS_KEY_ID/R2_ACCESS_KEY', process.env.R2_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY/R2_SECRET_KEY', process.env.R2_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_KEY),
  };

  const fileMeta: Record<FileKey, { key: string; bytes: number; sha256: string }> = {} as Record<
    FileKey,
    { key: string; bytes: number; sha256: string }
  >;

  for (const [name, file] of Object.entries(FILES) as Array<[FileKey, string]>) {
    const body = fs.readFileSync(path.join(dir, file));
    const key = `${prefix}/${version}/${file}`;
    await putObject(target, key, body, contentType(file));
    fileMeta[name] = { key, bytes: body.length, sha256: sha256Hex(body) };
    console.log(`uploaded ${key} (${(body.length / 1024 / 1024).toFixed(2)} MiB)`);
  }

  const manifest = {
    version,
    generatedAt: summary.generatedAt,
    publishedAt: new Date().toISOString(),
    files: {
      summary: fileMeta.summary.key,
      places: fileMeta.places.key,
      points: fileMeta.points.key,
      track: fileMeta.track.key,
    },
    stats: {
      totalPoints: summary.totalPoints,
      segments: summary.segments,
      years: summary.years,
      countries: summary.countries.length,
      kmTraveled: summary.kmTraveled,
      citiesTotal: summary.citiesTotal,
      bbox: summary.bbox,
    },
    objects: fileMeta,
  };

  const manifestBody = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await putObject(target, 'manifest.json', manifestBody, 'application/json; charset=utf-8');
  console.log(`published manifest.json -> ${bucket}/${version}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
