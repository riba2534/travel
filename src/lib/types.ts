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
