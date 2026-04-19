import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore, type ShareOptions } from '../state/store';
import { exportShare } from '../lib/share';

const OPTIONS: { key: keyof ShareOptions; label: string; hint: string }[] = [
  { key: 'title', label: '标题「HPCのJourneys」', hint: '左上角大标题' },
  { key: 'stats', label: '关键统计', hint: 'km / 国家地区数 / 点数 / 年份' },
  { key: 'date', label: '生成日期', hint: '右下角小字' },
  { key: 'watermark', label: '域名水印', hint: '左下角小字' },
];

function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export default function ShareExporter() {
  const summary = useAppStore((s) => s.summary);
  const shareOpts = useAppStore((s) => s.shareOpts);
  const setShareOpt = useAppStore((s) => s.setShareOpt);
  const setExporting = useAppStore((s) => s.setExporting);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  // 清理 object URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onExport = async () => {
    const map = (window as unknown as { __map?: import('maplibre-gl').Map }).__map;
    if (!map || !summary) {
      setMsg('地图尚未就绪，请稍后再试');
      return;
    }
    setBusy(true);
    setExporting(true);
    setMsg('正在生成（包含全部足迹点）…');
    try {
      const blob = await exportShare(map, summary, shareOpts);
      blobRef.current = blob;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setMsg('');
    } catch (e) {
      console.error(e);
      setMsg('生成失败：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
      setExporting(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
  };

  const onDownload = () => {
    if (!blobRef.current || !previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `footprint-${Date.now()}.png`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const onShare = async () => {
    if (!blobRef.current) return;
    type NavigatorShare = Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string }) => Promise<void>;
    };
    const nav = navigator as NavigatorShare;
    const file = new File([blobRef.current], `footprint-${Date.now()}.png`, { type: 'image/png' });
    if (nav.canShare?.({ files: [file] }) && typeof nav.share === 'function') {
      try {
        await nav.share({ files: [file], title: 'HPCのJourneys' });
      } catch (e) {
        if ((e as DOMException)?.name !== 'AbortError') console.warn(e);
      }
    }
  };

  const isMobile = detectMobile();
  const canShare =
    typeof navigator !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (navigator as any).share === 'function';

  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-[11px] text-text-dim leading-relaxed">
          生成 1920×1080 横图，包含全部足迹点。下方可选要叠加的文字。
        </p>

        <div className="flex flex-col gap-1.5">
          {OPTIONS.map(({ key, label, hint }) => (
            <label
              key={key}
              className="flex items-start gap-2 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-white/[0.04]"
            >
              <input
                type="checkbox"
                checked={shareOpts[key]}
                onChange={(e) => setShareOpt(key, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent accent-accent"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-text">{label}</div>
                <div className="text-[10px] text-text-dim">{hint}</div>
              </div>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={busy || !summary}
          className="w-full rounded-lg bg-accent px-3 py-2 text-xs font-medium text-bg transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-110"
        >
          {busy ? '生成中…' : '生成分享图'}
        </button>

        {msg && (
          <div className="text-[11px] text-text-dim leading-relaxed" aria-live="polite">
            {msg}
          </div>
        )}
      </div>

      {previewUrl && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="分享图预览"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/85 p-3 sm:p-5"
          onClick={closePreview}
        >
          {/* 关闭按钮（右上角） */}
          <button
            type="button"
            onClick={closePreview}
            aria-label="关闭预览"
            className="absolute right-3 top-3 sm:right-5 sm:top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur transition-colors"
          >
            ✕
          </button>

          {/* 图片容器（阻止冒泡，点击图片不会关闭） */}
          <div
            className="relative flex max-h-[85vh] max-w-[96vw] items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewUrl}
              alt="HPCのJourneys"
              // iOS Safari 需要确认图片来源为可保存 blob URL
              className="max-h-[85vh] max-w-full rounded-lg shadow-2xl"
              style={{ objectFit: 'contain', WebkitTouchCallout: 'default' }}
              draggable
            />
          </div>

          {/* 提示 + 操作按钮 */}
          <div
            className="flex w-full max-w-[560px] flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 text-center text-xs text-white/85 leading-relaxed">
              {isMobile ? (
                <>
                  <span className="font-medium text-white">长按图片</span>
                  <span> → 「保存到相册」或「添加到照片」</span>
                </>
              ) : (
                <>点击下方「下载 PNG」保存到本地，或右键图片另存为</>
              )}
            </p>
            <div className="flex gap-2">
              {canShare && (
                <button
                  type="button"
                  onClick={onShare}
                  className="rounded-lg bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
                >
                  分享…
                </button>
              )}
              <button
                type="button"
                onClick={onDownload}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-bg hover:brightness-110 transition-all"
              >
                下载 PNG
              </button>
              <button
                type="button"
                onClick={closePreview}
                className="rounded-lg bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
