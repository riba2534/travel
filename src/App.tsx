import { useEffect, useRef, useState } from 'react';
import Map from './Map';
import Header from './components/Header';
import PlacesMenu from './components/PlacesMenu';
import YearSlider from './components/YearSlider';
import LayerToggles from './components/LayerToggles';
import FitAllButton from './components/FitAllButton';
import SettingsButton from './components/SettingsButton';
import ShareButton from './components/ShareButton';
import VisibilityToggle from './components/VisibilityToggle';
import BootOverlay from './components/BootOverlay';
import type { Places, Summary, PointFC, TrackFC } from './lib/types';
import { useAppStore } from './state/store';
import { streamFetchJson, aggregateProgress } from './lib/fetch-progress';
import { decodeState, encodeState, writeHash } from './lib/url-state';

const DATA_URLS = {
  summary: '/data/summary.json',
  places: '/data/places.json',
  points: '/data/points.geojson',
  track: '/data/track.geojson',
};

export default function App() {
  const summary = useAppStore((s) => s.summary);
  const places = useAppStore((s) => s.places);
  const setSummary = useAppStore((s) => s.setSummary);
  const setPlaces = useAppStore((s) => s.setPlaces);
  const yearStart = useAppStore((s) => s.yearStart);
  const yearEnd = useAppStore((s) => s.yearEnd);
  const setYearRange = useAppStore((s) => s.setYearRange);
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);
  const layers = useAppStore((s) => s.layers);
  const setLayer = useAppStore((s) => s.setLayer);
  const uiHidden = useAppStore((s) => s.uiHidden);
  const setUiHidden = useAppStore((s) => s.setUiHidden);

  const [geoData, setGeoData] = useState<{ points: PointFC; track: TrackFC } | null>(null);
  const [progress, setProgress] = useState({ loaded: 0, total: 0, ratio: 0, done: false });
  const hashAppliedRef = useRef(false);

  useEffect(() => {
    const urls = [DATA_URLS.summary, DATA_URLS.places, DATA_URLS.points, DATA_URLS.track];
    const onProg = aggregateProgress(urls, setProgress);

    Promise.all([
      streamFetchJson<Summary>(DATA_URLS.summary, onProg),
      streamFetchJson<Places>(DATA_URLS.places, onProg),
      streamFetchJson<PointFC>(DATA_URLS.points, onProg),
      streamFetchJson<TrackFC>(DATA_URLS.track, onProg),
    ])
      .then(([s, p, pts, tr]) => {
        setSummary(s);
        setPlaces(p);
        setGeoData({ points: pts, track: tr });
      })
      .catch((e) => {
        console.error('加载数据失败', e);
        setProgress({ loaded: 0, total: 0, ratio: 0, done: true });
      });
  }, [setSummary, setPlaces]);

  // ESC 键复原 UI
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && uiHidden) setUiHidden(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [uiHidden, setUiHidden]);

  // URL hash 同步：summary + places 首次就绪时，应用 hash 中的筛选/图层/年份
  useEffect(() => {
    if (!summary || !places || hashAppliedRef.current) return;
    hashAppliedRef.current = true;
    applyHashToStore(window.location.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, places]);

  // store 变化 debounce 写回 hash
  useEffect(() => {
    if (!hashAppliedRef.current || !summary) return;
    const defaults = {
      yearStart: summary.years[0] ?? null,
      yearEnd: summary.years[summary.years.length - 1] ?? null,
    };
    const t = window.setTimeout(() => {
      writeHash(encodeState({ yearStart, yearEnd, filter, layers }, defaults));
    }, 200);
    return () => window.clearTimeout(t);
  }, [yearStart, yearEnd, filter, layers, summary]);

  // 监听用户手动改 hash / 前进后退
  useEffect(() => {
    const onHashChange = () => {
      if (!summary || !places) return;
      applyHashToStore(window.location.hash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, places]);

  function applyHashToStore(hash: string) {
    if (!summary) return;
    const st = decodeState(hash);
    if (st.yearStart !== undefined && st.yearEnd !== undefined) {
      const minY = summary.years[0];
      const maxY = summary.years[summary.years.length - 1];
      const ys = Math.max(minY, Math.min(maxY, st.yearStart));
      const ye = Math.max(minY, Math.min(maxY, st.yearEnd));
      setYearRange(ys, ye);
    }
    if (st.filter) {
      // 校验 countryCode 存在于 places，否则整体忽略 filter
      const valid = !st.filter.countryCode
        ? false
        : !!places?.continents.some((cont) =>
            cont.countries.some((c) => c.code === st.filter!.countryCode),
          );
      if (valid) setFilter(st.filter);
      else if (!st.filter.countryCode && !st.filter.cityName) setFilter({});
    }
    if (st.layers) {
      setLayer('points', st.layers.points);
      setLayer('heatmap', st.layers.heatmap);
      setLayer('track', st.layers.track);
    }
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg text-text">
      {geoData && (
        <Map
          bbox={summary?.bbox ?? null}
          yearStart={yearStart}
          yearEnd={yearEnd}
          pointsData={geoData.points}
          trackData={geoData.track}
        />
      )}

      <BootOverlay
        loaded={progress.loaded}
        total={progress.total}
        ratio={progress.ratio}
        done={progress.done && geoData !== null}
      />

      <VisibilityToggle />

      {/* 浮窗层 - 不阻挡地图拖动 */}
      <div className={`pointer-events-none absolute inset-0 z-10 ${uiHidden ? 'hidden' : ''}`}>
        <div
          className="pointer-events-none absolute left-0 top-0 p-3 sm:p-5 max-w-[calc(100%-3.5rem)]"
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          }}
        >
          <Header summary={summary} pointsData={geoData?.points ?? null} />
        </div>

        <div
          className="pointer-events-none absolute right-0 top-0 p-3 sm:p-5"
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
          }}
        >
          <PlacesMenu />
        </div>

        {/* 移动端：YearSlider 上方一行工具条（与右下 VisibilityToggle 同底） */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex sm:hidden items-center justify-between gap-2 px-3"
          style={{
            paddingBottom: 'calc(var(--safe-bottom) + var(--h-bottom-bar))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            // 右边留出 VisibilityToggle 宽度（h-9 = 2.25rem）+ gap
            paddingRight: 'calc(max(0.75rem, env(safe-area-inset-right)) + 2.25rem + var(--gap-stack))',
          }}
        >
          <div className="pointer-events-auto flex items-center gap-2">
            <LayerToggles />
            <FitAllButton />
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <ShareButton />
            <SettingsButton />
          </div>
        </div>

        {/* 底部：桌面放全套控件，移动端只放 YearSlider */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2 sm:p-3"
          style={{
            paddingBottom: 'var(--safe-bottom)',
            paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
          }}
        >
          <div className="hidden sm:flex items-end gap-2">
            <LayerToggles />
            <FitAllButton />
          </div>
          <YearSlider
            years={summary?.years ?? []}
            perYear={summary?.perYear ?? {}}
            start={yearStart}
            end={yearEnd}
            onChange={(s, e) => setYearRange(s, e)}
          />
          <div className="hidden sm:flex items-end gap-2">
            <ShareButton />
            <SettingsButton />
          </div>
        </div>
      </div>
    </div>
  );
}
