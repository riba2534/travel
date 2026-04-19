import type {
  Map as MLMap,
  StyleSpecification,
  Popup,
  LayerSpecification,
  SourceSpecification,
} from 'maplibre-gl';
import type { Theme } from './themes';
import type { PointFC, TrackFC } from '../lib/types';

export interface LayerState {
  points: boolean;
  heatmap: boolean;
  track: boolean;
}

const vis = (v: boolean): 'visible' | 'none' => (v ? 'visible' : 'none');

/** 生成自定义 source 定义（points / track）。points 不聚类，全量渲染发光亮点。 */
export function customSources(
  pointsData: PointFC,
  trackData: TrackFC,
): Record<string, SourceSpecification> {
  return {
    track: { type: 'geojson', data: trackData },
    points: { type: 'geojson', data: pointsData },
  };
}

/** 生成按当前主题着色的自定义 layer 列表。
 * points 不聚类，用双层 circle 实现"密密麻麻亮亮的发光亮点"：
 *   - points-glow：大半径 + 高模糊 + 低不透明度（叠加形成亮斑）
 *   - points-core：小半径 + 低模糊 + 高不透明度（每个点的清晰核心）
 */
export function customLayers(theme: Theme, layers: LayerState): LayerSpecification[] {
  return [
    {
      id: 'track-line',
      type: 'line',
      source: 'track',
      layout: { 'line-join': 'round', 'line-cap': 'round', visibility: vis(layers.track) },
      paint: {
        'line-color': theme.map.track,
        'line-opacity': 0.5,
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 6, 0.8, 12, 2, 16, 3.5],
        'line-blur': 0.5,
      },
    },
    {
      id: 'heatmap',
      type: 'heatmap',
      source: 'points',
      maxzoom: 14,
      layout: { visibility: vis(layers.heatmap) },
      paint: {
        'heatmap-weight': 0.6,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 9, 2.5],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'heatmap-color': theme.map.heatmapRamp as any,
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 9, 30],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 11, 1, 14, 0],
      },
    },
    {
      id: 'points-glow',
      type: 'circle',
      source: 'points',
      layout: { visibility: vis(layers.points) },
      paint: {
        'circle-color': theme.map.accent,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.35, 4, 0.5, 10, 0.6, 16, 0.7],
        'circle-blur': 0.9,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 4, 4, 10, 8, 14, 14, 18, 22],
      },
    },
    {
      id: 'points-core',
      type: 'circle',
      source: 'points',
      layout: { visibility: vis(layers.points) },
      paint: {
        'circle-color': theme.map.accentHi,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 4, 0.95, 16, 1],
        'circle-blur': 0.2,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 4, 1.2, 10, 2.2, 14, 3.5, 18, 5],
        'circle-stroke-color': theme.map.unclusteredStroke,
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 14, 0.6],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0, 14, 0.6],
      },
    },
  ];
}

/** 把自定义 source/layer 合并到底图 style，返回一个完整新 style。
 * 用法：setStyle 前先拿到一个"自包含"的新 style，setStyle 一次完成不用等异步事件。
 */
export function mergeWithCustom(
  baseStyle: StyleSpecification,
  theme: Theme,
  layers: LayerState,
  pointsData: PointFC,
  trackData: TrackFC,
): StyleSpecification {
  const sources: Record<string, SourceSpecification> = {
    ...(baseStyle.sources ?? {}),
    ...customSources(pointsData, trackData),
  };
  const baseLayers = baseStyle.layers ?? [];
  const extras = customLayers(theme, layers);
  return { ...baseStyle, sources, layers: [...baseLayers, ...extras] };
}

/** 把主题 CSS vars 应用到 <html>，并更新 meta[theme-color]。 */
export function applyThemeCssVars(theme: Theme): void {
  const r = document.documentElement.style;
  r.setProperty('--bg', theme.cssVars.bg);
  r.setProperty('--panel', theme.cssVars.panel);
  r.setProperty('--text', theme.cssVars.text);
  r.setProperty('--text-dim', theme.cssVars.textDim);
  r.setProperty('--accent', theme.map.accent);
  r.setProperty('--track', theme.map.track);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.cssVars.bg);
}

/** 同 basemap 族切换：只改 CSS vars + paint，无闪烁 */
export function applyThemePaintInPlace(map: MLMap, theme: Theme): void {
  applyThemeCssVars(theme);
  if (!map.getLayer('heatmap')) return;
  map.setPaintProperty('track-line', 'line-color', theme.map.track);
  map.setPaintProperty('points-glow', 'circle-color', theme.map.accent);
  map.setPaintProperty('points-core', 'circle-color', theme.map.accentHi);
  map.setPaintProperty('points-core', 'circle-stroke-color', theme.map.unclusteredStroke);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map.setPaintProperty('heatmap', 'heatmap-color', theme.map.heatmapRamp as any);
}

// Popup ref 类型（Map.tsx 公用）
export type PopupRef = { current: Popup | null };
