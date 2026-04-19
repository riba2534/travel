// 首页底部的「生成分享图」按钮：一键生成 1920×1080 PNG，弹预览。
// opts 用 store 里的默认值（title+stats+date），不再暴露勾选面板。

import { useState } from 'react';
import { useAppStore } from '../state/store';
import { exportShare } from '../lib/share';
import SharePreview from './SharePreview';

export default function ShareButton() {
  const summary = useAppStore((s) => s.summary);
  const shareOpts = useAppStore((s) => s.shareOpts);
  const setExporting = useAppStore((s) => s.setExporting);

  const [busy, setBusy] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onClick = async () => {
    const map = (window as unknown as { __map?: import('maplibre-gl').Map }).__map;
    if (!map || !summary) {
      setErr('地图尚未就绪');
      return;
    }
    setBusy(true);
    setErr(null);
    setExporting(true);
    try {
      const b = await exportShare(map, summary, shareOpts);
      setBlob(b);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setExporting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy || !summary}
        aria-label="生成分享图"
        title="生成 1920×1080 分享图"
        className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] shadow-2xl backdrop-blur-md text-text-dim hover:text-text active:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'var(--panel)' }}
      >
        {busy ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        )}
      </button>

      <SharePreview blob={blob} onClose={() => setBlob(null)} />

      {err && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs text-white backdrop-blur-md shadow-lg"
          onClick={() => setErr(null)}
        >
          {err}
        </div>
      )}
    </>
  );
}
