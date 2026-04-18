import type { Summary } from '../lib/types';

export default function TitleCard({ summary }: { summary: Summary | null }) {
  return (
    <div
      className="pointer-events-auto rounded-2xl border border-white/[0.08] bg-surface px-3 py-2 sm:px-5 sm:py-3 shadow-2xl backdrop-blur-md"
      style={{ background: 'rgba(15,15,20,0.72)' }}
    >
      <div className="text-base sm:text-xl font-medium leading-tight tracking-tight">我的足迹</div>
      <div className="text-[10px] sm:text-xs font-mono text-text-dim tabular-nums mt-0.5">
        {summary ? `${summary.years[0]} – ${summary.years[summary.years.length - 1]}` : '— · —'}
      </div>
    </div>
  );
}
