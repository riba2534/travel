import { useEffect, useState } from 'react';
import Map from './Map';
import Header from './components/Header';
import PlacesMenu from './components/PlacesMenu';
import YearSlider from './components/YearSlider';
import LayerToggles from './components/LayerToggles';
import FitAllButton from './components/FitAllButton';
import SettingsButton from './components/SettingsButton';
import VisibilityToggle from './components/VisibilityToggle';
import BootOverlay from './components/BootOverlay';
import type { Places, Summary, PointFC, TrackFC } from './lib/types';
import { useAppStore } from './state/store';
import { streamFetchJson, aggregateProgress } from './lib/fetch-progress';

const DATA_URLS = {
  summary: '/data/summary.json',
  places: '/data/places.json',
  points: '/data/points.geojson',
  track: '/data/track.geojson',
};

export default function App() {
  const summary = useAppStore((s) => s.summary);
  const setSummary = useAppStore((s) => s.setSummary);
  const setPlaces = useAppStore((s) => s.setPlaces);
  const yearStart = useAppStore((s) => s.yearStart);
  const yearEnd = useAppStore((s) => s.yearEnd);
  const setYearRange = useAppStore((s) => s.setYearRange);
  const uiHidden = useAppStore((s) => s.uiHidden);
  const setUiHidden = useAppStore((s) => s.setUiHidden);

  const [geoData, setGeoData] = useState<{ points: PointFC; track: TrackFC } | null>(null);
  const [progress, setProgress] = useState({ loaded: 0, total: 0, ratio: 0, done: false });

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
          className="pointer-events-none absolute left-0 top-0 p-3 sm:p-5"
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

        {/* 移动端：左下浮动控件组（图层 + 居中），避让底部 YearSlider bar */}
        <div
          className="pointer-events-none absolute left-0 bottom-0 flex sm:hidden flex-col items-start gap-2 p-3"
          style={{
            paddingBottom: 'calc(var(--safe-bottom) + var(--h-bottom-bar) + var(--gap-stack))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          }}
        >
          <LayerToggles />
          <FitAllButton />
        </div>

        {/* 移动端：右下 SettingsButton，避让 YearSlider bar + 上方 VisibilityToggle 一行 */}
        <div
          className="pointer-events-none absolute right-0 bottom-0 flex sm:hidden flex-col items-end gap-2 p-3"
          style={{
            paddingBottom: 'calc(var(--safe-bottom) + var(--h-bottom-bar) + var(--gap-stack) + var(--h-control-row))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
          }}
        >
          <SettingsButton />
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
          <div className="hidden sm:block">
            <SettingsButton />
          </div>
        </div>
      </div>
    </div>
  );
}
