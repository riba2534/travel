import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { YearStat, PointFC } from '../lib/types';
import { useAppStore } from '../state/store';
import WrappedMap from './WrappedMap';

interface Props {
  open: boolean;
  onClose: () => void;
  pointsData: PointFC | null;
}

const EARTH_CIRCUM_KM = 40075;

export default function WrappedStory({ open, onClose, pointsData }: Props) {
  const summary = useAppStore((s) => s.summary);
  const yearStats = summary?.yearStats ?? [];

  // 默认选最新且有数据的一年
  const defaultYear = useMemo(() => {
    if (!yearStats.length) return null;
    // 挑 points 最多的一年作默认
    const sorted = [...yearStats].sort((a, b) => b.points - a.points);
    return sorted[0].year;
  }, [yearStats]);

  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (open && selected === null && defaultYear !== null) setSelected(defaultYear);
  }, [open, selected, defaultYear]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || yearStats.length === 0) return null;

  const stat: YearStat | undefined = yearStats.find((y) => y.year === selected);

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="年度足迹报告"
      className="fixed inset-0 z-[65] flex flex-col overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* 顶部 bar */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="text-sm font-medium text-text">年度足迹报告</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭年度报告"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-dim hover:text-text hover:bg-white/5"
        >
          ✕
        </button>
      </div>

      {/* 年份 tabs */}
      <div className="shrink-0 overflow-x-auto">
        <div className="flex gap-1 px-4 py-2">
          {yearStats.map((y) => {
            const active = y.year === selected;
            return (
              <button
                key={y.year}
                type="button"
                onClick={() => setSelected(y.year)}
                aria-pressed={active}
                className={`rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums transition-colors ${
                  active ? 'bg-accent text-bg' : 'text-text-dim hover:text-text hover:bg-white/[0.04]'
                }`}
              >
                {y.year}
              </button>
            );
          })}
        </div>
      </div>

      {/* 卡片内容 */}
      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4 sm:px-8 sm:pt-6">
        {stat ? <StoryCard stat={stat} pointsData={pointsData} /> : null}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function StoryCard({
  stat,
  pointsData,
}: {
  stat: YearStat;
  pointsData: PointFC | null;
}) {
  const loops = stat.km > 0 ? (stat.km / EARTH_CIRCUM_KM).toFixed(2) : '0';
  const maxCityCount = Math.max(...stat.topCities.map((c) => c.count), 1);
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6">
      {/* Hero */}
      <div className="flex flex-col items-start gap-2">
        <div className="text-[11px] uppercase tracking-widest text-text-dim">YEAR IN REVIEW</div>
        <div className="flex items-baseline gap-3">
          <div className="font-mono tabular-nums text-6xl font-bold text-accent sm:text-7xl">
            {stat.year}
          </div>
          <div className="text-base text-text-dim">这一年</div>
        </div>
      </div>

      {/* 当年地图 */}
      {pointsData && stat.points > 0 && (
        <section
          className="overflow-hidden rounded-2xl border border-white/[0.06]"
          style={{ background: 'var(--panel)' }}
        >
          <div className="h-[260px] sm:h-[340px] w-full">
            <WrappedMap pointsData={pointsData} year={stat.year} />
          </div>
        </section>
      )}

      {/* 里程 */}
      <section className="rounded-2xl border border-white/[0.06] p-5 sm:p-6" style={{ background: 'var(--panel)' }}>
        <div className="text-[11px] uppercase tracking-widest text-text-dim">路程</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono tabular-nums text-4xl font-semibold text-text sm:text-5xl">
            {stat.km.toLocaleString()}
          </span>
          <span className="text-lg text-text-dim">km</span>
        </div>
        <div className="mt-1 text-xs text-text-dim">
          相当于绕地球 <span className="font-mono tabular-nums text-accent">{loops}</span> 圈
        </div>
      </section>

      {/* 国家和地区 */}
      <section className="rounded-2xl border border-white/[0.06] p-5 sm:p-6" style={{ background: 'var(--panel)' }}>
        <div className="text-[11px] uppercase tracking-widest text-text-dim">足迹所至</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono tabular-nums text-4xl font-semibold text-text sm:text-5xl">
            {stat.countries.length}
          </span>
          <span className="text-lg text-text-dim">个国家和地区</span>
        </div>
        {stat.countries.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stat.countries.map((c) => (
              <span
                key={c}
                className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-xs text-text"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* TOP 5 城市 */}
      {stat.topCities.length > 0 && (
        <section className="rounded-2xl border border-white/[0.06] p-5 sm:p-6" style={{ background: 'var(--panel)' }}>
          <div className="text-[11px] uppercase tracking-widest text-text-dim">常去的地方</div>
          <div className="mt-3 flex flex-col gap-2">
            {stat.topCities.map((c, idx) => {
              const pct = (c.count / maxCityCount) * 100;
              return (
                <div key={`${c.name}-${c.lat}-${c.lon}`} className="flex items-center gap-3">
                  <div className="w-6 shrink-0 text-center font-mono tabular-nums text-[10px] text-text-dim">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-text">{c.name}</span>
                      <span className="shrink-0 font-mono tabular-nums text-[11px] text-accent/90">
                        {c.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: 'var(--accent)' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 最远一天 */}
      {stat.farthestDay && stat.farthestDay.km > 0 && (
        <section className="rounded-2xl border border-white/[0.06] p-5 sm:p-6" style={{ background: 'var(--panel)' }}>
          <div className="text-[11px] uppercase tracking-widest text-text-dim">走得最远的一天</div>
          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            <span className="font-mono tabular-nums text-2xl font-semibold text-text">
              {formatDate(stat.farthestDay.date)}
            </span>
            <span className="font-mono tabular-nums text-3xl font-semibold text-accent">
              {stat.farthestDay.km.toLocaleString()} <span className="text-base text-text-dim">km</span>
            </span>
          </div>
        </section>
      )}

      {/* 轨迹点数 */}
      <section className="flex items-center justify-between rounded-2xl border border-white/[0.06] px-5 py-3 sm:px-6" style={{ background: 'var(--panel)' }}>
        <div className="text-[11px] uppercase tracking-widest text-text-dim">轨迹点数</div>
        <div className="font-mono tabular-nums text-lg font-semibold text-text">
          {stat.points.toLocaleString()}
        </div>
      </section>

      <div className="h-4" />
    </div>
  );
}

function formatDate(iso: string): string {
  // iso: "2025-11-10"
  const m = iso.match(/^(\d+)-(\d+)-(\d+)$/);
  if (!m) return iso;
  return `${+m[2]} 月 ${+m[3]} 日`;
}
