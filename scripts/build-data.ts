// GPX → points.geojson + track.geojson + summary.json
// 一次性构建脚本，用 tsx 跑：npm run build:data
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import simplify from 'simplify-js';
import length from '@turf/length';
import { lineString } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { feature as topoFeature } from 'topojson-client';
import { createRequire } from 'node:module';
import { knownCities } from './known-cities.js';

const require = createRequire(import.meta.url);
const countries110 = require('world-atlas/countries-50m.json');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'raw/track.gpx');
const OUT = path.join(ROOT, 'public/data');

if (!fs.existsSync(RAW)) {
  console.error(`✗ raw/track.gpx not found. Copy GPX into ${RAW}`);
  process.exit(1);
}

console.log('→ reading GPX...');
const gpx = fs.readFileSync(RAW, 'utf8');

// ---------- 1. 流式正则解析（比 xmldom 快 10x）----------
type Pt = { lat: number; lon: number; t: number; ele: number };
const pts: Pt[] = [];
const re = /<trkpt lat="([\d.\-]+)" lon="([\d.\-]+)">\s*<ele>([\d.\-]+)<\/ele>\s*<time>([^<]+)<\/time>/g;
let m: RegExpExecArray | null;
while ((m = re.exec(gpx)) !== null) {
  pts.push({
    lat: +(+m[1]).toFixed(5),
    lon: +(+m[2]).toFixed(5),
    ele: +(+m[3]).toFixed(1),
    t: Math.floor(new Date(m[4]).getTime() / 1000),
  });
}
console.log(`  parsed ${pts.length.toLocaleString()} points`);

// ---------- 2. points.geojson ----------
const pointsFC = {
  type: 'FeatureCollection' as const,
  features: pts.map((p) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
    properties: { t: p.t, ele: p.ele },
  })),
};

// ---------- 3. track.geojson（按 30min 间隔切段 + 简化）----------
const GAP = 30 * 60; // 30 min
const segments: Pt[][] = [];
let cur: Pt[] = [];
for (let i = 0; i < pts.length; i++) {
  if (cur.length === 0 || pts[i].t - cur[cur.length - 1].t <= GAP) {
    cur.push(pts[i]);
  } else {
    if (cur.length >= 2) segments.push(cur);
    cur = [pts[i]];
  }
}
if (cur.length >= 2) segments.push(cur);

const TOL = 0.0001; // ~11m
const lines: number[][][] = [];
let totalSimplifiedPts = 0;
for (const seg of segments) {
  const sim = simplify(
    seg.map((p) => ({ x: p.lon, y: p.lat })),
    TOL,
    true,
  );
  if (sim.length >= 2) {
    lines.push(sim.map((p) => [p.x, p.y]));
    totalSimplifiedPts += sim.length;
  }
}
console.log(`  segments: ${segments.length}, simplified verts: ${totalSimplifiedPts.toLocaleString()}`);

const trackFC = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      geometry: { type: 'MultiLineString' as const, coordinates: lines },
      properties: {},
    },
  ],
};

// ---------- 4. summary.json ----------
// 4.1 bbox / years / perYear
let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
const perYear: Record<string, number> = {};
for (const p of pts) {
  if (p.lat < minLat) minLat = p.lat;
  if (p.lat > maxLat) maxLat = p.lat;
  if (p.lon < minLon) minLon = p.lon;
  if (p.lon > maxLon) maxLon = p.lon;
  const y = String(new Date(p.t * 1000).getUTCFullYear());
  perYear[y] = (perYear[y] ?? 0) + 1;
}
const years = Object.keys(perYear).map(Number).sort((a, b) => a - b);

// 4.2 总公里数（按 segments 算）
let kmTraveled = 0;
for (const line of lines) {
  if (line.length >= 2) {
    kmTraveled += length(lineString(line), { units: 'kilometers' });
  }
}
kmTraveled = Math.round(kmTraveled);

// 4.3 国家识别
console.log('→ detecting countries...');
const countriesFC = topoFeature(countries110, countries110.objects.countries) as unknown as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon, { name: string }>;
const countrySet = new Set<string>();
for (let i = 0; i < pts.length; i += 50) {
  const p = pts[i];
  for (const f of countriesFC.features) {
    if (booleanPointInPolygon([p.lon, p.lat], f)) {
      if (f.properties?.name) countrySet.add(f.properties.name);
      break;
    }
  }
}
const countries = [...countrySet].sort();
console.log(`  countries: ${countries.length} (${countries.slice(0, 8).join(', ')}...)`);

// 4.4 Top cities（0.5° 网格 + 已知城市最近邻）
const grid = new Map<string, { lat: number; lon: number; count: number }>();
const STEP = 0.5;
for (const p of pts) {
  const gx = Math.round(p.lon / STEP) * STEP;
  const gy = Math.round(p.lat / STEP) * STEP;
  const key = `${gx},${gy}`;
  const e = grid.get(key);
  if (e) { e.count++; e.lat += p.lat; e.lon += p.lon; }
  else grid.set(key, { lat: p.lat, lon: p.lon, count: 1 });
}
type City = { name: string; lat: number; lon: number; count: number };
const cells: City[] = [];
for (const [, v] of grid) {
  if (v.count < 200) continue;
  const cellLat = v.lat / v.count;
  const cellLon = v.lon / v.count;
  // 找最近已知城市（< 0.8°）
  let best: { name: string; d: number } | null = null;
  for (const c of knownCities) {
    const d = Math.hypot(c.lat - cellLat, c.lon - cellLon);
    if (d < 0.8 && (!best || d < best.d)) best = { name: c.name, d };
  }
  cells.push({
    name: best?.name ?? `${cellLat.toFixed(2)}, ${cellLon.toFixed(2)}`,
    lat: +cellLat.toFixed(4),
    lon: +cellLon.toFixed(4),
    count: v.count,
  });
}
// 按 count 排序，去重同名（保留最大）
const cityMap = new Map<string, City>();
for (const c of cells.sort((a, b) => b.count - a.count)) {
  const ex = cityMap.get(c.name);
  if (!ex) cityMap.set(c.name, c);
  else ex.count += c.count;
}
const topCities = [...cityMap.values()].sort((a, b) => b.count - a.count).slice(0, 12);
console.log(`  top cities: ${topCities.slice(0, 5).map((c) => `${c.name}(${c.count})`).join(', ')}`);

// 4.5 写文件
const summary = {
  totalPoints: pts.length,
  segments: segments.length,
  years,
  perYear,
  countries,
  kmTraveled,
  bbox: [
    +minLon.toFixed(4),
    +minLat.toFixed(4),
    +maxLon.toFixed(4),
    +maxLat.toFixed(4),
  ],
  topCities,
  generatedAt: new Date().toISOString(),
};

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(path.join(OUT, 'points.geojson'), JSON.stringify(pointsFC));
fs.writeFileSync(path.join(OUT, 'track.geojson'), JSON.stringify(trackFC));
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

const sz = (p: string) => (fs.statSync(p).size / 1024).toFixed(1) + ' KB';
console.log(`\n✓ wrote:`);
console.log(`  points.geojson  ${sz(path.join(OUT, 'points.geojson'))}`);
console.log(`  track.geojson   ${sz(path.join(OUT, 'track.geojson'))}`);
console.log(`  summary.json    ${sz(path.join(OUT, 'summary.json'))}`);
