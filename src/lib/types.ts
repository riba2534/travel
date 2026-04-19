export type Mode = 'points' | 'heatmap';

export interface City {
  name: string;
  lat: number;
  lon: number;
  count: number;
}

export interface Summary {
  totalPoints: number;
  segments: number;
  years: number[];
  perYear: Record<string, number>;
  countries: string[];
  kmTraveled: number;
  bbox: [number, number, number, number];
  topCities: City[];
  generatedAt: string;
}

// 层级地点数据（places.json）
export interface PlaceCity {
  name: string;
  lat: number;
  lon: number;
  count: number;
}

export interface PlaceCountry {
  code: string; // ISO alpha-2，或 'XX' 表示未映射
  name: string; // 中文名（或 fallback 英文名）
  nameEn: string;
  bbox: [number, number, number, number];
  count: number;
  cities: PlaceCity[];
}

export interface PlaceContinent {
  code: string;
  name: string;
  nameEn: string;
  count: number;
  countries: PlaceCountry[];
}

export interface Places {
  version: number;
  generatedAt: string;
  continents: PlaceContinent[];
}
