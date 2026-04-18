// OpenFreeMap dark vector tiles - 完全免费、无 key、无限速、支持多语言标签
// 在运行时把所有 symbol layer 的 text-field 替换为 name:zh-Hans / name:zh / name 优先级
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

/** 返回中文优先的 text-field 表达式（zh-Hans → zh → 拼音 → 本地名） */
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

/** 兜底降级 style：CartoDB DarkMatter raster（标签是本地语言，不理想但稳） */
export const fallbackDarkMatterStyle: StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}@2x.png',
        'https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0A0A0F' } },
    { id: 'carto', type: 'raster', source: 'carto-dark' },
  ],
};
