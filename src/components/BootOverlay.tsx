import { useEffect, useState } from 'react';
import { formatBytes } from '../lib/fetch-progress';

interface Props {
  loaded: number;
  total: number;
  ratio: number;
  done: boolean;
}

export default function BootOverlay({ loaded, total, ratio, done }: Props) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (done) {
      const t = window.setTimeout(() => setHidden(true), 420);
      return () => window.clearTimeout(t);
    }
  }, [done]);

  if (hidden) return null;

  const pct = Math.round(ratio * 100);
  const knownSize = total > 0;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center transition-opacity duration-300"
      style={{
        background: 'var(--bg)',
        opacity: done ? 0 : 1,
      }}
      aria-live="polite"
      aria-busy={!done}
    >
      <div className="flex flex-col items-center gap-4 px-6">
        {/* Pulsing dot + logo mark */}
        <div className="relative flex h-14 w-14 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: 'var(--accent)', opacity: 0.2, animation: 'boot-pulse 1.6s ease-in-out infinite' }}
          />
          <span
            className="absolute inset-[18%] rounded-full"
            style={{ background: 'var(--accent)', opacity: 0.45, animation: 'boot-pulse 1.6s ease-in-out infinite 0.3s' }}
          />
          <span
            className="relative h-3 w-3 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            正在加载足迹数据
          </div>
          <div
            className="font-mono tabular-nums text-[11px]"
            style={{ color: 'var(--text-dim)' }}
          >
            {knownSize
              ? `${formatBytes(loaded)} / ${formatBytes(total)} · ${pct}%`
              : `${formatBytes(loaded)}`}
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="h-[2px] w-[180px] overflow-hidden rounded-full"
          style={{ background: 'rgba(127,127,127,0.18)' }}
          role="progressbar"
          aria-valuenow={knownSize ? pct : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{
              width: knownSize ? `${pct}%` : '35%',
              background: 'var(--accent)',
              animation: knownSize ? undefined : 'boot-indeterminate 1.4s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes boot-pulse {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.35); opacity: 0.05; }
        }
        @keyframes boot-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
