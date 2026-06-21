import { useEffect, useState } from 'react';
import { formatBytes } from '../lib/fetch-progress';

interface Props {
  loaded: number;
  total: number;
  ratio: number;
  done: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function BootOverlay({ loaded, total, ratio, done, error, onRetry }: Props) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (error) {
      setHidden(false);
      return;
    }
    if (done) {
      const t = window.setTimeout(() => setHidden(true), 420);
      return () => window.clearTimeout(t);
    }
  }, [done, error]);

  if (hidden) return null;

  const pct = Math.round(ratio * 100);
  const knownSize = total > 0;

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center transition-opacity duration-300 ${
        error ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{
        background: 'var(--bg)',
        opacity: done ? 0 : 1,
      }}
      aria-live="polite"
      aria-busy={!done && !error}
    >
      <div className="flex w-full max-w-[320px] flex-col items-center gap-4 px-6 text-center">
        {error ? (
          <>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg"
              style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)' }}
              aria-hidden="true"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                数据没有加载成功
              </div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                请检查网络后重试。错误信息：{error}
              </div>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="control-button control-button-active px-4 text-xs font-semibold"
              >
                重新加载
              </button>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
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
