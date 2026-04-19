import type { BaseMapKind } from '../lib/mapStyle';

export interface ThemeSwatch {
  bg: string;
  accent: string;
  track: string;
}

export interface Theme {
  id: string;
  name: string;
  /** 是否暗色主题（影响 UI 文案颜色策略） */
  mode: 'dark' | 'light';
  cssVars: {
    bg: string;
    panel: string;
    text: string;
    textDim: string;
  };
  map: {
    accent: string; // 点/簇主色
    accentHi: string; // 簇描边 + 数字光晕
    track: string; // 轨迹线
    clusterTextColor: string; // 聚类数字文字色（一般等于 bg）
    unclusteredStroke: string; // 单点描边色
    heatmapRamp: unknown[]; // MapLibre ExpressionSpecification
  };
  basemap: BaseMapKind;
}

/** 按密度分层的通用 ramp 模板 */
function heatRamp(low: string, mid: string, high: string, peak: string): unknown[] {
  return [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0,
    'rgba(0,0,0,0)',
    0.1,
    low,
    0.3,
    mid,
    0.6,
    high,
    1,
    peak,
  ];
}

export const THEMES: Theme[] = [
  {
    id: 'midnight',
    name: '午夜琥珀',
    mode: 'dark',
    cssVars: {
      bg: '#0A0A0F',
      panel: 'rgba(15,15,20,0.72)',
      text: '#F4F4F5',
      textDim: '#71717A',
    },
    map: {
      accent: '#F59E0B',
      accentHi: '#FBBF24',
      track: '#22D3EE',
      clusterTextColor: '#0A0A0F',
      unclusteredStroke: '#FFFFFF',
      heatmapRamp: heatRamp(
        'rgba(34,211,238,0.4)',
        'rgba(245,158,11,0.6)',
        'rgba(239,68,68,0.8)',
        'rgba(255,255,255,0.95)',
      ),
    },
    basemap: 'openfreemap-dark',
  },
  {
    id: 'ocean',
    name: '深海',
    mode: 'dark',
    cssVars: {
      bg: '#05101A',
      panel: 'rgba(8,20,35,0.72)',
      text: '#E0F2FE',
      textDim: '#64748B',
    },
    map: {
      accent: '#38BDF8',
      accentHi: '#7DD3FC',
      track: '#FBBF24',
      clusterTextColor: '#05101A',
      unclusteredStroke: '#FFFFFF',
      heatmapRamp: heatRamp(
        'rgba(56,189,248,0.4)',
        'rgba(250,204,21,0.6)',
        'rgba(248,113,113,0.8)',
        'rgba(255,255,255,0.95)',
      ),
    },
    basemap: 'openfreemap-dark',
  },
  {
    id: 'sunset',
    name: '落日',
    mode: 'dark',
    cssVars: {
      bg: '#1A0B1E',
      panel: 'rgba(30,15,40,0.72)',
      text: '#FDF2F8',
      textDim: '#A78BFA',
    },
    map: {
      accent: '#F472B6',
      accentHi: '#F9A8D4',
      track: '#FB923C',
      clusterTextColor: '#1A0B1E',
      unclusteredStroke: '#FFFFFF',
      heatmapRamp: heatRamp(
        'rgba(244,114,182,0.4)',
        'rgba(251,146,60,0.6)',
        'rgba(250,204,21,0.8)',
        'rgba(255,255,255,0.95)',
      ),
    },
    basemap: 'openfreemap-dark',
  },
  {
    id: 'forest',
    name: '森林',
    mode: 'dark',
    cssVars: {
      bg: '#0B1410',
      panel: 'rgba(15,25,20,0.72)',
      text: '#ECFDF5',
      textDim: '#64748B',
    },
    map: {
      accent: '#34D399',
      accentHi: '#6EE7B7',
      track: '#FBBF24',
      clusterTextColor: '#0B1410',
      unclusteredStroke: '#FFFFFF',
      heatmapRamp: heatRamp(
        'rgba(52,211,153,0.4)',
        'rgba(251,191,36,0.6)',
        'rgba(239,68,68,0.8)',
        'rgba(255,255,255,0.95)',
      ),
    },
    basemap: 'openfreemap-dark',
  },
  {
    id: 'paper',
    name: '轻纸',
    mode: 'light',
    cssVars: {
      bg: '#F5F1EA',
      panel: 'rgba(255,255,255,0.82)',
      text: '#1F2937',
      textDim: '#6B7280',
    },
    map: {
      accent: '#DC2626',
      accentHi: '#F87171',
      track: '#0369A1',
      clusterTextColor: '#FFFFFF',
      unclusteredStroke: '#1F2937',
      heatmapRamp: heatRamp(
        'rgba(3,105,161,0.3)',
        'rgba(220,38,38,0.5)',
        'rgba(251,146,60,0.7)',
        'rgba(17,24,39,0.9)',
      ),
    },
    basemap: 'openfreemap-positron',
  },
  {
    id: 'mono',
    name: '极简黑白',
    mode: 'dark',
    cssVars: {
      bg: '#000000',
      panel: 'rgba(255,255,255,0.08)',
      text: '#FFFFFF',
      textDim: '#A1A1AA',
    },
    map: {
      accent: '#FFFFFF',
      accentHi: '#F4F4F5',
      track: '#A1A1AA',
      clusterTextColor: '#000000',
      unclusteredStroke: '#000000',
      heatmapRamp: heatRamp(
        'rgba(255,255,255,0.3)',
        'rgba(255,255,255,0.5)',
        'rgba(255,255,255,0.75)',
        'rgba(255,255,255,1)',
      ),
    },
    basemap: 'openfreemap-dark',
  },
];

export const DEFAULT_THEME_ID = 'paper';

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function themeSwatch(t: Theme): ThemeSwatch {
  return { bg: t.cssVars.bg, accent: t.map.accent, track: t.map.track };
}
