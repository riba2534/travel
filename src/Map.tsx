import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap, Popup, GeoJSONSource } from 'maplibre-gl';
import {
  patchStyleForChinese,
  basemapStyleUrl,
  makeCartoRasterStyle,
} from './lib/mapStyle';
import { useAppStore, type Filter } from './state/store';
import { getTheme, type Theme } from './state/themes';
import {
  applyThemeCssVars,
  applyThemePaintInPlace,
  mergeWithCustom,
  type PopupRef,
} from './state/theme-apply';
import type { Places } from './lib/types';

interface Props {
  bbox: [number, number, number, number] | null;
  yearStart: number | null;
  yearEnd: number | null;
}

type PointFeature = GeoJSON.Feature<GeoJSON.Point, { t: number; ele?: number }>;
type PointFC = GeoJSON.FeatureCollection<GeoJSON.Point, { t: number; ele?: number }>;
type TrackFC = GeoJSON.FeatureCollection<GeoJSON.MultiLineString, Record<string, never>>;

// ---- filter util ----
function resolveFilterBounds(
  filter: Filter,
  places: Places | null,
): { bbox: [number, number, number, number] | null; cityCenter: { lat: number; lon: number } | null } {
  if (!filter.countryCode || !places) return { bbox: null, cityCenter: null };
  for (const cont of places.continents) {
    for (const co of cont.countries) {
      if (co.code !== filter.countryCode) continue;
      let cityCenter: { lat: number; lon: number } | null = null;
      if (filter.cityName) {
        const c = co.cities.find((x) => x.name === filter.cityName);
        if (c) cityCenter = { lat: c.lat, lon: c.lon };
      }
      return { bbox: co.bbox, cityCenter };
    }
  }
  return { bbox: null, cityCenter: null };
}

const CITY_RADIUS_DEG = 0.5;

function applyPointsFilter(
  all: PointFC,
  yearStart: number,
  yearEnd: number,
  filter: Filter,
  places: Places | null,
): PointFC {
  const start = Math.floor(Date.UTC(yearStart, 0, 1) / 1000);
  const end = Math.floor(Date.UTC(yearEnd + 1, 0, 1) / 1000);
  const { bbox, cityCenter } = resolveFilterBounds(filter, places);
  const r2 = CITY_RADIUS_DEG * CITY_RADIUS_DEG;

  return {
    type: 'FeatureCollection',
    features: all.features.filter((f) => {
      if (f.properties.t < start || f.properties.t >= end) return false;
      const [lon, lat] = f.geometry.coordinates;
      if (bbox && (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3])) return false;
      if (cityCenter) {
        const dx = lon - cityCenter.lon;
        const dy = lat - cityCenter.lat;
        if (dx * dx + dy * dy > r2) return false;
      }
      return true;
    }),
  };
}

function applyTrackFilter(all: TrackFC, filter: Filter, places: Places | null): TrackFC {
  const { bbox, cityCenter } = resolveFilterBounds(filter, places);
  if (!bbox && !cityCenter) return all;
  const r2 = CITY_RADIUS_DEG * CITY_RADIUS_DEG;

  const filteredSegs: number[][][] = [];
  for (const feat of all.features) {
    for (const seg of feat.geometry.coordinates) {
      const hit = seg.some(([lon, lat]) => {
        if (bbox && (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3])) return false;
        if (cityCenter) {
          const dx = lon - cityCenter.lon;
          const dy = lat - cityCenter.lat;
          if (dx * dx + dy * dy > r2) return false;
        }
        return true;
      });
      if (hit) filteredSegs.push(seg);
    }
  }

  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: filteredSegs }, properties: {} },
    ],
  };
}

// ---- event binding（每次 setStyle 后必须重绑）----
function bindMapEvents(map: MLMap, popupRef: PopupRef): void {
  // 点击点位（只在较高 zoom 时有意义，低 zoom 点太密 点击落在哪个点不确定，仍然允许点）
  const onPointClick = (e: maplibregl.MapLayerMouseEvent) => {
    const f = e.features?.[0] as PointFeature | undefined;
    if (!f) return;
    const coords = f.geometry.coordinates.slice() as [number, number];
    const props = f.properties;
    const date = new Date(props.t * 1000);
    const dateStr = date.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'UTC',
    });
    const html = `
      <div style="font-family:Inter,sans-serif;line-height:1.5;min-width:160px">
        <div style="color:var(--text-dim,#71717A);font-size:11px;margin-bottom:4px">UTC 时间</div>
        <div style="color:var(--text,#F4F4F5);font-size:13px;font-weight:500;margin-bottom:8px;font-variant-numeric:tabular-nums">${dateStr}</div>
        <div style="display:grid;grid-template-columns:auto auto;gap:4px 12px;font-size:12px">
          <span style="color:var(--text-dim,#71717A)">坐标</span>
          <span style="color:var(--text,#F4F4F5);font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums">${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}</span>
          ${props.ele !== undefined ? `<span style="color:var(--text-dim,#71717A)">海拔</span><span style="color:var(--text,#F4F4F5);font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums">${props.ele} m</span>` : ''}
        </div>
      </div>`;
    popupRef.current?.remove();
    popupRef.current = new Popup({ offset: 12, closeButton: true, closeOnClick: true })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);
  };

  map.on('click', 'points-core', onPointClick);
  // zoom < 10 时 core 较小，叠击靠 glow 也能点到
  map.on('click', 'points-glow', onPointClick);

  for (const layer of ['points-core', 'points-glow']) {
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = '';
    });
  }
}

async function loadBaseStyle(theme: Theme): Promise<maplibregl.StyleSpecification> {
  const url = basemapStyleUrl(theme.basemap);
  if (url) {
    try {
      const r = await fetch(url, { mode: 'cors' });
      if (!r.ok) throw new Error(`style ${r.status}`);
      const raw = (await r.json()) as maplibregl.StyleSpecification;
      return patchStyleForChinese(raw);
    } catch (e) {
      console.warn(`[map] ${theme.basemap} 加载失败，降级到 Carto:`, e);
    }
  }
  if (theme.basemap === 'carto-voyager') return makeCartoRasterStyle('voyager', theme.cssVars.bg);
  return makeCartoRasterStyle('dark', theme.cssVars.bg);
}

export default function Map({ bbox, yearStart, yearEnd }: Props) {
  const layers = useAppStore((s) => s.layers);
  const filter = useAppStore((s) => s.filter);
  const places = useAppStore((s) => s.places);
  const flyTarget = useAppStore((s) => s.flyTarget);
  const themeId = useAppStore((s) => s.themeId);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const allPointsRef = useRef<PointFC | null>(null);
  const allTrackRef = useRef<TrackFC | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const bboxRef = useRef<typeof bbox>(null);
  const fittedRef = useRef(false);
  const lastThemeIdRef = useRef<string | null>(null);
  bboxRef.current = bbox;

  // 把过滤后的 data 推到 map sources
  const pushFilteredData = (map: MLMap) => {
    const allPts = allPointsRef.current;
    const allTrack = allTrackRef.current;
    if (!allPts || !allTrack) return;
    const st = useAppStore.getState();
    if (st.yearStart === null || st.yearEnd === null) return;
    const ptsFiltered = applyPointsFilter(allPts, st.yearStart, st.yearEnd, st.filter, st.places);
    const trackFiltered = applyTrackFilter(allTrack, st.filter, st.places);
    const psrc = map.getSource('points') as GeoJSONSource | undefined;
    if (psrc) psrc.setData(ptsFiltered);
    const tsrc = map.getSource('track') as GeoJSONSource | undefined;
    if (tsrc) tsrc.setData(trackFiltered);
  };

  // 初始化 map
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;
    let mapInstance: MLMap | null = null;

    (async () => {
      const initTheme = getTheme(useAppStore.getState().themeId);
      lastThemeIdRef.current = initTheme.id;
      applyThemeCssVars(initTheme);

      const [baseStyle, pointsRes, trackRes] = await Promise.all([
        loadBaseStyle(initTheme),
        fetch('/data/points.geojson').then((r) => r.json()) as Promise<PointFC>,
        fetch('/data/track.geojson').then((r) => r.json()) as Promise<TrackFC>,
      ]);
      if (cancelled || !mapEl.current) return;

      allPointsRef.current = pointsRes;
      allTrackRef.current = trackRes;

      // 一次性把底图 + 自定义 layer 合并成完整 style
      const initLayers = useAppStore.getState().layers;
      const fullStyle = mergeWithCustom(baseStyle, initTheme, initLayers, pointsRes, trackRes);

      const map = new maplibregl.Map({
        container: mapEl.current,
        style: fullStyle,
        center: [105, 35],
        zoom: 1.6,
        minZoom: 1,
        maxZoom: 18,
        attributionControl: { compact: true },
        cooperativeGestures: false,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
        preserveDrawingBuffer: true,
      });
      mapInstance = map;

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
        'bottom-left',
      );

      map.on('load', () => {
        if (cancelled) return;
        bindMapEvents(map, popupRef);
        // 应用年份/filter
        pushFilteredData(map);

        mapRef.current = map;
        (window as unknown as { __map: MLMap }).__map = map;

        if (bboxRef.current && !fittedRef.current) {
          const b = bboxRef.current;
          map.fitBounds(
            [[b[0], b[1]], [b[2], b[3]]],
            { padding: { top: 100, bottom: 160, left: 40, right: 40 }, duration: 1200, maxZoom: 4 },
          );
          fittedRef.current = true;
        }
      });
    })();

    return () => {
      cancelled = true;
      mapInstance?.remove();
      mapRef.current = null;
      allPointsRef.current = null;
      allTrackRef.current = null;
      delete (window as unknown as { __map?: MLMap }).__map;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // bbox 后到达 → fit
  useEffect(() => {
    if (!bbox || !mapRef.current || fittedRef.current) return;
    const map = mapRef.current;
    map.fitBounds(
      [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
      { padding: { top: 100, bottom: 160, left: 40, right: 40 }, duration: 1200, maxZoom: 4 },
    );
    fittedRef.current = true;
  }, [bbox]);

  // 图层显隐
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('heatmap')) return;
    map.setLayoutProperty('heatmap', 'visibility', layers.heatmap ? 'visible' : 'none');
    for (const id of ['points-glow', 'points-core']) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', layers.points ? 'visible' : 'none');
      }
    }
    if (map.getLayer('track-line')) {
      map.setLayoutProperty('track-line', 'visibility', layers.track ? 'visible' : 'none');
    }
  }, [layers.points, layers.heatmap, layers.track]);

  // 年份 + filter
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('points')) return;
    pushFilteredData(map);
  }, [yearStart, yearEnd, filter, places]); // eslint-disable-line react-hooks/exhaustive-deps

  // flyTo
  useEffect(() => {
    if (!flyTarget) return;
    const map = mapRef.current;
    if (!map) return;
    if (flyTarget.bbox) {
      const b = flyTarget.bbox;
      map.fitBounds(
        [[b[0], b[1]], [b[2], b[3]]],
        { padding: { top: 100, bottom: 160, left: 40, right: 40 }, duration: 1200, maxZoom: 6 },
      );
    } else if (flyTarget.lat !== undefined && flyTarget.lon !== undefined) {
      map.flyTo({
        center: [flyTarget.lon, flyTarget.lat],
        zoom: flyTarget.zoom ?? 11,
        duration: 1400,
        essential: true,
      });
    }
  }, [flyTarget]);

  // 主题切换
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const theme = getTheme(themeId);
    const prevId = lastThemeIdRef.current;
    const prevTheme = prevId ? getTheme(prevId) : null;
    lastThemeIdRef.current = themeId;

    const sameBasemap = prevTheme && prevTheme.basemap === theme.basemap;
    if (sameBasemap) {
      applyThemePaintInPlace(map, theme);
      return;
    }

    // 跨 basemap：异步加载新底图 style + 合并自定义 layer，setStyle 一次完成
    let cancelled = false;
    (async () => {
      applyThemeCssVars(theme);
      const baseStyle = await loadBaseStyle(theme);
      if (cancelled) return;
      const pointsData = allPointsRef.current;
      const trackData = allTrackRef.current;
      if (!pointsData || !trackData) return;
      const curLayers = useAppStore.getState().layers;
      const fullStyle = mergeWithCustom(baseStyle, theme, curLayers, pointsData, trackData);
      map.setStyle(fullStyle, { diff: false });
      // setStyle 会触发 style.load，事件处理器会被清空需要重绑
      const onStyleLoad = () => {
        map.off('style.load', onStyleLoad);
        bindMapEvents(map, popupRef);
        pushFilteredData(map);
      };
      map.on('style.load', onStyleLoad);
      // 兜底：若 style 已经 loaded（极少数时序），1s 后若还没绑事件，手动调
      setTimeout(() => {
        if (map.isStyleLoaded() && !map.listens('click')) {
          onStyleLoad();
        }
      }, 1000);
    })();

    return () => {
      cancelled = true;
    };
  }, [themeId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mapEl} className="absolute inset-0 w-full h-full" />;
}
