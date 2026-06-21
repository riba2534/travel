import type { Places, PointFC, TrackFC } from './types';

export interface ShareRangeStats {
  num: string;
  label: string;
}

export interface SharePlaceLabel {
  name: string;
  lon: number;
  lat: number;
  weight: number;
}

export interface ShareDateRangeExport {
  label: string;
  filenamePrefix: string;
  points: PointFC;
  track: TrackFC;
  bbox: [number, number, number, number];
  stats: ShareRangeStats[];
  outputSize: { width: number; height: number };
  fitPadding: { top: number; bottom: number; left: number; right: number };
  maxZoom: number;
  placeLabels: SharePlaceLabel[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildShareDateRangeExport(
  pointsData: PointFC,
  startInput: string | undefined,
  endInput: string | undefined,
  places?: Places | null,
): ShareDateRangeExport {
  const startDate = parseDateInput(startInput);
  const endDate = parseDateInput(endInput);
  if (!startDate || !endDate) {
    throw new Error('请先在设置 > 分享图里选择开始和结束日期');
  }
  if (startDate.getTime() > endDate.getTime()) {
    throw new Error('分享图的开始日期不能晚于结束日期');
  }

  const startSec = Math.floor(startDate.getTime() / 1000);
  const endExclusiveSec = Math.floor((endDate.getTime() + DAY_MS) / 1000);
  const features = pointsData.features
    .filter((feature) => {
      const t = feature.properties.t;
      return t >= startSec && t < endExclusiveSec;
    })
    .sort((a, b) => a.properties.t - b.properties.t);

  if (features.length === 0) {
    throw new Error('这个日期范围内没有足迹点，换一个时间段再生成');
  }

  const coordinates = features.map((feature) => feature.geometry.coordinates);
  const bbox = paddedBbox(coordinates);
  const framing = frameForBbox(bbox);
  const placeLabels = collectPlaceLabels(features, places);
  const km = routeKilometers(coordinates);
  const days = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
  const label = dateRangeLabel(startDate, endDate);

  return {
    label,
    filenamePrefix: `footprint-${formatFilenameDate(startDate)}-${formatFilenameDate(endDate)}`,
    points: {
      type: 'FeatureCollection',
      features,
    },
    track: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'MultiLineString',
            coordinates: coordinates.length > 1 ? [coordinates] : [],
          },
          properties: {},
        },
      ],
    },
    bbox,
    ...framing,
    placeLabels,
    stats: [
      { num: formatKm(km), label: 'KM' },
      { num: String(days), label: days === 1 ? 'DAY' : 'DAYS' },
      { num: features.length.toLocaleString(), label: 'POINTS' },
    ],
  };
}

function collectPlaceLabels(
  features: PointFC['features'],
  places: Places | null | undefined,
): SharePlaceLabel[] {
  if (!places) return [];
  const cities = places.continents.flatMap((continent) =>
    continent.countries.flatMap((country) =>
      country.cities.map((city) => ({
        name: city.name,
        lon: city.lon,
        lat: city.lat,
      })),
    ),
  );
  if (cities.length === 0) return [];

  const hits = new Map<string, SharePlaceLabel>();
  for (const feature of features) {
    const [lon, lat] = feature.geometry.coordinates;
    const nearest = nearestCity(lon, lat, cities);
    if (!nearest) continue;
    const prev = hits.get(nearest.name);
    if (prev) {
      prev.weight += 1;
    } else {
      hits.set(nearest.name, { ...nearest, weight: 1 });
    }
  }

  return [...hits.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 28);
}

function nearestCity(
  lon: number,
  lat: number,
  cities: Array<{ name: string; lon: number; lat: number }>,
): { name: string; lon: number; lat: number } | null {
  let best: { name: string; lon: number; lat: number; d2: number } | null = null;
  for (const city of cities) {
    const dx = (lon - city.lon) * Math.cos(toRad(lat));
    const dy = lat - city.lat;
    const d2 = dx * dx + dy * dy;
    if (d2 > 0.55 * 0.55) continue;
    if (!best || d2 < best.d2) best = { ...city, d2 };
  }
  return best ? { name: best.name, lon: best.lon, lat: best.lat } : null;
}

function parseDateInput(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function dateRangeLabel(start: Date, end: Date): string {
  const a = formatDisplayDate(start);
  const b = formatDisplayDate(end);
  return a === b ? a : `${a} - ${b}`;
}

function formatDisplayDate(date: Date): string {
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function formatFilenameDate(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function paddedBbox(coords: number[][]): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }

  const lonSpan = Math.max(maxLon - minLon, 0);
  const latSpan = Math.max(maxLat - minLat, 0);
  const lonPad = Math.max(lonSpan * 0.08, 0.015);
  const latPad = Math.max(latSpan * 0.08, 0.015);

  return [
    clampLon(minLon - lonPad),
    clampLat(minLat - latPad),
    clampLon(maxLon + lonPad),
    clampLat(maxLat + latPad),
  ];
}

function frameForBbox(bbox: [number, number, number, number]): {
  outputSize: { width: number; height: number };
  fitPadding: { top: number; bottom: number; left: number; right: number };
  maxZoom: number;
} {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const midLat = (minLat + maxLat) / 2;
  const widthKm = Math.max(1, haversineKm([minLon, midLat], [maxLon, midLat]));
  const heightKm = Math.max(1, haversineKm([minLon, minLat], [minLon, maxLat]));
  const aspect = widthKm / heightKm;

  if (aspect < 0.92) {
    return {
      outputSize: { width: 1080, height: 1350 },
      fitPadding: { top: 280, bottom: 84, left: 42, right: 42 },
      maxZoom: 12,
    };
  }

  if (aspect < 1.35) {
    return {
      outputSize: { width: 1400, height: 1400 },
      fitPadding: { top: 250, bottom: 84, left: 56, right: 56 },
      maxZoom: 12,
    };
  }

  return {
    outputSize: { width: 1920, height: 1080 },
    fitPadding: { top: 190, bottom: 84, left: 56, right: 56 },
    maxZoom: 11,
  };
}

function clampLon(value: number): number {
  return Math.max(-180, Math.min(180, value));
}

function clampLat(value: number): number {
  return Math.max(-85, Math.min(85, value));
}

function routeKilometers(coords: number[][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm(coords[i - 1], coords[i]);
  }
  return total;
}

function haversineKm(a: number[], b: number[]): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h =
    s1 * s1 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function formatKm(km: number): string {
  return km.toLocaleString(undefined, {
    maximumFractionDigits: km < 100 ? 1 : 0,
  });
}
