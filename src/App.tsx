import { useEffect, useRef, useState } from 'react';
import Map from './Map';
import Header from './components/Header';
import CityList from './components/CityList';
import YearSlider from './components/YearSlider';
import ModeToggle from './components/ModeToggle';
import type { Mode, Summary, City } from './lib/types';

export default function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [mode, setMode] = useState<Mode>('points');
  const [yearStart, setYearStart] = useState<number | null>(null);
  const [yearEnd, setYearEnd] = useState<number | null>(null);
  const [flyToCity, setFlyToCity] = useState<City | null>(null);
  const flyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    fetch('/data/summary.json')
      .then((r) => r.json() as Promise<Summary>)
      .then((s) => {
        setSummary(s);
        setYearStart(s.years[0]);
        setYearEnd(s.years[s.years.length - 1]);
      })
      .catch((e) => console.error('加载 summary.json 失败', e));
  }, []);

  useEffect(() => {
    if (!flyToCity) return;
    window.dispatchEvent(new CustomEvent('flyTo', { detail: flyToCity }));
    if (flyTimerRef.current) window.clearTimeout(flyTimerRef.current);
    flyTimerRef.current = window.setTimeout(() => setFlyToCity(null), 100);
  }, [flyToCity]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg text-text">
      <Map
        bbox={summary?.bbox ?? null}
        mode={mode}
        yearStart={yearStart}
        yearEnd={yearEnd}
      />

      {/* 浮窗层 - 不阻挡地图拖动 */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* 顶部左：合并的 Header（标题 + 统计）*/}
        <div
          className="pointer-events-none absolute left-0 top-0 p-3 sm:p-5"
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          }}
        >
          <Header summary={summary} />
        </div>

        {/* 顶部右：城市列表 */}
        <div
          className="pointer-events-none absolute right-0 top-0 p-3 sm:p-5"
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
          }}
        >
          <CityList
            cities={summary?.topCities ?? []}
            onSelect={(c) => setFlyToCity(c)}
          />
        </div>

        {/* 底部：模式切换 + 年份滑块 */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 sm:gap-3 p-3 sm:p-5"
          style={{
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
          }}
        >
          <ModeToggle mode={mode} onChange={setMode} />
          <YearSlider
            years={summary?.years ?? []}
            perYear={summary?.perYear ?? {}}
            start={yearStart}
            end={yearEnd}
            onChange={(s, e) => { setYearStart(s); setYearEnd(e); }}
          />
        </div>
      </div>

      <FlyToBridge />
    </div>
  );
}

function FlyToBridge() {
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<City>;
      const map = (window as unknown as { __map?: import('maplibre-gl').Map }).__map;
      if (!map) return;
      map.flyTo({
        center: [ce.detail.lon, ce.detail.lat],
        zoom: 11,
        duration: 1400,
        essential: true,
      });
    };
    window.addEventListener('flyTo', handler);
    return () => window.removeEventListener('flyTo', handler);
  }, []);
  return null;
}
