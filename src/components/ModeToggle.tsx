import type { Mode } from '../lib/types';

interface Props {
  mode: Mode;
  onChange: (m: Mode) => void;
}

const MODES: { id: Mode; label: string; icon: JSX.Element }[] = [
  {
    id: 'points',
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
    id: 'heatmap',
    label: '热力',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" opacity="0.3" />
        <circle cx="12" cy="12" r="6" opacity="0.5" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    ),
  },
];

export default function ModeToggle({ mode, onChange }: Props) {
  return (
    <div
      className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-2xl border border-white/[0.08] bg-surface p-1 shadow-2xl backdrop-blur-md"
      style={{ background: 'rgba(15,15,20,0.72)' }}
      role="tablist"
      aria-label="显示模式"
    >
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`切换到${m.label}模式`}
            onClick={() => onChange(m.id)}
            className={`inline-flex h-10 min-w-[44px] items-center gap-1.5 rounded-xl px-2.5 sm:px-3 text-xs font-medium transition-all ${
              active
                ? 'bg-accent text-bg shadow-md'
                : 'text-text-dim hover:text-text active:bg-white/5'
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            {m.icon}
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
