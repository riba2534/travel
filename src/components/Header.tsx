import type { Summary } from '../lib/types';

export default function Header({ summary }: { summary: Summary | null }) {
  return (
    <div
      className="pointer-events-auto inline-flex flex-col gap-2 sm:gap-3 rounded-2xl border border-white/[0.08] px-4 py-3 sm:px-6 sm:py-4 shadow-2xl backdrop-blur-md"
      style={{ background: 'var(--panel)' }}
    >
      <div className="flex items-baseline gap-2.5 sm:gap-3">
        <h1 className="text-lg sm:text-2xl font-medium leading-none tracking-tight">我的足迹</h1>
      </div>

      {/* 分隔线 */}
      <div className="h-px bg-white/[0.08]" />

      {/* 统计 - 单行紧凑 */}
      <div className="flex items-end gap-3 sm:gap-5">
        <Stat value={summary?.totalPoints.toLocaleString() ?? '—'} label="足迹" />
        <Stat value={summary ? String(summary.countries.length) : '—'} label="国家和地区" />
        <Stat value={summary?.kmTraveled.toLocaleString() ?? '—'} label="公里" />
        <Stat value={summary ? String(summary.years.length) : '—'} label="年" />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:gap-1">
      <span className="font-mono tabular-nums text-base sm:text-xl font-semibold leading-none text-text">
        {value}
      </span>
      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-text-dim leading-none">
        {label}
      </span>
    </div>
  );
}
