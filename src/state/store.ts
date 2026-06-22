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
  // 文字叠加层
  title: boolean;
  stats: boolean;
  date: boolean;
  // 地图图层开关（独立于主图的 layers，仅对导出生效）
  showPoints: boolean;
  showTrack: boolean;
  showHeatmap: boolean;
  // 旅行片段导出：启用后只导出日期范围内的点，并临时生成该段轨迹线
  dateRangeEnabled: boolean;
  dateStart: string;
  dateEnd: string;
  // 导出图符号样式。bold/standard 保留当前默认视觉，其他档位给更细或更强的选择。
  pointSize: SharePointSize;
  trackWidth: ShareTrackWidth;
}

export type SharePointSize = 'fine' | 'standard' | 'bold' | 'poster';
export type ShareTrackWidth = 'thin' | 'standard' | 'bold' | 'poster';

export type ShareToggleKey = {
  [K in keyof ShareOptions]: ShareOptions[K] extends boolean ? K : never;
}[keyof ShareOptions];

export type ShareDateRangePatch = Partial<
  Pick<ShareOptions, 'dateRangeEnabled' | 'dateStart' | 'dateEnd'>
>;

export type ShareStylePatch = Partial<Pick<ShareOptions, 'pointSize' | 'trackWidth'>>;

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
  setShareOpt: (key: ShareToggleKey, v: boolean) => void;
  setShareDateRange: (patch: ShareDateRangePatch) => void;
  setShareStyle: (patch: ShareStylePatch) => void;
}

const DEFAULT_SHARE_OPTS: ShareOptions = {
  // 文字默认全开
  title: true,
  stats: true,
  date: true,
  // 图层默认只开轨迹点
  showPoints: true,
  showTrack: false,
  showHeatmap: false,
  dateRangeEnabled: false,
  dateStart: '',
  dateEnd: '',
  pointSize: 'bold',
  trackWidth: 'standard',
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      summary: null,
      places: null,
      yearStart: null,
      yearEnd: null,
      layers: { points: true, heatmap: false, track: false },
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
        set((st) => ({ shareOpts: { ...DEFAULT_SHARE_OPTS, ...st.shareOpts, [key]: v } })),
      setShareDateRange: (patch) =>
        set((st) => ({
          shareOpts: { ...DEFAULT_SHARE_OPTS, ...st.shareOpts, ...patch },
        })),
      setShareStyle: (patch) =>
        set((st) => ({
          shareOpts: { ...DEFAULT_SHARE_OPTS, ...st.shareOpts, ...patch },
        })),
    }),
    {
      name: 'travel-app-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        themeId: s.themeId,
        layers: s.layers,
        shareOpts: s.shareOpts,
      }) as Partial<AppState>,
      merge: (persisted, current) => {
        const saved = persisted as Partial<AppState> | undefined;
        return {
          ...current,
          ...saved,
          layers: { ...current.layers, ...(saved?.layers ?? {}) },
          shareOpts: { ...DEFAULT_SHARE_OPTS, ...(saved?.shareOpts ?? {}) },
        };
      },
      version: 1,
    },
  ),
);
