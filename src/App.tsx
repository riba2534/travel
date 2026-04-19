import { useEffect } from 'react';
import Map from './Map';
import Header from './components/Header';
import PlacesMenu from './components/PlacesMenu';
import YearSlider from './components/YearSlider';
import LayerToggles from './components/LayerToggles';
import FitAllButton from './components/FitAllButton';
import SettingsButton from './components/SettingsButton';
import VisibilityToggle from './components/VisibilityToggle';
import type { Places } from './lib/types';
import { useAppStore } from './state/store';

export default function App() {
  const summary = useAppStore((s) => s.summary);
  const setSummary = useAppStore((s) => s.setSummary);
  const setPlaces = useAppStore((s) => s.setPlaces);
  const yearStart = useAppStore((s) => s.yearStart);
  const yearEnd = useAppStore((s) => s.yearEnd);
  const setYearRange = useAppStore((s) => s.setYearRange);
  const uiHidden = useAppStore((s) => s.uiHidden);
  const setUiHidden = useAppStore((s) => s.setUiHidden);

  useEffect(() => {
    fetch('/data/summary.json')
      .then((r) => r.json())
      .then((s) => setSummary(s))
      .catch((e) => console.error('加载 summary.json 失败', e));
    fetch('/data/places.json')
      .then((r) => r.json() as Promise<Places>)
      .then((p) => setPlaces(p))
      .catch((e) => console.error('加载 places.json 失败', e));
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
      <Map
        bbox={summary?.bbox ?? null}
        yearStart={yearStart}
        yearEnd={yearEnd}
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
          <Header summary={summary} />
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

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 sm:gap-3 p-3 sm:p-5"
          style={{
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
          }}
        >
          <LayerToggles />
          <FitAllButton />
          <YearSlider
            years={summary?.years ?? []}
            perYear={summary?.perYear ?? {}}
            start={yearStart}
            end={yearEnd}
            onChange={(s, e) => setYearRange(s, e)}
          />
          <SettingsButton />
        </div>
      </div>
    </div>
  );
}
