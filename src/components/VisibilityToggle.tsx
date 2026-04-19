import { useAppStore } from '../state/store';

/** 眼镜图标按钮：点一下隐藏所有 UI 只留地图，再点一下恢复。ESC 也能恢复。 */
export default function VisibilityToggle() {
  const uiHidden = useAppStore((s) => s.uiHidden);
  const setUiHidden = useAppStore((s) => s.setUiHidden);

  return (
    <button
      type="button"
      onClick={() => setUiHidden(!uiHidden)}
      aria-pressed={uiHidden}
      aria-label={uiHidden ? '显示界面' : '沉浸模式：隐藏所有界面'}
      title={uiHidden ? '显示界面 (Esc)' : '沉浸模式'}
      className={`pointer-events-auto fixed z-[55] flex h-9 w-9 items-center justify-center rounded-2xl border border-white/[0.08] shadow-2xl backdrop-blur-md transition-colors ${
        uiHidden
          ? 'text-accent bg-black/40 hover:bg-black/60'
          : 'text-text-dim hover:text-text active:bg-white/5'
      }`}
      style={{
        background: uiHidden ? 'rgba(0,0,0,0.5)' : 'var(--panel)',
        right: 'max(0.75rem, env(safe-area-inset-right))',
        // uiHidden=true 独自在最底；uiHidden=false 时避让底部控件栏（移动端有 YearSlider，桌面有 bar）
        bottom: uiHidden
          ? 'var(--safe-bottom)'
          : 'calc(var(--safe-bottom) + var(--h-bottom-bar))',
      }}
    >
      {uiHidden ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
