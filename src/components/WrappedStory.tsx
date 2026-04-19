import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Map as MLMap } from 'maplibre-gl';
import type { YearStat, PointFC, Summary } from '../lib/types';
import { useAppStore } from '../state/store';
import WrappedMap, { type WrappedMapHandle } from './WrappedMap';
import SharePreview from './SharePreview';
import { exportShare } from '../lib/share';

const SHARE_OPTS_YEAR = { title: true, stats: true, date: true } as const;
const BOOST_GLOW_RADIUS = 14;
const BOOST_CORE_RADIUS = 4;
const BOOST_TRACK_GLOW = 8;
const BOOST_TRACK_CORE = 3;

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
  const summary = useAppStore((s) => s.summary);
  const loops = stat.km > 0 ? (stat.km / EARTH_CIRCUM_KM).toFixed(2) : '0';
  const maxCityCount = Math.max(...stat.topCities.map((c) => c.count), 1);

  const mapHandleRef = useRef<WrappedMapHandle>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const onSaveImage = async () => {
    if (!summary || !pointsData) return;
    const map = mapHandleRef.current?.getMap();
    if (!map) {
      setSaveErr('地图尚未加载完成');
      return;
    }
    setSaving(true);
    setSaveErr(null);
    try {
      const blob = await generateYearShareImage(map, summary, pointsData, stat.year);
      setPreviewBlob(blob);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

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
          <div className="relative h-[260px] sm:h-[340px] w-full">
            <WrappedMap ref={mapHandleRef} pointsData={pointsData} year={stat.year} />
            {/* 保存为图按钮 */}
            <button
              type="button"
              onClick={onSaveImage}
              disabled={saving}
              aria-label={`保存 ${stat.year} 年分享图`}
              title="生成 1920×1080 分享图"
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-white hover:bg-black/75 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{saving ? '生成中…' : '保存为图'}</span>
            </button>
            {/* loading overlay：share.ts 会把 map container 移屏，这里盖住避免视觉空白 */}
            {saving && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
                <div className="flex flex-col items-center gap-2 text-white/95 text-xs">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>正在生成 {stat.year} 年分享图…</span>
                </div>
              </div>
            )}
          </div>
          {saveErr && (
            <div className="px-4 py-2 text-[11px] text-red-400 border-t border-white/[0.06]">
              {saveErr}
            </div>
          )}
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

      {/* 去过的城市（全量） */}
      {stat.topCities.length > 0 && (
        <section className="rounded-2xl border border-white/[0.06] p-5 sm:p-6" style={{ background: 'var(--panel)' }}>
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] uppercase tracking-widest text-text-dim">去过的城市</div>
            <div className="font-mono tabular-nums text-[11px] text-text-dim">{stat.topCities.length} 座</div>
          </div>
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

      <SharePreview
        blob={previewBlob}
        onClose={() => setPreviewBlob(null)}
        filenamePrefix={`footprint-${stat.year}`}
      />
    </div>
  );
}

function formatDate(iso: string): string {
  // iso: "2025-11-10"
  const m = iso.match(/^(\d+)-(\d+)-(\d+)$/);
  if (!m) return iso;
  return `${+m[2]} 月 ${+m[3]} 日`;
}

/** 用 WrappedMap 的 MapLibre 实例导出该年分享图。
 *  流程：计算当年 bbox → 临时放大点/轨迹半径（1920 分辨率下小半径看不清）→ exportShare → finally 还原。 */
async function generateYearShareImage(
  map: MLMap,
  summary: Summary,
  pointsData: PointFC,
  year: number,
): Promise<Blob> {
  const startT = Math.floor(Date.UTC(year, 0, 1) / 1000);
  const endT = Math.floor(Date.UTC(year + 1, 0, 1) / 1000);
  const features = pointsData.features.filter(
    (f) => f.properties.t >= startT && f.properties.t < endT,
  );
  if (features.length < 1) throw new Error('该年无足迹');

  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const f of features) {
    const [lon, lat] = f.geometry.coordinates as [number, number];
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  const bbox: [number, number, number, number] = [minLon, minLat, maxLon, maxLat];

  // 备份 paint，临时放大
  const before = {
    pointsGlow: map.getPaintProperty('yr-points-glow', 'circle-radius'),
    pointsCore: map.getPaintProperty('yr-points-core', 'circle-radius'),
    trackGlow: map.getPaintProperty('yr-track-glow', 'line-width'),
    trackCore: map.getPaintProperty('yr-track-core', 'line-width'),
  };
  map.setPaintProperty('yr-points-glow', 'circle-radius', BOOST_GLOW_RADIUS);
  map.setPaintProperty('yr-points-core', 'circle-radius', BOOST_CORE_RADIUS);
  map.setPaintProperty('yr-track-glow', 'line-width', BOOST_TRACK_GLOW);
  map.setPaintProperty('yr-track-core', 'line-width', BOOST_TRACK_CORE);

  try {
    return await exportShare(map, summary, SHARE_OPTS_YEAR, { year, bbox });
  } finally {
    map.setPaintProperty('yr-points-glow', 'circle-radius', before.pointsGlow);
    map.setPaintProperty('yr-points-core', 'circle-radius', before.pointsCore);
    map.setPaintProperty('yr-track-glow', 'line-width', before.trackGlow);
    map.setPaintProperty('yr-track-core', 'line-width', before.trackCore);
  }
}
