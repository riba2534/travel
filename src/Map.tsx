import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap, Popup, GeoJSONSource } from 'maplibre-gl';
import { STYLE_URL, patchStyleForChinese, fallbackDarkMatterStyle } from './lib/mapStyle';
import type { Mode } from './lib/types';

interface Props {
  bbox: [number, number, number, number] | null;
  mode: Mode;
  yearStart: number | null;
  yearEnd: number | null;
}

const ACCENT = '#F59E0B';
const TRACK = '#22D3EE';

type PointFeature = GeoJSON.Feature<GeoJSON.Point, { t: number; ele?: number }>;
type PointFC = GeoJSON.FeatureCollection<GeoJSON.Point, { t: number; ele?: number }>;

export default function Map({ bbox, mode, yearStart, yearEnd }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const allPointsRef = useRef<PointFC | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const bboxRef = useRef<typeof bbox>(null);
  const fittedRef = useRef(false);
  bboxRef.current = bbox;

  // 初始化 map
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;
    let mapInstance: MLMap | null = null;

    (async () => {
      // 1. 拉取并中文化 style，失败兜底 CartoDB raster
      let style: import('maplibre-gl').StyleSpecification;
      try {
        const r = await fetch(STYLE_URL, { mode: 'cors' });
        if (!r.ok) throw new Error(`style ${r.status}`);
        const raw = (await r.json()) as import('maplibre-gl').StyleSpecification;
        style = patchStyleForChinese(raw);
      } catch (e) {
        console.warn('[map] OpenFreeMap 加载失败，降级到 CartoDB DarkMatter:', e);
        style = fallbackDarkMatterStyle;
      }
      if (cancelled || !mapEl.current) return;

      // 2. 创建地图
      const map = new maplibregl.Map({
        container: mapEl.current,
        style,
        center: [105, 35],
        zoom: 1.6,
        minZoom: 1,
        maxZoom: 18,
        attributionControl: { compact: true },
        cooperativeGestures: false,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
      });
      mapInstance = map;

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
        'bottom-left',
      );

      map.on('load', async () => {
        // 数据
        const pointsRes = (await fetch('/data/points.geojson').then((r) => r.json())) as PointFC;
        if (cancelled) return;
        allPointsRef.current = pointsRes;

        // track
        map.addSource('track', { type: 'geojson', data: '/data/track.geojson' });
        map.addLayer({
          id: 'track-line',
          type: 'line',
          source: 'track',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': TRACK,
            'line-opacity': 0.5,
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              2, 0.4, 6, 0.8, 12, 2, 16, 3.5,
            ],
            'line-blur': 0.5,
          },
        });

        // points
        map.addSource('points', {
          type: 'geojson',
          data: pointsRes,
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 50,
        });

        map.addLayer({
          id: 'heatmap',
          type: 'heatmap',
          source: 'points',
          maxzoom: 14,
          layout: { visibility: 'none' },
          paint: {
            'heatmap-weight': 0.6,
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 9, 2.5],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.1, 'rgba(34,211,238,0.4)',
              0.3, 'rgba(245,158,11,0.6)',
              0.6, 'rgba(239,68,68,0.8)',
              1, 'rgba(255,255,255,0.95)',
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 9, 30],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 11, 1, 14, 0],
          },
        });

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'points',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': ACCENT,
            'circle-opacity': 0.78,
            'circle-blur': 0.35,
            'circle-stroke-color': '#FBBF24',
            'circle-stroke-width': 1.5,
            'circle-stroke-opacity': 0.5,
            'circle-radius': [
              'step', ['get', 'point_count'],
              14, 50, 18, 200, 24, 1000, 32, 5000, 42, 20000, 54,
            ],
          },
        });

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'points',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 12,
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#0A0A0F',
            'text-halo-color': '#FBBF24',
            'text-halo-width': 0.5,
          },
        });

        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'points',
          filter: ['!', ['has', 'point_count']],
          minzoom: 9,
          paint: {
            'circle-color': ACCENT,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 14, 4, 18, 6],
            'circle-stroke-color': '#fff',
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 0, 14, 0.8],
            'circle-blur': 0.15,
          },
        });

        // 交互
        map.on('click', 'clusters', async (e) => {
          const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
          if (!f) return;
          const id = (f.properties as { cluster_id: number }).cluster_id;
          const src = map.getSource('points') as GeoJSONSource;
          const z = await src.getClusterExpansionZoom(id);
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          map.easeTo({ center: coords, zoom: Math.min(z + 0.2, 17), duration: 600 });
        });

        map.on('click', 'unclustered-point', (e) => {
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
              <div style="color:#71717A;font-size:11px;margin-bottom:4px">UTC 时间</div>
              <div style="color:#F4F4F5;font-size:13px;font-weight:500;margin-bottom:8px;font-variant-numeric:tabular-nums">${dateStr}</div>
              <div style="display:grid;grid-template-columns:auto auto;gap:4px 12px;font-size:12px">
                <span style="color:#71717A">坐标</span>
                <span style="color:#F4F4F5;font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums">${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}</span>
                ${props.ele !== undefined ? `<span style="color:#71717A">海拔</span><span style="color:#F4F4F5;font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums">${props.ele} m</span>` : ''}
              </div>
            </div>`;
          popupRef.current?.remove();
          popupRef.current = new Popup({ offset: 12, closeButton: true, closeOnClick: true })
            .setLngLat(coords)
            .setHTML(html)
            .addTo(map);
        });

        for (const layer of ['clusters', 'unclustered-point']) {
          map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
        }

        mapRef.current = map;
        (window as unknown as { __map: MLMap }).__map = map;

        // map 加载完，若 bbox 已就绪立刻 fit
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
      delete (window as unknown as { __map?: MLMap }).__map;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // bbox 后到达 → fit（已 fit 过则跳过）
  useEffect(() => {
    if (!bbox || !mapRef.current || fittedRef.current) return;
    const map = mapRef.current;
    map.fitBounds(
      [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
      { padding: { top: 100, bottom: 160, left: 40, right: 40 }, duration: 1200, maxZoom: 4 },
    );
    fittedRef.current = true;
  }, [bbox]);

  // mode 切换
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('heatmap')) return;
    const isHeat = mode === 'heatmap';
    map.setLayoutProperty('heatmap', 'visibility', isHeat ? 'visible' : 'none');
    map.setLayoutProperty('clusters', 'visibility', isHeat ? 'none' : 'visible');
    map.setLayoutProperty('cluster-count', 'visibility', isHeat ? 'none' : 'visible');
    map.setLayoutProperty('unclustered-point', 'visibility', isHeat ? 'none' : 'visible');
  }, [mode]);

  // 年份过滤
  useEffect(() => {
    const map = mapRef.current;
    const all = allPointsRef.current;
    if (!map || !all) return;
    if (yearStart === null || yearEnd === null) return;

    const start = Math.floor(Date.UTC(yearStart, 0, 1) / 1000);
    const end = Math.floor(Date.UTC(yearEnd + 1, 0, 1) / 1000);

    const filtered: PointFC = {
      type: 'FeatureCollection',
      features: all.features.filter((f) => f.properties.t >= start && f.properties.t < end),
    };

    const src = map.getSource('points') as GeoJSONSource | undefined;
    if (src) src.setData(filtered);
  }, [yearStart, yearEnd]);

  return <div ref={mapEl} className="absolute inset-0 w-full h-full" />;
}
