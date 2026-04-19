import type { Map as MLMap } from 'maplibre-gl';
import type { Summary } from './types';
import type { ShareOptions } from '../state/store';

const OUT_W = 1920;
const OUT_H = 1080;

export async function exportShare(
  map: MLMap,
  summary: Summary,
  opts: ShareOptions,
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

  try {
    // 临时 off-screen 1920×1080
    Object.assign(container.style, {
      position: 'fixed',
      left: '-20000px',
      top: '0px',
      width: `${OUT_W}px`,
      height: `${OUT_H}px`,
      zIndex: '-1',
    } satisfies Partial<CSSStyleDeclaration>);
    map.resize();

    map.fitBounds(
      [[summary.bbox[0], summary.bbox[1]], [summary.bbox[2], summary.bbox[3]]],
      {
        padding: { top: 120, bottom: 120, left: 100, right: 100 },
        animate: false,
        maxZoom: 5,
      },
    );

    // 等待瓦片加载完成
    await new Promise<void>((resolve) => {
      if (map.loaded() && !map.isMoving() && !map.isZooming()) {
        // 还要再等一帧让绘制完成
        requestAnimationFrame(() => resolve());
      } else {
        const done = () => resolve();
        map.once('idle', done);
      }
    });
    // 多等一帧保险
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const blob = await renderWithOverlay(map, summary, opts);
    return blob;
  } finally {
    Object.assign(container.style, prev);
    map.resize();
    map.jumpTo(cam);
  }
}

async function renderWithOverlay(
  map: MLMap,
  summary: Summary,
  opts: ShareOptions,
): Promise<Blob> {
  const srcCanvas = map.getCanvas();
  const out = document.createElement('canvas');
  out.width = OUT_W;
  out.height = OUT_H;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('2D context not available');

  // drawImage 会按源尺寸拷贝，srcCanvas 已是 1920×1080
  ctx.drawImage(srcCanvas, 0, 0, OUT_W, OUT_H);

  // 从 CSS 变量读取主题色
  const styles = getComputedStyle(document.documentElement);
  const textColor = styles.getPropertyValue('--text').trim() || '#F4F4F5';
  const textDimColor = styles.getPropertyValue('--text-dim').trim() || '#71717A';
  const accentColor = styles.getPropertyValue('--accent').trim() || '#F59E0B';

  // 左上：标题
  if (opts.title) {
    ctx.fillStyle = textColor;
    ctx.font = '600 56px Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('我的足迹', 60, 56);
  }

  // 标题下方：统计
  if (opts.stats) {
    const parts: string[] = [];
    parts.push(`${summary.kmTraveled.toLocaleString()} km`);
    parts.push(`${summary.countries.length} 国`);
    parts.push(`${summary.totalPoints.toLocaleString()} 点`);
    if (summary.years.length) {
      parts.push(`${summary.years[0]}–${summary.years[summary.years.length - 1]}`);
    }
    ctx.fillStyle = accentColor;
    ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const yOffset = opts.title ? 132 : 60;
    ctx.fillText(parts.join('  ·  '), 60, yOffset);
  }

  // 右下：日期
  if (opts.date) {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    ctx.fillStyle = textDimColor;
    ctx.font = '400 22px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, OUT_W - 60, OUT_H - 36);
  }

  // 左下：域名/作者水印
  if (opts.watermark) {
    ctx.fillStyle = textDimColor;
    ctx.font = '400 20px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    const domain = getDomain();
    ctx.fillText(domain, 60, OUT_H - 36);
  }

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png', 0.95);
  });
}

function getDomain(): string {
  if (typeof window === 'undefined') return 'my-footprint';
  const host = window.location.hostname;
  if (!host || host === 'localhost' || host.startsWith('127.') || host.startsWith('192.168.')) {
    return 'my-footprint';
  }
  return host;
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
      await nav.share({ files: [file], title: '我的足迹' });
      return;
    } catch (e) {
      // 用户取消或不支持，继续走下载 fallback
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
  // 延后释放 url
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
