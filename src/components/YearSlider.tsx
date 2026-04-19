interface Props {
  years: number[];
  perYear: Record<string, number>;
  start: number | null;
  end: number | null;
  onChange: (start: number, end: number) => void;
}

export default function YearSlider({ years, perYear, start, end, onChange }: Props) {
  if (years.length === 0 || start === null || end === null) {
    return <div className="pointer-events-none flex-1" />;
  }

  const min = years[0];
  const max = years[years.length - 1];
  const maxCount = Math.max(...years.map((y) => perYear[String(y)] ?? 0), 1);

  return (
    <div
      className="pointer-events-auto flex-1 max-w-2xl rounded-2xl border border-white/[0.08] px-3 sm:px-4 py-1.5 shadow-2xl backdrop-blur-md"
      style={{ background: 'var(--panel)' }}
    >
      {/* 年份 + 数量条 */}
      <div className="mb-0.5 flex items-end justify-between gap-1">
        {years.map((y) => {
          const pct = ((perYear[String(y)] ?? 0) / maxCount) * 100;
          const inRange = y >= start && y <= end;
          return (
            <div key={y} className="flex flex-1 flex-col items-center gap-0.5 min-w-0">
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${Math.max(pct * 0.14, 2)}px`,
                  background: 'var(--accent)',
                  opacity: inRange ? 0.85 : 0.25,
                }}
                title={`${y}: ${(perYear[String(y)] ?? 0).toLocaleString()} 点`}
              />
            </div>
          );
        })}
      </div>

      {/* 双滑块 */}
      <div className="relative h-5">
        {/* 轨道 */}
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        {/* 已选区间 */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{
            left: `${((start - min) / Math.max(max - min, 1)) * 100}%`,
            right: `${100 - ((end - min) / Math.max(max - min, 1)) * 100}%`,
            background: 'var(--accent)',
          }}
        />
        {/* 起始 */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={start}
          onChange={(e) => {
            const v = Math.min(+e.target.value, end);
            onChange(v, end);
          }}
          aria-label="起始年份"
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent"
          style={{ pointerEvents: 'auto' }}
        />
        {/* 结束 */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={end}
          onChange={(e) => {
            const v = Math.max(+e.target.value, start);
            onChange(start, v);
          }}
          aria-label="结束年份"
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent"
          style={{ pointerEvents: 'auto' }}
        />
      </div>

      {/* 当前选中年份显示 */}
      <div className="mt-0.5 flex items-center justify-between text-[10px] font-mono tabular-nums text-text-dim">
        <span className={start === min ? '' : 'text-accent'}>{start}</span>
        <span className="text-text-dim/60">
          {start === end ? `${perYear[String(start)] ?? 0} 个点` : `${end - start + 1} 年`}
        </span>
        <span className={end === max ? '' : 'text-accent'}>{end}</span>
      </div>

      <style>{`
        .range-thumb { z-index: 2; }
        .range-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid var(--bg);
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          cursor: pointer;
          pointer-events: auto;
        }
        .range-thumb::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid var(--bg);
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          cursor: pointer;
          pointer-events: auto;
        }
        .range-thumb::-webkit-slider-runnable-track { background: transparent; }
        .range-thumb::-moz-range-track { background: transparent; }
        .range-thumb:focus { outline: none; }
        .range-thumb:focus::-webkit-slider-thumb { box-shadow: 0 0 0 3px rgba(255,255,255,0.2); }
        .range-thumb:focus::-moz-range-thumb { box-shadow: 0 0 0 3px rgba(255,255,255,0.2); }
        @media (max-width: 640px) {
          .range-thumb::-webkit-slider-thumb { width: 20px; height: 20px; }
          .range-thumb::-moz-range-thumb { width: 20px; height: 20px; }
        }
      `}</style>
    </div>
  );
}
