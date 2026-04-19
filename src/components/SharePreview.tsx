// 分享图预览 modal。接受一个 Blob，展示 + 提供下载 / Web Share / 关闭。
// 被 ShareExporter（全景分享图）和 WrappedStory（年度分享图）复用。

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  blob: Blob | null;
  onClose: () => void;
  /** 下载文件名前缀，如 footprint / footprint-2025 */
  filenamePrefix?: string;
}

function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export default function SharePreview({ blob, onClose, filenamePrefix = 'footprint' }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  if (!blob || !url) return null;

  const filename = `${filenamePrefix}-${Date.now()}.png`;

  const onDownload = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const onShare = async () => {
    type NavigatorShare = Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string }) => Promise<void>;
    };
    const nav = navigator as NavigatorShare;
    const file = new File([blob], filename, { type: 'image/png' });
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="分享图预览"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-black/85 p-3 sm:p-5"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭预览"
        className="absolute right-3 top-3 sm:right-5 sm:top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur transition-colors"
      >
        ✕
      </button>

      <div
        className="relative flex max-h-[85vh] max-w-[96vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt="分享图"
          className="max-h-[85vh] max-w-full rounded-lg shadow-2xl"
          style={{ objectFit: 'contain', WebkitTouchCallout: 'default' }}
          draggable
        />
      </div>

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
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
