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
import { knownCities as manualCities } from './known-cities.js';
import { COUNTRY_META, CONTINENT_NAMES, getCountryMeta } from './country-meta.js';

// 可选：Nominatim 反查生成的自动城市名。可能不存在（首次构建时）。
type KnownCity = { name: string; lat: number; lon: number };
let autoCities: KnownCity[] = [];
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  autoCities = (await import('./known-cities-auto.js')).autoCities as KnownCity[];
} catch {
  // 文件不存在：跳过。跑 `npx tsx scripts/fetch-city-names.ts` 可生成。
}
const knownCities: KnownCity[] = [...manualCities, ...autoCities];

const require = createRequire(import.meta.url);
const countries110 = require('world-atlas/countries-10m.json');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW_GPX = path.join(ROOT, 'raw/track.gpx');
const RAW_CSV = path.join(ROOT, 'raw/photos.csv');
const OUT = path.join(ROOT, 'public/data');

type Pt = { lat: number; lon: number; t: number; ele: number };
const pts: Pt[] = [];

// ---------- 1a. GPX（主轨迹）----------
if (fs.existsSync(RAW_GPX)) {
  console.log('→ reading GPX...');
  const gpx = fs.readFileSync(RAW_GPX, 'utf8');
  const re = /<trkpt lat="([\d.\-]+)" lon="([\d.\-]+)">\s*<ele>([\d.\-]+)<\/ele>\s*<time>([^<]+)<\/time>/g;
  let m: RegExpExecArray | null;
  let gpxCount = 0;
  while ((m = re.exec(gpx)) !== null) {
    pts.push({
      lat: +(+m[1]).toFixed(5),
      lon: +(+m[2]).toFixed(5),
      ele: +(+m[3]).toFixed(1),
      t: Math.floor(new Date(m[4]).getTime() / 1000),
    });
    gpxCount++;
  }
  console.log(`  parsed ${gpxCount.toLocaleString()} GPX points`);
} else {
  console.warn(`  ⚠ ${RAW_GPX} not found, skipping`);
}

// ---------- 1b. 照片定位 CSV ----------
// 表头：dataTime,locType,longitude,latitude,heading,accuracy,speed,distance,isBackForeground,stepType,altitude
if (fs.existsSync(RAW_CSV)) {
  console.log('→ reading photo CSV...');
  const csv = fs.readFileSync(RAW_CSV, 'utf8');
  const lines = csv.split(/\r?\n/);
  let csvCount = 0, skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(',');
    if (cols.length < 11) { skipped++; continue; }
    const t = +cols[0];
    const lon = +cols[2];
    const lat = +cols[3];
    const ele = +cols[10];
    // 基本 sanity
    if (!Number.isFinite(t) || !Number.isFinite(lon) || !Number.isFinite(lat)) { skipped++; continue; }
    if (lon === 0 && lat === 0) { skipped++; continue; }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) { skipped++; continue; }
    pts.push({
      lat: +lat.toFixed(5),
      lon: +lon.toFixed(5),
      ele: Number.isFinite(ele) ? +ele.toFixed(1) : 0,
      t,
    });
    csvCount++;
  }
  console.log(`  parsed ${csvCount.toLocaleString()} CSV points (skipped ${skipped})`);
}

// ---------- 1c. 合并 + 排序 + 去重（相邻 1s 内 & 0.0001° 内视为同一点）----------
pts.sort((a, b) => a.t - b.t);
const dedup: Pt[] = [];
const EPS = 0.0001;
for (const p of pts) {
  const prev = dedup[dedup.length - 1];
  if (
    prev &&
    Math.abs(p.t - prev.t) <= 1 &&
    Math.abs(p.lat - prev.lat) < EPS &&
    Math.abs(p.lon - prev.lon) < EPS
  ) {
    continue;
  }
  dedup.push(p);
}
const removed = pts.length - dedup.length;
pts.length = 0;
for (const p of dedup) pts.push(p);
console.log(`  merged total: ${pts.length.toLocaleString()} (dedup removed ${removed.toLocaleString()})`);

if (pts.length === 0) {
  console.error('✗ no points parsed. Put raw/track.gpx or raw/photos.csv');
  process.exit(1);
}

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

// 4.3 国家识别（全量扫 + 网格去重 + bbox 预筛）
console.log('→ detecting countries...');
const countriesFC = topoFeature(countries110, countries110.objects.countries) as unknown as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon, { name: string }>;

// 4.3.1 预计算 country bbox
const countryBBox = new Map<string, [number, number, number, number]>();
for (const f of countriesFC.features) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (coords: number[][]) => {
    for (const c of coords) {
      if (c[0] < minX) minX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] > maxY) maxY = c[1];
    }
  };
  const geom = f.geometry;
  if (geom.type === 'Polygon') geom.coordinates.forEach((ring) => visit(ring as number[][]));
  else geom.coordinates.forEach((poly) => poly.forEach((ring) => visit(ring as number[][])));
  countryBBox.set(f.properties.name, [minX, minY, maxX, maxY]);
}

// 4.3.2 0.1° × 0.1° 网格去重坐标
const CELL = 0.1;
const cellPoint = new Map<string, Pt>();
for (const p of pts) {
  const k = `${Math.round(p.lon / CELL)},${Math.round(p.lat / CELL)}`;
  if (!cellPoint.has(k)) cellPoint.set(k, p);
}
console.log(`  unique cells: ${cellPoint.size.toLocaleString()}`);

// 4.3.3 每个 cell 做 bbox-predicated PIP
const cellCountry = new Map<string, string>();
for (const [k, p] of cellPoint) {
  for (const f of countriesFC.features) {
    const bb = countryBBox.get(f.properties.name)!;
    if (p.lon < bb[0] || p.lon > bb[2] || p.lat < bb[1] || p.lat > bb[3]) continue;
    if (booleanPointInPolygon([p.lon, p.lat], f)) {
      cellCountry.set(k, f.properties.name);
      break;
    }
  }
}

// 4.3.4 原始点 → 国家（通过 cell 反查）
const countryPointCount = new Map<string, number>();
for (const p of pts) {
  const k = `${Math.round(p.lon / CELL)},${Math.round(p.lat / CELL)}`;
  const c = cellCountry.get(k);
  if (c) countryPointCount.set(c, (countryPointCount.get(c) ?? 0) + 1);
}
// summary.countries 按 ISO 去重（港澳台统一算中国），这样 Header 统计符合"国家和地区"语义
const _isoSet = new Set<string>();
const countries: string[] = [];
for (const engName of [...countryPointCount.keys()].sort()) {
  const meta = getCountryMeta(engName);
  if (_isoSet.has(meta.iso)) continue;
  _isoSet.add(meta.iso);
  countries.push(meta.zh || engName);
}
console.log(`  countries & regions: ${countries.length} (${countries.slice(0, 12).join(', ')}${countries.length > 12 ? '...' : ''})`);

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
const unnamed: { lat: number; lon: number; count: number }[] = [];
// 阈值 30：让点数较少的国家（印尼/韩国/美国）的城市也能浮现；太低会把飞行中的单格误认为城市
const CITY_MIN_POINTS = 30;
for (const [, v] of grid) {
  if (v.count < CITY_MIN_POINTS) continue;
  const cellLat = v.lat / v.count;
  const cellLon = v.lon / v.count;
  // 过滤海上点（飞机航线聚合成的网格不应被当作城市）
  let onLand = false;
  for (const f of countriesFC.features) {
    const bb = countryBBox.get(f.properties.name)!;
    if (cellLon < bb[0] || cellLon > bb[2] || cellLat < bb[1] || cellLat > bb[3]) continue;
    if (booleanPointInPolygon([cellLon, cellLat], f)) { onLand = true; break; }
  }
  if (!onLand) continue;
  // 找最近已知城市（< 0.8°）
  let best: { name: string; d: number } | null = null;
  for (const c of knownCities) {
    const d = Math.hypot(c.lat - cellLat, c.lon - cellLon);
    if (d < 0.8 && (!best || d < best.d)) best = { name: c.name, d };
  }
  if (!best) unnamed.push({ lat: +cellLat.toFixed(4), lon: +cellLon.toFixed(4), count: v.count });
  cells.push({
    name: best?.name ?? `${cellLat.toFixed(2)}, ${cellLon.toFixed(2)}`,
    lat: +cellLat.toFixed(4),
    lon: +cellLon.toFixed(4),
    count: v.count,
  });
}
if (unnamed.length) {
  console.log(`  ⚠ ${unnamed.length} grids without known-city match (add to scripts/known-cities.ts):`);
  for (const u of unnamed.sort((a, b) => b.count - a.count)) {
    console.log(`      { lat: ${u.lat}, lon: ${u.lon} },  // ${u.count} points`);
  }
}
// 按 count 排序，去重同名（保留最大）
const cityMap = new Map<string, City>();
for (const c of cells.sort((a, b) => b.count - a.count)) {
  const ex = cityMap.get(c.name);
  if (!ex) cityMap.set(c.name, c);
  else ex.count += c.count;
}
const allCities = [...cityMap.values()].sort((a, b) => b.count - a.count);
const topCities = allCities.slice(0, 12);
console.log(`  top cities: ${topCities.slice(0, 5).map((c) => `${c.name}(${c.count})`).join(', ')}`);

// 4.5 places.json（大洲 → 国家 → 城市 层级）
console.log('→ building places.json...');

// city → country（bbox 预筛 PIP）
function cityCountry(lat: number, lon: number): string | null {
  for (const f of countriesFC.features) {
    const bb = countryBBox.get(f.properties.name)!;
    if (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3]) continue;
    if (booleanPointInPolygon([lon, lat], f)) return f.properties.name;
  }
  return null;
}

// 按国家聚合城市（保留全部 allCities，展示上限由前端决定）
const citiesByCountry = new Map<string, City[]>();
for (const c of allCities) {
  const cname = cityCountry(c.lat, c.lon);
  if (!cname) continue;
  if (!citiesByCountry.has(cname)) citiesByCountry.set(cname, []);
  citiesByCountry.get(cname)!.push(c);
}

// 先按 ISO 聚合（港澳台映射到 CN 会合并）
type CountryOut = {
  code: string; name: string; nameEn: string;
  bbox: [number, number, number, number];
  count: number;
  cities: City[];
  continent: string;
};
const countryByIso = new Map<string, CountryOut>();
const unknownCountries: string[] = [];
for (const [engName, cnt] of countryPointCount) {
  const meta = getCountryMeta(engName);
  if (!COUNTRY_META[engName]) unknownCountries.push(engName);
  const bbox = countryBBox.get(engName)!;
  const cities = citiesByCountry.get(engName) ?? [];
  const exist = countryByIso.get(meta.iso);
  if (exist) {
    exist.count += cnt;
    exist.cities.push(...cities);
    // 合并 bbox
    exist.bbox = [
      Math.min(exist.bbox[0], bbox[0]),
      Math.min(exist.bbox[1], bbox[1]),
      Math.max(exist.bbox[2], bbox[2]),
      Math.max(exist.bbox[3], bbox[3]),
    ];
  } else {
    countryByIso.set(meta.iso, {
      code: meta.iso,
      name: meta.zh,
      nameEn: engName,
      bbox,
      count: cnt,
      cities: [...cities],
      continent: meta.continent,
    });
  }
}

// 再按大洲聚合
interface PlaceContinentOut {
  code: string; name: string; nameEn: string;
  count: number;
  countries: { code: string; name: string; nameEn: string; bbox: [number, number, number, number]; count: number; cities: City[] }[];
}
const continentMap = new Map<string, PlaceContinentOut>();
for (const co of countryByIso.values()) {
  const contInfo = CONTINENT_NAMES[co.continent] ?? CONTINENT_NAMES.XX;
  if (!continentMap.has(co.continent)) {
    continentMap.set(co.continent, { code: co.continent, name: contInfo.name, nameEn: contInfo.nameEn, count: 0, countries: [] });
  }
  const cont = continentMap.get(co.continent)!;
  cont.count += co.count;
  // 城市：按 count 降序；同名城市 count 累加（港/澳 的城市可能和大陆同名这里没有，但做安全合并）
  const cityMap = new Map<string, City>();
  for (const c of co.cities) {
    const ex = cityMap.get(c.name);
    if (ex) ex.count += c.count;
    else cityMap.set(c.name, { ...c });
  }
  cont.countries.push({
    code: co.code,
    name: co.name,
    nameEn: co.nameEn,
    bbox: co.bbox,
    count: co.count,
    cities: [...cityMap.values()].sort((a, b) => b.count - a.count),
  });
}

const places = {
  version: 1,
  generatedAt: new Date().toISOString(),
  continents: [...continentMap.values()]
    .map((c) => ({ ...c, countries: c.countries.sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.count - a.count),
};

if (unknownCountries.length > 0) {
  console.log(`  ⚠ no meta for ${unknownCountries.length} countries: ${unknownCountries.join(', ')}`);
}
console.log(`  continents: ${places.continents.length}, total countries: ${places.continents.reduce((s, c) => s + c.countries.length, 0)}`);

// 4.6 yearStats：年度 Wrapped 的素材
console.log('→ building yearStats...');
type YearStat = {
  year: number;
  points: number;
  km: number;
  countries: string[];
  citiesTotal: number;
  topCities: { name: string; lat: number; lon: number; count: number }[];
  farthestDay: { date: string; km: number } | null;
};
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const yearStats: YearStat[] = years.map((yr) => {
  const yearPts = pts.filter((p) => new Date(p.t * 1000).getUTCFullYear() === yr);
  // 连续点累计里程（与 track 相同的 30min 切段规则）
  let kmYear = 0;
  for (let i = 1; i < yearPts.length; i++) {
    const prev = yearPts[i - 1];
    const cur = yearPts[i];
    if (cur.t - prev.t > GAP) continue;
    kmYear += haversineKm(prev.lat, prev.lon, cur.lat, cur.lon);
  }
  // 年内 unique 国家（复用 cellCountry + ISO 去重）
  const yearIsoSet = new Set<string>();
  for (const p of yearPts) {
    const k = `${Math.round(p.lon / CELL)},${Math.round(p.lat / CELL)}`;
    const eng = cellCountry.get(k);
    if (!eng) continue;
    const meta = getCountryMeta(eng);
    yearIsoSet.add(meta.zh || eng);
  }
  // 年内 TOP 5 城市（0.5° 网格 + 最近 knownCity，阈值 10 更灵活）
  const yearGrid = new Map<string, { lat: number; lon: number; count: number }>();
  for (const p of yearPts) {
    const gx = Math.round(p.lon / STEP) * STEP;
    const gy = Math.round(p.lat / STEP) * STEP;
    const key = `${gx},${gy}`;
    const e = yearGrid.get(key);
    if (e) { e.count++; e.lat += p.lat; e.lon += p.lon; }
    else yearGrid.set(key, { lat: p.lat, lon: p.lon, count: 1 });
  }
  type YC = { name: string; lat: number; lon: number; count: number };
  const yearCities: YC[] = [];
  for (const [, v] of yearGrid) {
    if (v.count < 10) continue;
    const cellLat = v.lat / v.count;
    const cellLon = v.lon / v.count;
    // 海上过滤
    let onLand = false;
    for (const f of countriesFC.features) {
      const bb = countryBBox.get(f.properties.name)!;
      if (cellLon < bb[0] || cellLon > bb[2] || cellLat < bb[1] || cellLat > bb[3]) continue;
      if (booleanPointInPolygon([cellLon, cellLat], f)) { onLand = true; break; }
    }
    if (!onLand) continue;
    let best: { name: string; d: number } | null = null;
    for (const c of knownCities) {
      const d = Math.hypot(c.lat - cellLat, c.lon - cellLon);
      if (d < 0.8 && (!best || d < best.d)) best = { name: c.name, d };
    }
    yearCities.push({
      name: best?.name ?? `${cellLat.toFixed(2)}, ${cellLon.toFixed(2)}`,
      lat: +cellLat.toFixed(4),
      lon: +cellLon.toFixed(4),
      count: v.count,
    });
  }
  // 同名合并 + TOP 5
  const yearCityMap = new Map<string, YC>();
  for (const c of yearCities.sort((a, b) => b.count - a.count)) {
    const ex = yearCityMap.get(c.name);
    if (!ex) yearCityMap.set(c.name, c);
    else ex.count += c.count;
  }
  // 当年全量城市（按 count 降序），前端在 WrappedStory 里完整展示
  const topCitiesYear = [...yearCityMap.values()].sort((a, b) => b.count - a.count);

  // 最远一天：按 UTC 日切分，取当天连续行走累计里程最长的一天（口径同年度 km，30min 断线）
  const byDay = new Map<string, typeof yearPts>();
  for (const p of yearPts) {
    const d = new Date(p.t * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(p);
  }
  let farthestDay: { date: string; km: number } | null = null;
  for (const [day, dayPts] of byDay) {
    if (dayPts.length < 2) continue;
    let kmDay = 0;
    for (let i = 1; i < dayPts.length; i++) {
      const prev = dayPts[i - 1];
      const cur = dayPts[i];
      if (cur.t - prev.t > GAP) continue;
      kmDay += haversineKm(prev.lat, prev.lon, cur.lat, cur.lon);
    }
    if (kmDay <= 0) continue;
    if (!farthestDay || kmDay > farthestDay.km) farthestDay = { date: day, km: Math.round(kmDay) };
  }

  return {
    year: yr,
    points: yearPts.length,
    km: Math.round(kmYear),
    countries: [...yearIsoSet].sort(),
    citiesTotal: yearCityMap.size,
    topCities: topCitiesYear,
    farthestDay,
  };
});
console.log(`  yearStats: ${yearStats.length} years`);

// 4.7 写文件
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
  citiesTotal: allCities.length,
  topCities,
  yearStats,
  generatedAt: new Date().toISOString(),
};

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(path.join(OUT, 'points.geojson'), JSON.stringify(pointsFC));
fs.writeFileSync(path.join(OUT, 'track.geojson'), JSON.stringify(trackFC));
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(OUT, 'places.json'), JSON.stringify(places, null, 2));

const sz = (p: string) => (fs.statSync(p).size / 1024).toFixed(1) + ' KB';
console.log(`\n✓ wrote:`);
console.log(`  points.geojson  ${sz(path.join(OUT, 'points.geojson'))}`);
console.log(`  track.geojson   ${sz(path.join(OUT, 'track.geojson'))}`);
console.log(`  summary.json    ${sz(path.join(OUT, 'summary.json'))}`);
console.log(`  places.json     ${sz(path.join(OUT, 'places.json'))}`);
