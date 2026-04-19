// 多底图支持 + 中文化 + 兜底 style
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

export type BaseMapKind =
  | 'openfreemap-dark'
  | 'openfreemap-liberty'
  | 'carto-dark'
  | 'carto-voyager';

export const DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

// 兼容旧 import
export const STYLE_URL = DEFAULT_STYLE_URL;

const BASE_MAP_URLS: Partial<Record<BaseMapKind, string>> = {
  'openfreemap-dark': 'https://tiles.openfreemap.org/styles/dark',
  'openfreemap-liberty': 'https://tiles.openfreemap.org/styles/liberty',
};

export function isVectorBasemap(kind: BaseMapKind): boolean {
  return kind in BASE_MAP_URLS;
}

export function basemapStyleUrl(kind: BaseMapKind): string | null {
  return BASE_MAP_URLS[kind] ?? null;
}

/** 返回中文优先的 text-field 表达式 */
function chineseTextField() {
  return [
    'coalesce',
    ['get', 'name:zh-Hans'],
    ['get', 'name:zh'],
    ['get', 'name:zh-Hant'],
    ['get', 'name:en'],
    ['get', 'name'],
  ];
}

/** 把已加载的 style 中所有 symbol layer 的 text-field 改成中文优先 */
export function patchStyleForChinese(style: StyleSpecification): StyleSpecification {
  const layers: LayerSpecification[] = (style.layers || []).map((layer) => {
    if (layer.type !== 'symbol' || !layer.layout) return layer;
    const layout = layer.layout as { 'text-field'?: unknown };
    if (layout['text-field'] === undefined) return layer;
    return {
      ...layer,
      layout: {
        ...layout,
        'text-field': chineseTextField() as never,
      },
    } as LayerSpecification;
  });

  return {
    ...style,
    layers,
    sprite: style.sprite,
    glyphs: style.glyphs,
  };
}

/** Carto raster 兜底 style 工厂 */
export function makeCartoRasterStyle(kind: 'dark' | 'voyager', bgColor: string): StyleSpecification {
  const baseUrl = kind === 'dark' ? 'dark_all' : 'voyager';
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'carto-raster': {
        type: 'raster',
        tiles: [
          `https://basemaps.cartocdn.com/${baseUrl}/{z}/{x}/{y}@2x.png`,
          `https://cartodb-basemaps-a.global.ssl.fastly.net/${baseUrl}/{z}/{x}/{y}@2x.png`,
          `https://cartodb-basemaps-b.global.ssl.fastly.net/${baseUrl}/{z}/{x}/{y}@2x.png`,
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
        maxzoom: 19,
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': bgColor } },
      { id: 'carto', type: 'raster', source: 'carto-raster' },
    ],
  };
}

/** 兜底：OpenFreeMap 失败时用 Carto Dark */
export const fallbackDarkMatterStyle = makeCartoRasterStyle('dark', '#0A0A0F');

/** 按主题底图类型加载 style（异步，需要联网） */
export async function loadStyleForBasemap(
  kind: BaseMapKind,
  bgColor: string,
): Promise<StyleSpecification> {
  const url = basemapStyleUrl(kind);
  if (url) {
    try {
      const r = await fetch(url, { mode: 'cors' });
      if (!r.ok) throw new Error(`style ${r.status}`);
      const raw = (await r.json()) as StyleSpecification;
      return patchStyleForChinese(raw);
    } catch (e) {
      console.warn(`[map] ${kind} 加载失败，降级到 carto:`, e);
    }
  }
  // raster 系列 + 失败降级
  if (kind === 'carto-voyager') return makeCartoRasterStyle('voyager', bgColor);
  return makeCartoRasterStyle('dark', bgColor);
}
