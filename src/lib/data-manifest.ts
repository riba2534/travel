export interface DataManifest {
  version: string;
  generatedAt: string;
  publishedAt?: string;
  files: {
    summary: string;
    places: string;
    points: string;
    track: string;
  };
  stats?: {
    totalPoints: number;
    segments: number;
    years: number[];
    countries: number;
    kmTraveled: number;
    citiesTotal: number;
    bbox: [number, number, number, number];
  };
}

export interface DataUrls {
  summary: string;
  places: string;
  points: string;
  track: string;
}

export const DEFAULT_DATA_MANIFEST_URL = 'https://data.travel.riba2534.cn/manifest.json';

export function dataManifestUrl(): string {
  if (import.meta.env.VITE_TRAVEL_DATA_MANIFEST_URL) {
    return import.meta.env.VITE_TRAVEL_DATA_MANIFEST_URL;
  }
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return DEFAULT_DATA_MANIFEST_URL;
  }
  return '/data/manifest.json';
}

export function resolveDataUrls(manifest: DataManifest, manifestUrl: string): DataUrls {
  const base = new URL(manifestUrl, window.location.href);
  return {
    summary: new URL(manifest.files.summary, base).toString(),
    places: new URL(manifest.files.places, base).toString(),
    points: new URL(manifest.files.points, base).toString(),
    track: new URL(manifest.files.track, base).toString(),
  };
}
