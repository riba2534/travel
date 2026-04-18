import type { Summary } from '../lib/types';

export default function StatsCard({ summary }: { summary: Summary | null }) {
  const items = [
    { label: '足迹点', value: summary ? summary.totalPoints.toLocaleString() : '—' },
    { label: '国家', value: summary ? summary.countries.length : '—' },
    { label: '公里', value: summary ? summary.kmTraveled.toLocaleString() : '—' },
    { label: '年', value: summary ? summary.years.length : '—' },
  ];

  return (
    <div
      className="pointer-events-auto rounded-2xl border border-white/[0.08] bg-surface px-3 py-2 sm:px-5 sm:py-3 shadow-2xl backdrop-blur-md"
      style={{ background: 'rgba(15,15,20,0.72)' }}
    >
      {/* mobile: 2x2 grid，desktop: 单行 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 sm:gap-x-5">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col">
            <span className="text-base sm:text-xl font-semibold font-mono tabular-nums leading-none text-text">
              {it.value}
            </span>
            <span className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] uppercase tracking-wider text-text-dim">
              {it.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
