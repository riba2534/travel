import { useAppStore } from '../state/store';

export default function HiddenReveal() {
  const uiHidden = useAppStore((s) => s.uiHidden);
  const setUiHidden = useAppStore((s) => s.setUiHidden);
  if (!uiHidden) return null;
  return (
    <button
      type="button"
      onClick={() => setUiHidden(false)}
      aria-label="显示界面 (Esc)"
      title="显示界面 (Esc)"
      className="fixed bottom-3 right-3 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.12] text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
