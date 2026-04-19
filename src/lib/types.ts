export type Mode = 'points' | 'heatmap';

// 地图数据的 GeoJSON 形状（build-data 产出 + 运行时消费）
export type PointFC = GeoJSON.FeatureCollection<GeoJSON.Point, { t: number; ele?: number }>;
export type TrackFC = GeoJSON.FeatureCollection<GeoJSON.MultiLineString, Record<string, never>>;

export interface City {
  name: string;
  lat: number;
  lon: number;
  count: number;
}

export interface YearStat {
  year: number;
  points: number;
  km: number;
  countries: string[];
  /** 当年去重后的城市总数 */
  citiesTotal: number;
  /** 当年去过的全部城市，按 count 降序（WrappedStory 完整渲染） */
  topCities: City[];
  farthestDay: { date: string; km: number } | null;
}

export interface Summary {
  totalPoints: number;
  segments: number;
  years: number[];
  perYear: Record<string, number>;
  countries: string[];
  kmTraveled: number;
  bbox: [number, number, number, number];
  /** 全量去重后的城市总数（不是 topCities.length） */
  citiesTotal: number;
  topCities: City[];
  yearStats?: YearStat[];
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
