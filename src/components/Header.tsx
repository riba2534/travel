import { useState } from 'react';
import type { Summary, PointFC } from '../lib/types';
import WrappedStory from './WrappedStory';

interface HeaderProps {
  summary: Summary | null;
  pointsData: PointFC | null;
}

export default function Header({ summary, pointsData }: HeaderProps) {
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const hasWrapped = !!summary?.yearStats?.length;

  return (
    <div
      className="pointer-events-auto inline-flex items-center gap-2 sm:gap-3 rounded-2xl border border-white/[0.08] px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xl backdrop-blur-md"
      style={{ background: 'var(--panel)' }}
    >
      <h1 className="text-sm sm:text-base font-medium leading-none tracking-tight whitespace-nowrap">
        HPCのJourneys
      </h1>

      <span className="h-4 w-px bg-white/10 shrink-0" aria-hidden="true" />

      <div className="flex items-baseline gap-2 sm:gap-3">
        {/* 移动端只保留两个核心 Stat；桌面端四个全显 */}
        <Stat value={summary?.kmTraveled.toLocaleString() ?? '—'} label="km" />
        <Stat value={summary ? String(summary.countries.length) : '—'} label="地区" />
        <span className="hidden sm:inline-flex items-baseline gap-3">
          <Stat value={summary?.totalPoints.toLocaleString() ?? '—'} label="足迹" />
          <Stat value={summary ? String(summary.years.length) : '—'} label="年" />
        </span>
      </div>

      {hasWrapped && (
        <button
          type="button"
          onClick={() => setWrappedOpen(true)}
          aria-label="打开年度足迹报告"
          title="年度足迹报告"
          className="wrapped-pill inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2 py-1 sm:py-0.5 text-[10px] font-medium text-accent hover:bg-accent/25 transition-colors shrink-0"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2L14.5 9h7.5l-6 4.5 2.3 7-7.3-5.4-7.3 5.4 2.3-7-6-4.5h7.5z" />
          </svg>
          <span className="hidden sm:inline">年度报告</span>
        </button>
      )}

      <style>{`
        @keyframes wrapped-pill-pulse {
          0%, 100% { filter: brightness(1); transform: scale(1); }
          50% { filter: brightness(1.12); transform: scale(1.04); }
        }
        .wrapped-pill { animation: wrapped-pill-pulse 2.4s ease-in-out infinite; transform-origin: center; }
        @media (prefers-reduced-motion: reduce) {
          .wrapped-pill { animation: none; }
        }
      `}</style>

      <WrappedStory
        open={wrappedOpen}
        onClose={() => setWrappedOpen(false)}
        pointsData={pointsData}
      />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className="font-mono tabular-nums text-xs sm:text-sm font-semibold leading-none text-text">
        {value}
      </span>
      <span className="text-[9px] sm:text-[10px] text-text-dim leading-none">
        {label}
      </span>
    </span>
  );
}
