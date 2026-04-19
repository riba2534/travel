// 年度报告嵌入的小地图：单 MapLibre 实例，按当前选中年份过滤点位 + 轨迹线 + 自适应 bbox。
// 轨迹线按 30min GAP 现场切段（与 build-data.ts 口径一致），不显示交互控件 / attribution。

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import { loadStyleForBasemap } from '../lib/mapStyle';
import { getTheme } from '../state/themes';
import { useAppStore } from '../state/store';
import type { PointFC } from '../lib/types';

interface Props {
  pointsData: PointFC;
  year: number;
}

export interface WrappedMapHandle {
  /** 取 MapLibre 实例，供父组件借用来导出分享图（可能为 null：加载中） */
  getMap(): MLMap | null;
}

const GAP_SEC = 1800; // 30 min，与 scripts/build-data.ts:GAP 口径一致

const WrappedMap = forwardRef<WrappedMapHandle, Props>(function WrappedMap(
  { pointsData, year },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const readyRef = useRef(false);
  const themeId = useAppStore((s) => s.themeId);

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
  }), []);

  // 初始化 / themeId 切换重建
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const theme = getTheme(themeId);

    (async () => {
      const style = await loadStyleForBasemap(theme.basemap, theme.cssVars.bg);
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
      });
      mapRef.current = map;

      map.on('load', () => {
        if (cancelled) return;

        // 轨迹线层（先加，显示在点之下）
        map.addSource('yr-track', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'yr-track-glow',
          type: 'line',
          source: 'yr-track',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': theme.map.track,
            'line-width': 3,
            'line-opacity': 0.28,
            'line-blur': 2,
          },
        });
        map.addLayer({
          id: 'yr-track-core',
          type: 'line',
          source: 'yr-track',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': theme.map.track,
            'line-width': 1.2,
            'line-opacity': 0.85,
          },
        });

        // 发光点层
        map.addSource('yr-points', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'yr-points-glow',
          type: 'circle',
          source: 'yr-points',
          paint: {
            'circle-radius': 5,
            'circle-color': theme.map.accent,
            'circle-opacity': 0.35,
            'circle-blur': 0.7,
          },
        });
        map.addLayer({
          id: 'yr-points-core',
          type: 'circle',
          source: 'yr-points',
          paint: {
            'circle-radius': 1.6,
            'circle-color': theme.map.accent,
            'circle-opacity': 0.95,
            'circle-stroke-color': theme.map.unclusteredStroke,
            'circle-stroke-width': 0.4,
          },
        });

        readyRef.current = true;
        updateYearData(map, pointsData, year);
      });
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId]);

  // 年份/数据变化时刷新
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    updateYearData(map, pointsData, year);
  }, [year, pointsData]);

  return <div ref={containerRef} className="h-full w-full" />;
});

export default WrappedMap;

function updateYearData(map: MLMap, pointsData: PointFC, year: number) {
  // UTC 年份的秒区间；避免 53k 次 Date 构造
  const startT = Math.floor(Date.UTC(year, 0, 1) / 1000);
  const endT = Math.floor(Date.UTC(year + 1, 0, 1) / 1000);

  const features = pointsData.features.filter(
    (f) => f.properties.t >= startT && f.properties.t < endT,
  );
  // points 已按 t 升序，filter 保留顺序即可

  const pointsSrc = map.getSource('yr-points') as maplibregl.GeoJSONSource | undefined;
  const trackSrc = map.getSource('yr-track') as maplibregl.GeoJSONSource | undefined;
  if (!pointsSrc || !trackSrc) return;

  pointsSrc.setData({ type: 'FeatureCollection', features });
  trackSrc.setData(buildYearTrack(features));

  if (features.length < 1) return;
  if (features.length === 1) {
    const [lon, lat] = features[0].geometry.coordinates as [number, number];
    map.jumpTo({ center: [lon, lat], zoom: 4 });
    return;
  }
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
  map.fitBounds(
    [[minLon, minLat], [maxLon, maxLat]],
    { padding: 24, animate: false, maxZoom: 6 },
  );
}

/** 按 30min GAP 把已过滤并按时间升序的点切段，生成 LineString FC */
function buildYearTrack(
  yearFeatures: PointFC['features'],
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const segments: Array<Array<[number, number]>> = [];
  let cur: Array<[number, number]> = [];
  let prevT = -Infinity;

  for (const f of yearFeatures) {
    const t = f.properties.t;
    const coord = f.geometry.coordinates as [number, number];
    if (t - prevT > GAP_SEC && cur.length > 0) {
      if (cur.length >= 2) segments.push(cur);
      cur = [];
    }
    cur.push(coord);
    prevT = t;
  }
  if (cur.length >= 2) segments.push(cur);

  return {
    type: 'FeatureCollection',
    features: segments.map((coords) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    })),
  };
}
