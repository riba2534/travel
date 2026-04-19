// 单点信息富化：把裸 GeoJSON feature 变成 popup 可直接显示的结构化数据。
import type { Places } from './types';

export interface PopupInfo {
  /** 自然语言日期："2025-04-15 周二 下午" */
  dateLabel: string;
  /** 地名："土耳其 · 卡帕多奇亚" 或 "中国" 或 ""（未匹配） */
  placeLabel: string;
  /** 精度友好的坐标："34.89°E · 38.65°N" */
  coordLabel: string;
  /** 海拔标签："↑ 1,067 m"，若无海拔则 "" */
  eleLabel: string;
  /** 当天在此国的聚合："当天 42 点 · 途径 3 城" 或 ""（只有 1 个点） */
  sameDayLabel: string;
}

interface RawPoint {
  t: number;
  ele?: number;
  lon: number;
  lat: number;
}

interface AllPointsLike {
  features: Array<{
    geometry: { coordinates: number[] };
    properties: { t: number };
  }>;
}

const SEC_PER_DAY = 86400;

function formatLocalDate(t: number): string {
  const d = new Date(t * 1000);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const hour = d.getHours();
  const period =
    hour < 5 ? '凌晨' :
    hour < 9 ? '早上' :
    hour < 12 ? '上午' :
    hour < 14 ? '中午' :
    hour < 18 ? '下午' :
    hour < 22 ? '晚上' : '深夜';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day} ${weekdays[d.getDay()]} ${period}`;
}

function formatCoord(lon: number, lat: number): string {
  const lonStr = `${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`;
  const latStr = `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}`;
  return `${lonStr} · ${latStr}`;
}

/** 给定坐标，返回 "国家 · 最近城市" 或 "国家" 或 ""。最近城市半径 0.8°（约 90km）。 */
export function lookupPlace(lon: number, lat: number, places: Places | null): string {
  if (!places) return '';
  // 1. 先从所有 bbox 命中的国家里挑"距中心最近"的那个
  let best: { name: string; cities: PlaceCities; d2: number } | null = null;
  for (const cont of places.continents) {
    for (const co of cont.countries) {
      const [minLon, minLat, maxLon, maxLat] = co.bbox;
      if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
      const cx = (minLon + maxLon) / 2;
      const cy = (minLat + maxLat) / 2;
      const d2 = (lon - cx) ** 2 + (lat - cy) ** 2;
      if (!best || d2 < best.d2) best = { name: co.name, cities: co.cities, d2 };
    }
  }
  if (!best) return '';
  // 2. 在选定国家的 cities 里找最近的
  const city = nearestCity(lon, lat, best.cities, 0.8);
  return city ? `${best.name} · ${city}` : best.name;
}

type PlaceCities = Array<{ name: string; lat: number; lon: number }>;

function nearestCity(
  lon: number,
  lat: number,
  cities: Array<{ name: string; lat: number; lon: number }>,
  maxDeg: number,
): string | null {
  let best: { name: string; d: number } | null = null;
  const max2 = maxDeg * maxDeg;
  for (const c of cities) {
    const d = (lon - c.lon) ** 2 + (lat - c.lat) ** 2;
    if (d > max2) continue;
    if (!best || d < best.d) best = { name: c.name, d };
  }
  return best?.name ?? null;
}

/** 统计"当天"在附近（同一国家 bbox 内）的点数和路过的城市数。
 * "当天"以用户本地时区的 0-24 点为准；附近用 country bbox 宽松匹配。 */
export function sameDaySummary(
  point: RawPoint,
  places: Places | null,
  allPoints: AllPointsLike | null,
): { pointCount: number; cityCount: number } {
  if (!allPoints) return { pointCount: 1, cityCount: 0 };

  // 本地时区的 0 点（用日期字符串）
  const d = new Date(point.t * 1000);
  const startLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).getTime() / 1000;
  const endLocal = startLocal + SEC_PER_DAY;

  // 找点所在国家 bbox（用于空间预筛）
  let countryBBox: [number, number, number, number] | null = null;
  let cities: Array<{ name: string; lat: number; lon: number }> = [];
  if (places) {
    for (const cont of places.continents) {
      for (const co of cont.countries) {
        const [minLon, minLat, maxLon, maxLat] = co.bbox;
        if (point.lon < minLon || point.lon > maxLon || point.lat < minLat || point.lat > maxLat) continue;
        countryBBox = co.bbox;
        cities = co.cities;
        break;
      }
      if (countryBBox) break;
    }
  }

  let pointCount = 0;
  const visited = new Set<string>();
  for (const f of allPoints.features) {
    const t = f.properties.t;
    if (t < startLocal || t >= endLocal) continue;
    const [lon, lat] = f.geometry.coordinates;
    if (countryBBox) {
      if (lon < countryBBox[0] || lon > countryBBox[2] || lat < countryBBox[1] || lat > countryBBox[3]) continue;
    }
    pointCount++;
    const city = nearestCity(lon, lat, cities, 0.5);
    if (city) visited.add(city);
  }

  return { pointCount, cityCount: visited.size };
}

export function enrichPoint(
  point: RawPoint,
  places: Places | null,
  allPoints: AllPointsLike | null,
): PopupInfo {
  const dateLabel = formatLocalDate(point.t);
  const placeLabel = lookupPlace(point.lon, point.lat, places);
  const coordLabel = formatCoord(point.lon, point.lat);
  const eleLabel =
    point.ele !== undefined && point.ele !== 0
      ? `↑ ${Math.round(point.ele).toLocaleString()} m`
      : '';
  const sd = sameDaySummary(point, places, allPoints);
  const sameDayLabel =
    sd.pointCount > 1
      ? sd.cityCount > 0
        ? `当天 ${sd.pointCount.toLocaleString()} 点 · 途径 ${sd.cityCount} 城`
        : `当天 ${sd.pointCount.toLocaleString()} 点`
      : '';

  return { dateLabel, placeLabel, coordLabel, eleLabel, sameDayLabel };
}

/** 构造 popup HTML（用 CSS 变量保持主题感） */
export function renderPopupHtml(info: PopupInfo): string {
  const secondary = info.placeLabel
    ? `<div style="color:var(--accent);font-size:12px;font-weight:500;margin-bottom:10px">${escapeHtml(info.placeLabel)}</div>`
    : '';
  const sameDay = info.sameDayLabel
    ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(127,127,127,0.18);color:var(--text-dim);font-size:11px">${escapeHtml(info.sameDayLabel)}</div>`
    : '';
  const eleSuffix = info.eleLabel ? ` · <span style="color:var(--text)">${escapeHtml(info.eleLabel)}</span>` : '';
  return `
    <div style="font-family:Inter,'PingFang SC',system-ui,sans-serif;line-height:1.45;min-width:180px;max-width:260px">
      <div style="color:var(--text);font-size:13px;font-weight:600;margin-bottom:4px">${escapeHtml(info.dateLabel)}</div>
      ${secondary}
      <div style="color:var(--text-dim);font-size:11px;font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums">
        ${escapeHtml(info.coordLabel)}${eleSuffix}
      </div>
      ${sameDay}
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] as string));
}
