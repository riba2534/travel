import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Summary, Places } from '../lib/types';
import { DEFAULT_THEME_ID } from './themes';

export interface LayerVisibility {
  points: boolean;
  heatmap: boolean;
  track: boolean;
}

export interface Filter {
  countryCode?: string; // ISO alpha-2
  cityName?: string;
}

export interface FlyTarget {
  lat?: number;
  lon?: number;
  zoom?: number;
  bbox?: [number, number, number, number];
  /** 同一 target 多次派发时用来强制触发订阅者 */
  nonce: number;
}

export interface ShareOptions {
  title: boolean;
  stats: boolean;
  date: boolean;
}

interface AppState {
  summary: Summary | null;
  places: Places | null;
  yearStart: number | null;
  yearEnd: number | null;
  layers: LayerVisibility;
  filter: Filter;
  themeId: string;
  uiHidden: boolean;
  exporting: boolean;
  flyTarget: FlyTarget | null;
  shareOpts: ShareOptions;

  setSummary: (s: Summary) => void;
  setPlaces: (p: Places) => void;
  setYearRange: (s: number, e: number) => void;
  toggleLayer: (key: keyof LayerVisibility) => void;
  setLayer: (key: keyof LayerVisibility, v: boolean) => void;
  setFilter: (f: Filter) => void;
  clearFilter: () => void;
  setTheme: (id: string) => void;
  setUiHidden: (v: boolean) => void;
  setExporting: (v: boolean) => void;
  flyTo: (t: Omit<FlyTarget, 'nonce'>) => void;
  setShareOpt: (key: keyof ShareOptions, v: boolean) => void;
}

const DEFAULT_SHARE_OPTS: ShareOptions = {
  title: true,
  stats: true,
  date: true,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      summary: null,
      places: null,
      yearStart: null,
      yearEnd: null,
      layers: { points: true, heatmap: false, track: true },
      filter: {},
      themeId: DEFAULT_THEME_ID,
      uiHidden: false,
      exporting: false,
      flyTarget: null,
      shareOpts: DEFAULT_SHARE_OPTS,

      setSummary: (s) =>
        set({
          summary: s,
          yearStart: s.years[0] ?? null,
          yearEnd: s.years[s.years.length - 1] ?? null,
        }),
      setPlaces: (p) => set({ places: p }),
      setYearRange: (s, e) => set({ yearStart: s, yearEnd: e }),
      toggleLayer: (k) =>
        set((st) => ({ layers: { ...st.layers, [k]: !st.layers[k] } })),
      setLayer: (k, v) => set((st) => ({ layers: { ...st.layers, [k]: v } })),
      setFilter: (f) => set({ filter: f }),
      clearFilter: () => set({ filter: {} }),
      setTheme: (id) => set({ themeId: id }),
      setUiHidden: (v) => set({ uiHidden: v }),
      setExporting: (v) => set({ exporting: v }),
      flyTo: (t) => set({ flyTarget: { ...t, nonce: Date.now() } }),
      setShareOpt: (key, v) =>
        set((st) => ({ shareOpts: { ...st.shareOpts, [key]: v } })),
    }),
    {
      name: 'travel-app-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        themeId: s.themeId,
        layers: s.layers,
        shareOpts: s.shareOpts,
      }) as Partial<AppState>,
      version: 1,
    },
  ),
);
