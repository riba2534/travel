// 年度报告嵌入的小地图：单 MapLibre 实例，按当前选中年份过滤点位 + 自适应 bbox。
// 不显示交互控件、attribution、轨迹线；只画发光点位，风格与分享图一致。

import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import { loadStyleForBasemap } from '../lib/mapStyle';
import { getTheme } from '../state/themes';
import { useAppStore } from '../state/store';
import type { PointFC } from '../lib/types';

interface Props {
  pointsData: PointFC;
  year: number;
}

export default function WrappedMap({ pointsData, year }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const readyRef = useRef(false);
  const themeId = useAppStore((s) => s.themeId);

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
}

function updateYearData(map: MLMap, pointsData: PointFC, year: number) {
  const features = pointsData.features.filter((f) => {
    const d = new Date(f.properties.t * 1000);
    return d.getUTCFullYear() === year;
  });
  const src = map.getSource('yr-points') as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  src.setData({ type: 'FeatureCollection', features });

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
