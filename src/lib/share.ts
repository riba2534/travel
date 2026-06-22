import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl';
import type { PointFC, Summary, TrackFC } from './types';
import type { ShareOptions } from '../state/store';
import type { SharePlaceLabel, ShareRangeStats } from './share-date-range';

const DEFAULT_OUT_W = 1920;
const DEFAULT_OUT_H = 1080;
const BRAND_NAME = 'HPCのJourneys';

// 主图默认 layer id。年度图 layer id 前缀不同，调用方需显式传 layerIds: {}（或自己的 id）
const DEFAULT_LAYER_IDS = {
  pointsGlow: 'points-glow',
  pointsCore: 'points-core',
  track: 'track-line',
  heatmap: 'heatmap',
} as const;

export interface LayerIds {
  pointsGlow?: string;
  pointsCore?: string;
  track?: string;
  heatmap?: string;
}

export interface ExportSize {
  width: number;
  height: number;
}

export interface ExportPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ExportContext {
  /** 指定年份：标题从品牌翻转为 {year} Hero、stats 用 summary.yearStats 对应项 */
  year?: number;
  /** 覆盖 fitBounds 的 bbox（默认用 summary.bbox） */
  bbox?: [number, number, number, number];
  /** 覆盖地图 source 数据。导出后会还原为导出前的数据 */
  sourceData?: {
    points?: PointFC;
    track?: TrackFC;
  };
  /** 全量模式下替代年份范围的小字，例如旅行日期范围 */
  subtitle?: string;
  /** 覆盖左上角统计项，例如一次旅行的 km / days / points */
  stats?: ShareRangeStats[];
  /** 覆盖导出 fitBounds 最大 zoom，日期范围出图需要更细节 */
  maxZoom?: number;
  /** 覆盖导出画布尺寸。日期范围可用竖版或方图减少空白 */
  outputSize?: ExportSize;
  /** 覆盖 fitBounds padding。日期范围用更紧的 padding */
  fitPadding?: ExportPadding;
  /** 分享导出时临时提高底图地名密度，导出后还原 */
  enhancePlaceLabels?: boolean;
  /** 日期范围导出专用：这次旅行经过的城市名，直接绘制到图片上 */
  placeLabels?: SharePlaceLabel[];
  /**
   * 覆盖默认主图 layer id。未传 → 用主图默认（points-glow/points-core/track-line/heatmap）；
   * 传 {} → 跳过所有 layer 切换（如年度图自管 layer）；
   * 字段留空 → 跳过该层。
   */
  layerIds?: LayerIds;
}

export async function exportShare(
  map: MLMap,
  summary: Summary,
  opts: ShareOptions,
  exportCtx?: ExportContext,
): Promise<Blob> {
  const container = map.getContainer();
  const prev = {
    position: container.style.position,
    left: container.style.left,
    top: container.style.top,
    width: container.style.width,
    height: container.style.height,
    zIndex: container.style.zIndex,
  };
  const cam = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
  const outSize = exportCtx?.outputSize ?? { width: DEFAULT_OUT_W, height: DEFAULT_OUT_H };
  const fitPadding = exportCtx?.fitPadding ?? { top: 260, bottom: 140, left: 80, right: 80 };

  // layer id 解析：exportCtx.layerIds 未传用主图默认；传 {} 则全部 undefined，跳过所有切换
  const ids: LayerIds = exportCtx?.layerIds ?? DEFAULT_LAYER_IDS;
  const sourceOverrides = collectSourceOverrides(map, exportCtx);
  const labelBoosts = collectPlaceLabelBoosts(map, exportCtx?.enhancePlaceLabels ?? true);

  // 1. 按 opts 临时覆盖主图图层可见性（仅对导出生效，finally 还原）
  type LayerVisOverride = { layerId: string; want: boolean };
  const visOverrides: LayerVisOverride[] = [];
  if (ids.pointsGlow) visOverrides.push({ layerId: ids.pointsGlow, want: opts.showPoints });
  if (ids.pointsCore) visOverrides.push({ layerId: ids.pointsCore, want: opts.showPoints });
  if (ids.track) visOverrides.push({ layerId: ids.track, want: opts.showTrack });
  if (ids.heatmap) visOverrides.push({ layerId: ids.heatmap, want: opts.showHeatmap });
  const prevVis = new Map<string, unknown>();
  for (const { layerId, want } of visOverrides) {
    if (!map.getLayer(layerId)) continue;
    prevVis.set(layerId, map.getLayoutProperty(layerId, 'visibility'));
    map.setLayoutProperty(layerId, 'visibility', want ? 'visible' : 'none');
  }

  // 2. Boost 轨迹点/线的 paint（相对 1920 画布，原半径太弱）
  interface PaintBoost {
    layerId: string;
    prop: string;
    target: number;
  }
  const boostTargets: PaintBoost[] = [];
  if (ids.pointsGlow) boostTargets.push({ layerId: ids.pointsGlow, prop: 'circle-radius', target: 8 });
  if (ids.pointsCore) boostTargets.push({ layerId: ids.pointsCore, prop: 'circle-radius', target: 2.5 });
  if (ids.track) {
    boostTargets.push({ layerId: ids.track, prop: 'line-width', target: 2 });
    boostTargets.push({ layerId: ids.track, prop: 'line-opacity', target: 0.85 });
  }
  const prevPaint = new Map<string, unknown>();
  for (const { layerId, prop, target } of boostTargets) {
    if (!map.getLayer(layerId)) continue;
    prevPaint.set(`${layerId}:${prop}`, map.getPaintProperty(layerId, prop));
    map.setPaintProperty(layerId, prop, target);
  }
  applyPlaceLabelBoosts(map, labelBoosts);

  try {
    for (const override of sourceOverrides) {
      override.source.setData(override.next);
    }

    // 临时 off-screen 1920×1080
    Object.assign(container.style, {
      position: 'fixed',
      left: '-20000px',
      top: '0px',
      width: `${outSize.width}px`,
      height: `${outSize.height}px`,
      zIndex: '-1',
    } satisfies Partial<CSSStyleDeclaration>);
    map.resize();

    // 3. fitBounds：top 多一些给 hero 区，左右更紧
    const targetBbox = exportCtx?.bbox ?? summary.bbox;
    map.fitBounds(
      [[targetBbox[0], targetBbox[1]], [targetBbox[2], targetBbox[3]]],
      {
        padding: fitPadding,
        animate: false,
        maxZoom: exportCtx?.maxZoom ?? 6,
      },
    );

    // 等待瓦片 + 绘制完成
    await new Promise<void>((resolve) => {
      if (map.loaded() && !map.isMoving() && !map.isZooming()) {
        requestAnimationFrame(() => resolve());
      } else {
        map.once('idle', () => resolve());
      }
    });
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const blob = await renderWithOverlay(map, summary, opts, exportCtx, outSize);
    return blob;
  } finally {
    // 还原 container + camera
    Object.assign(container.style, prev);
    map.resize();
    map.jumpTo(cam);
    // 还原 paint
    for (const { layerId, prop } of boostTargets) {
      const key = `${layerId}:${prop}`;
      if (!prevPaint.has(key)) continue;
      if (!map.getLayer(layerId)) continue;
      map.setPaintProperty(layerId, prop, prevPaint.get(key));
    }
    // 还原 layer visibility
    for (const [layerId, vis] of prevVis) {
      if (!map.getLayer(layerId)) continue;
      if (vis === undefined || vis === null) {
        map.setLayoutProperty(layerId, 'visibility', 'visible');
      } else {
        map.setLayoutProperty(layerId, 'visibility', vis);
      }
    }
    // 还原 source data
    for (const override of sourceOverrides) {
      if (map.getSource(override.id)) {
        override.source.setData(override.prev);
      }
    }
    restorePlaceLabelBoosts(map, labelBoosts);
  }
}

interface PlaceLabelBoost {
  layerId: string;
  minzoom: number;
  maxzoom: number;
  textPadding: unknown;
  targetMinzoom: number;
}

const PLACE_LABEL_TARGETS: Array<{ layerId: string; minzoom: number }> = [
  { layerId: 'label_country_1', minzoom: 0 },
  { layerId: 'label_country_2', minzoom: 0 },
  { layerId: 'label_country_3', minzoom: 0 },
  { layerId: 'label_state', minzoom: 0 },
  { layerId: 'label_city', minzoom: 1.2 },
  { layerId: 'label_city_capital', minzoom: 1.2 },
  { layerId: 'label_town', minzoom: 2.2 },
  { layerId: 'label_village', minzoom: 3.2 },
  { layerId: 'label_other', minzoom: 3.2 },
];

function collectPlaceLabelBoosts(map: MLMap, enabled: boolean): PlaceLabelBoost[] {
  if (!enabled) return [];
  const layers = map.getStyle().layers ?? [];
  const boosts: PlaceLabelBoost[] = [];

  for (const target of PLACE_LABEL_TARGETS) {
    if (!map.getLayer(target.layerId)) continue;
    const layer = layers.find((item) => item.id === target.layerId);
    boosts.push({
      layerId: target.layerId,
      minzoom: layer?.minzoom ?? 0,
      maxzoom: layer?.maxzoom ?? 24,
      textPadding: map.getLayoutProperty(target.layerId, 'text-padding'),
      targetMinzoom: target.minzoom,
    });
  }

  return boosts;
}

function applyPlaceLabelBoosts(map: MLMap, boosts: PlaceLabelBoost[]): void {
  for (const boost of boosts) {
    if (!map.getLayer(boost.layerId)) continue;
    map.setLayerZoomRange(boost.layerId, boost.targetMinzoom, boost.maxzoom);
    map.setLayoutProperty(boost.layerId, 'text-padding', 0.4);
  }
}

function restorePlaceLabelBoosts(map: MLMap, boosts: PlaceLabelBoost[]): void {
  for (const boost of boosts) {
    if (!map.getLayer(boost.layerId)) continue;
    map.setLayerZoomRange(boost.layerId, boost.minzoom, boost.maxzoom);
    map.setLayoutProperty(boost.layerId, 'text-padding', boost.textPadding ?? 2);
  }
}

interface SourceOverride {
  id: 'points' | 'track';
  source: GeoJSONSource;
  prev: string | GeoJSON.GeoJSON;
  next: PointFC | TrackFC;
}

function collectSourceOverrides(
  map: MLMap,
  exportCtx?: ExportContext,
): SourceOverride[] {
  if (!exportCtx?.sourceData) return [];
  const overrides: SourceOverride[] = [];
  const pairs = [
    ['points', exportCtx.sourceData.points],
    ['track', exportCtx.sourceData.track],
  ] as const;

  for (const [id, next] of pairs) {
    if (!next) continue;
    const source = map.getSource(id) as GeoJSONSource | undefined;
    const prev = readGeoJsonSourceData(source);
    if (!source || !prev) continue;
    overrides.push({ id, source, prev, next });
  }
  return overrides;
}

function readGeoJsonSourceData(source: GeoJSONSource | undefined): string | GeoJSON.GeoJSON | null {
  if (!source) return null;
  return ((source as unknown as { _data?: string | GeoJSON.GeoJSON })._data ?? null);
}

interface LabelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function drawPlaceLabels(
  ctx: CanvasRenderingContext2D,
  map: MLMap,
  labels: SharePlaceLabel[],
  scale: number,
  outW: number,
  outH: number,
  px: (n: number) => number,
): void {
  if (labels.length === 0) return;

  const placed: LabelBox[] = [];
  const titleSafeBox: LabelBox = {
    left: 0,
    top: 0,
    right: px(780),
    bottom: px(300),
  };

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${px(22)}px "Avenir Next", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(250, 248, 243, 0.96)';
  ctx.lineWidth = px(7);
  ctx.fillStyle = 'rgba(17, 24, 39, 0.96)';

  const candidates = [...labels]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 24);

  for (const label of candidates) {
    const point = map.project([label.lon, label.lat]);
    const x = point.x * scale;
    const y = point.y * scale;
    if (x < px(28) || x > outW - px(28) || y < px(28) || y > outH - px(28)) continue;

    const width = ctx.measureText(label.name).width + px(30);
    const height = px(38);
    const box: LabelBox = {
      left: x - width / 2,
      right: x + width / 2,
      top: y - height / 2,
      bottom: y + height / 2,
    };
    if (intersects(box, titleSafeBox)) continue;
    if (placed.some((item) => intersects(item, box))) continue;

    ctx.strokeText(label.name, x, y);
    ctx.fillText(label.name, x, y);
    placed.push(box);
  }

  ctx.restore();
}

function intersects(a: LabelBox, b: LabelBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function renderWithOverlay(
  map: MLMap,
  summary: Summary,
  opts: ShareOptions,
  exportCtx?: ExportContext,
  outSize: ExportSize = { width: DEFAULT_OUT_W, height: DEFAULT_OUT_H },
): Promise<Blob> {
  const srcCanvas = map.getCanvas();
  // MapLibre canvas.width = CSS 像素 × DPR；输出保留 Retina 清晰度，但 Safari >16MP 会失败，cap 2×
  const rawScale = Math.max(1, srcCanvas.width / outSize.width);
  const scale = Math.min(rawScale, 2);
  const outW = Math.round(outSize.width * scale);
  const outH = Math.round(outSize.height * scale);

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('2D context not available');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(srcCanvas, 0, 0, outW, outH);

  // 从 CSS 变量读主题色
  const styles = getComputedStyle(document.documentElement);
  const textColor = styles.getPropertyValue('--text').trim() || '#18181B';
  const textDimColor = styles.getPropertyValue('--text-dim').trim() || '#6B7280';
  const accentColor = styles.getPropertyValue('--accent').trim() || '#DC2626';

  // 所有坐标基于 1920 基准，px() 乘以 scale 适配高 DPR
  const px = (n: number) => Math.round(n * scale);
  drawPlaceLabels(ctx, map, exportCtx?.placeLabels ?? [], scale, outW, outH, px);

  const TITLE_X = px(64);
  let cursorY = px(60);

  // 年度模式 stat（用于 stats 构造）
  const yrStat = exportCtx?.year
    ? summary.yearStats?.find((s) => s.year === exportCtx.year)
    : undefined;

  // ========== 标题区 ==========
  if (opts.title) {
    if (exportCtx?.year) {
      // 年度模式 Hero 翻转：大 year + 品牌副线
      ctx.fillStyle = accentColor;
      ctx.font = `800 ${px(124)}px "SFMono-Regular", "Cascadia Mono", ui-monospace, monospace`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(String(exportCtx.year), TITLE_X, cursorY);
      const yearW = ctx.measureText(String(exportCtx.year)).width;
      cursorY += px(130);

      // 3px accent underline
      ctx.fillStyle = accentColor;
      ctx.fillRect(TITLE_X, cursorY, Math.min(yearW, px(320)), px(3));
      cursorY += px(18);

      // 品牌副线
      ctx.fillStyle = textDimColor;
      ctx.font = `500 ${px(16)}px "Avenir Next", "PingFang SC", system-ui, sans-serif`;
      ctx.fillText(`${BRAND_NAME} · YEAR IN REVIEW`, TITLE_X, cursorY);
      cursorY += px(44);
    } else {
      // 全量模式：品牌 72px + underline + 年份范围小字
      ctx.fillStyle = textColor;
      ctx.font = `800 ${px(72)}px "Avenir Next", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      const title = BRAND_NAME;
      ctx.fillText(title, TITLE_X, cursorY);
      const titleW = ctx.measureText(title).width;
      cursorY += px(88);

      ctx.fillStyle = accentColor;
      ctx.fillRect(TITLE_X, cursorY, Math.min(titleW, px(320)), px(3));
      cursorY += px(18);

      if (exportCtx?.subtitle) {
        ctx.fillStyle = textDimColor;
        ctx.font = `500 ${px(14)}px "SFMono-Regular", "Cascadia Mono", ui-monospace, monospace`;
        ctx.fillText(exportCtx.subtitle, TITLE_X, cursorY);
        cursorY += px(44);
      } else if (summary.years.length) {
        ctx.fillStyle = textDimColor;
        ctx.font = `500 ${px(14)}px "SFMono-Regular", "Cascadia Mono", ui-monospace, monospace`;
        const yrRange = `${summary.years[0]} — ${summary.years[summary.years.length - 1]}`;
        ctx.fillText(yrRange, TITLE_X, cursorY);
        cursorY += px(44);
      } else {
        cursorY += px(28);
      }
    }
  } else {
    cursorY = px(56);
  }

  // ========== Stats 单行：数字 + 右侧内联 label ==========
  if (opts.stats) {
    const stats: Array<{ num: string; label: string }> = exportCtx?.stats ?? (yrStat
      ? [
          { num: yrStat.km.toLocaleString(), label: 'KM' },
          { num: String(yrStat.citiesTotal), label: 'CITIES' },
          { num: yrStat.points.toLocaleString(), label: 'POINTS' },
        ]
      : [
          { num: summary.kmTraveled.toLocaleString(), label: 'KM' },
          { num: String(summary.citiesTotal), label: 'CITIES' },
          { num: summary.totalPoints.toLocaleString(), label: 'POINTS' },
        ]);

    const numFont = `800 ${px(48)}px "Avenir Next", "PingFang SC", system-ui, sans-serif`;
    const labelFont = `500 ${px(16)}px "SFMono-Regular", "Cascadia Mono", ui-monospace, monospace`;
    const labelGap = px(8); // 数字与 label 之间的间距
    const colGap = px(40); // 列与列之间的间距

    // 预测量每列宽度（数字 + gap + label）
    ctx.font = numFont;
    const numWidths = stats.map((s) => ctx.measureText(s.num).width);
    ctx.font = labelFont;
    const labelWidths = stats.map((s) => ctx.measureText(s.label).width);

    // 用 alphabetic 基线让数字和 label 底部对齐
    const baseline = cursorY + px(48);

    let x = TITLE_X;
    for (let i = 0; i < stats.length; i++) {
      // 数字
      ctx.fillStyle = textColor;
      ctx.font = numFont;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillText(stats[i].num, x, baseline);

      // Label：紧贴数字右侧，基线对齐
      ctx.fillStyle = textDimColor;
      ctx.font = labelFont;
      ctx.fillText(stats[i].label, x + numWidths[i] + labelGap, baseline);

      x += numWidths[i] + labelGap + labelWidths[i] + colGap;
    }
  }

  // ========== 右下：品牌签名 + 日期 ==========
  if (opts.date) {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;

    // 品牌签名（上一行）
    ctx.fillStyle = textDimColor;
    ctx.font = `500 ${px(12)}px "Avenir Next", "PingFang SC", system-ui, sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    ctx.fillText(BRAND_NAME, outW - px(48), outH - px(50));

    // 日期（下一行，更弱）
    ctx.globalAlpha = 0.7;
    ctx.font = `400 ${px(11)}px "SFMono-Regular", "Cascadia Mono", ui-monospace, monospace`;
    ctx.fillText(dateStr, outW - px(48), outH - px(32));
    ctx.globalAlpha = 1;
  }

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png', 1.0);
  });
}

export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });
  // 优先 Web Share API（移动端体验好）
  type NavigatorShare = Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  const nav = navigator as NavigatorShare;
  if (nav.canShare?.({ files: [file] }) && typeof nav.share === 'function') {
    try {
      await nav.share({ files: [file], title: BRAND_NAME });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
      console.warn('navigator.share 失败，走下载 fallback', e);
    }
  }
  // 触发下载
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
