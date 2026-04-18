import { useState } from 'react';
import type { City } from '../lib/types';

interface Props {
  cities: City[];
  onSelect: (city: City) => void;
}

export default function CityList({ cities, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const visible = cities.slice(0, 8);

  if (cities.length === 0) return null;

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      {/* mobile: collapsed by default, sm: 始终展开 */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? '收起城市列表' : '展开城市列表'}
        aria-expanded={open}
        className="sm:hidden inline-flex h-11 min-w-[44px] items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-surface px-3 text-xs font-medium shadow-2xl backdrop-blur-md transition-colors active:bg-white/5"
        style={{ background: 'rgba(15,15,20,0.72)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12z" />
          <circle cx="12" cy="9" r="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{visible.length} 城市</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-text-dim transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        className={`${open ? 'block' : 'hidden'} sm:block w-[180px] sm:w-[220px] max-h-[60dvh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-surface p-2 shadow-2xl backdrop-blur-md`}
        style={{ background: 'rgba(15,15,20,0.72)' }}
      >
        <div className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-wider text-text-dim">
          高频地点 · TOP {visible.length}
        </div>
        <ul className="flex flex-col gap-0.5">
          {visible.map((c) => (
            <li key={`${c.name}-${c.lat}-${c.lon}`}>
              <button
                type="button"
                onClick={() => { onSelect(c); setOpen(false); }}
                className="flex w-full min-h-[36px] items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.06] active:bg-white/[0.1]"
              >
                <span className="truncate text-text">{c.name}</span>
                <span className="shrink-0 font-mono tabular-nums text-[11px] text-accent/90">
                  {c.count.toLocaleString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
