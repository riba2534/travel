import { useAppStore, type LayerVisibility } from '../state/store';

interface ToggleDef {
  key: keyof LayerVisibility;
  label: string;
  icon: JSX.Element;
}

const TOGGLES: ToggleDef[] = [
  {
    key: 'points',
    label: '点位',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" fill="currentColor" />
        <circle cx="6" cy="6" r="1.5" fill="currentColor" opacity="0.5" />
        <circle cx="18" cy="7" r="1.5" fill="currentColor" opacity="0.5" />
        <circle cx="7" cy="18" r="1.5" fill="currentColor" opacity="0.5" />
        <circle cx="18" cy="17" r="1.5" fill="currentColor" opacity="0.5" />
      </svg>
    ),
  },
  {
    key: 'heatmap',
    label: '热力',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" opacity="0.3" />
        <circle cx="12" cy="12" r="6" opacity="0.5" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: 'track',
    label: '轨迹',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 18c3-2 3-6 7-6s4 6 9 4" />
      </svg>
    ),
  },
];

export default function LayerToggles() {
  const layers = useAppStore((s) => s.layers);
  const toggle = useAppStore((s) => s.toggleLayer);

  return (
    <div
      role="group"
      aria-label="图层开关"
      className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-2xl border border-white/[0.08] p-1 shadow-2xl backdrop-blur-md"
      style={{ background: 'var(--panel)' }}
    >
      {TOGGLES.map((t) => {
        const active = layers[t.key];
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={active}
            aria-label={`${active ? '隐藏' : '显示'}${t.label}`}
            onClick={() => toggle(t.key)}
            className={`inline-flex h-10 min-w-[44px] items-center gap-1.5 rounded-xl px-2.5 sm:px-3 text-xs font-medium transition-all ${
              active ? 'bg-accent text-bg shadow-md' : 'text-text-dim hover:text-text active:bg-white/5'
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
