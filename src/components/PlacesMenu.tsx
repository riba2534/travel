import { useMemo, useState } from 'react';
import { useAppStore } from '../state/store';
import type { PlaceContinent, PlaceCountry, PlaceCity } from '../lib/types';

export default function PlacesMenu() {
  const places = useAppStore((s) => s.places);
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);
  const clearFilter = useAppStore((s) => s.clearFilter);
  const flyTo = useAppStore((s) => s.flyTo);

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['AS', 'NA']));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!places) return null;
    const q = search.trim().toLowerCase();
    if (!q) return places.continents;
    return places.continents
      .map((cont) => {
        const countries = cont.countries
          .map((co) => {
            const matchCountry =
              co.name.toLowerCase().includes(q) ||
              co.nameEn.toLowerCase().includes(q) ||
              co.code.toLowerCase().includes(q);
            const cities = co.cities.filter((c) => c.name.toLowerCase().includes(q));
            if (matchCountry) return co;
            if (cities.length) return { ...co, cities };
            return null;
          })
          .filter(Boolean) as PlaceCountry[];
        if (countries.length === 0 && !cont.name.includes(q)) return null;
        return { ...cont, countries };
      })
      .filter(Boolean) as PlaceContinent[];
  }, [places, search]);

  if (!places || !filtered) return null;

  const hasFilter = !!(filter.countryCode || filter.cityName);
  const filterLabel = filter.cityName
    ? filter.cityName
    : findCountryName(places.continents, filter.countryCode);

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const onCountry = (co: PlaceCountry) => {
    flyTo({ bbox: co.bbox });
    setFilter({ countryCode: co.code });
    setDrawerOpen(false);
  };

  const onCity = (city: PlaceCity, co: PlaceCountry) => {
    flyTo({ lat: city.lat, lon: city.lon, zoom: 11 });
    setFilter({ countryCode: co.code, cityName: city.name });
    setDrawerOpen(false);
  };

  const list = (
    <div className="flex flex-col">
      <div
        className="sticky top-0 z-10 flex flex-col gap-1.5 p-2 border-b border-white/[0.06] backdrop-blur-md"
        style={{ background: 'var(--panel)' }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索国家地区 / 城市"
          className="w-full rounded-lg bg-white/5 px-2 py-1.5 text-xs text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
        {hasFilter && (
          <button
            type="button"
            onClick={clearFilter}
            className="flex items-center justify-between w-full rounded-lg bg-accent/15 px-2 py-1 text-[11px] text-accent hover:bg-accent/25 transition-colors"
          >
            <span className="truncate">筛选：{filterLabel}</span>
            <span className="ml-2">✕ 清除</span>
          </button>
        )}
      </div>

      <ul className="flex flex-col">
        {filtered.map((cont) => {
          const contOpen = expanded.has(cont.code);
          return (
            <li key={cont.code} className="border-b border-white/[0.04] last:border-b-0">
              <button
                type="button"
                onClick={() => toggleExpand(cont.code)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-white/[0.04]"
              >
                <span className="flex items-center gap-2">
                  <Chevron open={contOpen} />
                  <span className="font-medium text-text">{cont.name}</span>
                  <span className="text-[10px] text-text-dim">{cont.countries.length} 地</span>
                </span>
                <span className="font-mono tabular-nums text-[10px] text-text-dim">
                  {cont.count.toLocaleString()}
                </span>
              </button>

              {contOpen && (
                <ul className="pb-1">
                  {cont.countries.map((co) => {
                    const coKey = `${cont.code}/${co.code}/${co.nameEn}`;
                    const coOpen = expanded.has(coKey);
                    const isFiltered = filter.countryCode === co.code;
                    return (
                      <li key={coKey}>
                        <div
                          className={`flex items-stretch pl-5 pr-1 ${isFiltered ? 'bg-accent/[0.08]' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleExpand(coKey)}
                            aria-label={`${coOpen ? '折叠' : '展开'}${co.name}城市`}
                            className="flex items-center px-1 text-text-dim hover:text-text"
                          >
                            <Chevron open={coOpen} small />
                          </button>
                          <button
                            type="button"
                            onClick={() => onCountry(co)}
                            className="flex flex-1 items-center justify-between gap-2 px-1.5 py-1.5 text-left text-[11px] hover:bg-white/[0.04] rounded"
                          >
                            <span className="flex min-w-0 items-baseline gap-1.5">
                              <span className="truncate text-text">{co.name}</span>
                              {co.cities.length > 0 && (
                                <span className="shrink-0 font-mono tabular-nums text-[10px] text-text-dim">
                                  {co.cities.length} 城
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-mono tabular-nums text-[10px] text-accent/90">
                              {co.count.toLocaleString()}
                            </span>
                          </button>
                        </div>
                        {coOpen && co.cities.length > 0 && (
                          <ul className="pb-0.5">
                            {co.cities.map((city) => {
                              const isCityFilter =
                                filter.cityName === city.name && filter.countryCode === co.code;
                              return (
                                <li key={`${city.name}-${city.lat}-${city.lon}`}>
                                  <button
                                    type="button"
                                    onClick={() => onCity(city, co)}
                                    className={`flex w-full items-center justify-between gap-2 pl-12 pr-3 py-1 text-left text-[11px] transition-colors ${
                                      isCityFilter
                                        ? 'bg-accent/[0.15] text-text'
                                        : 'text-text-dim hover:bg-white/[0.04] hover:text-text'
                                    }`}
                                  >
                                    <span className="truncate">{city.name}</span>
                                    <span className="shrink-0 font-mono tabular-nums text-[10px] text-accent/80">
                                      {city.count.toLocaleString()}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {/* 移动端触发按钮 */}
        <button
          type="button"
          onClick={() => setDrawerOpen((o) => !o)}
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? '关闭地点菜单' : '打开地点菜单'}
          className="sm:hidden relative inline-flex h-11 min-w-[44px] items-center gap-1.5 rounded-2xl border border-white/[0.08] px-3 text-xs font-medium shadow-2xl backdrop-blur-md active:bg-white/5"
          style={{ background: 'var(--panel)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12z" />
            <circle cx="12" cy="9" r="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>地点</span>
          {hasFilter && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent" />}
        </button>

        {/* 桌面端固定列表 */}
        <div
          className="hidden sm:block w-[280px] max-h-[72dvh] overflow-y-auto rounded-2xl border border-white/[0.08] shadow-2xl backdrop-blur-md"
          style={{ background: 'var(--panel)' }}
        >
          {list}
        </div>
      </div>

      {/* 移动端底部 sheet：高于 VisibilityToggle(z-55)，低于 WrappedStory(z-65) / BootOverlay(z-70) */}
      {drawerOpen && (
        <div
          className="sm:hidden pointer-events-auto fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="地点菜单"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[sheet-fade_200ms_ease-out_forwards]"
            aria-hidden="true"
          />
          {/* sheet body：从底部滑起 */}
          <div
            className="absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-2xl border-t border-white/[0.08] shadow-2xl overflow-hidden animate-[sheet-up_260ms_cubic-bezier(0.2,0.8,0.2,1)_forwards]"
            style={{
              background: 'var(--panel)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* handle */}
            <div className="flex items-center justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
            </div>
            {/* header with close */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
              <span className="text-xs font-medium text-text">国家和地区 · 城市</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="关闭"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-dim hover:text-text hover:bg-white/5"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">{list}</div>
          </div>

          <style>{`
            @keyframes sheet-up {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            @keyframes sheet-fade {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

function Chevron({ open, small = false }: { open: boolean; small?: boolean }) {
  const size = small ? 10 : 12;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`text-text-dim transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </svg>
  );
}

function findCountryName(continents: PlaceContinent[], code?: string): string {
  if (!code) return '';
  for (const cont of continents) {
    for (const co of cont.countries) {
      if (co.code === code) return co.name;
    }
  }
  return code;
}
