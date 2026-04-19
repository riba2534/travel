import { useAppStore } from '../state/store';

/** 居中按钮：把地图视图 fit 到所有足迹点的 bbox（与分享截图相同的构图）。
 * 不改 filter/layer 状态，只重置视图。 */
export default function FitAllButton() {
  const summary = useAppStore((s) => s.summary);
  const flyTo = useAppStore((s) => s.flyTo);

  const onClick = () => {
    if (!summary) return;
    flyTo({ bbox: summary.bbox });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!summary}
      aria-label="居中到所有足迹"
      title="居中到所有足迹"
      className="pointer-events-auto flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] shadow-2xl backdrop-blur-md text-text-dim hover:text-text active:bg-white/5 transition-colors disabled:opacity-40"
      style={{ background: 'var(--panel)' }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" opacity="0.75" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
    </button>
  );
}
