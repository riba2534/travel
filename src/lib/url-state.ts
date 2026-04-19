// 把「筛选/图层/年份」状态同步到 URL hash，让分享的链接可复现视图。
// themeId 不同步（存 localStorage 即可，避免强加自己的主题给访问者）。

import type { Filter, LayerVisibility } from '../state/store';

export interface SyncableState {
  yearStart: number | null;
  yearEnd: number | null;
  filter: Filter;
  layers: LayerVisibility;
}

export interface DecodedState {
  yearStart?: number;
  yearEnd?: number;
  filter?: Filter;
  layers?: LayerVisibility;
}

const DEFAULT_LAYERS: LayerVisibility = { points: true, heatmap: false, track: false };

/** 把状态编码为 hash 字符串（含前导 #，空字符串表示无需 hash）
 *  defaults.year*：和当前 yearStart/yearEnd 相等则视为"未筛选"，不写入 hash。
 */
export function encodeState(
  s: SyncableState,
  defaults?: { yearStart: number | null; yearEnd: number | null },
): string {
  const parts: string[] = [];

  if (s.yearStart != null && s.yearEnd != null) {
    const atYearDefault =
      defaults != null &&
      s.yearStart === defaults.yearStart &&
      s.yearEnd === defaults.yearEnd;
    if (!atYearDefault) {
      parts.push(s.yearStart === s.yearEnd ? `y=${s.yearStart}` : `y=${s.yearStart}-${s.yearEnd}`);
    }
  }
  if (s.filter.countryCode) parts.push(`c=${s.filter.countryCode}`);
  if (s.filter.cityName) parts.push(`city=${encodeURIComponent(s.filter.cityName)}`);

  const keys: Array<keyof LayerVisibility> = ['points', 'heatmap', 'track'];
  const differsFromDefault = keys.some((k) => s.layers[k] !== DEFAULT_LAYERS[k]);
  if (differsFromDefault) {
    const on = keys.filter((k) => s.layers[k]);
    parts.push(`layers=${on.join(',') || 'none'}`);
  }

  return parts.length ? `#${parts.join('&')}` : '';
}

/** 反向解析 hash。宽松容错：非法字段直接忽略，不抛错。 */
export function decodeState(hash: string): DecodedState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return {};

  const params = new URLSearchParams(raw);
  const out: DecodedState = {};

  const y = params.get('y');
  if (y) {
    const m = y.match(/^(\d{4})(?:-(\d{4}))?$/);
    if (m) {
      const a = Number(m[1]);
      const b = m[2] != null ? Number(m[2]) : a;
      out.yearStart = Math.min(a, b);
      out.yearEnd = Math.max(a, b);
    }
  }

  const c = params.get('c');
  const city = params.get('city');
  if (c || city) {
    out.filter = {};
    if (c && /^[A-Z]{2}$/i.test(c)) out.filter.countryCode = c.toUpperCase();
    if (city) {
      try {
        out.filter.cityName = decodeURIComponent(city);
      } catch {
        // 忽略非法编码
      }
    }
  }

  const layers = params.get('layers');
  if (layers !== null) {
    const set = new Set(layers.split(',').filter(Boolean));
    out.layers = {
      points: set.has('points'),
      heatmap: set.has('heatmap'),
      track: set.has('track'),
    };
  }

  return out;
}

/** 把 hash 写回地址栏。用 replaceState 避免污染历史记录 + 避免触发 hashchange */
export function writeHash(hash: string): void {
  const current = window.location.hash;
  if (current === hash) return;
  const next = window.location.pathname + window.location.search + hash;
  window.history.replaceState(null, '', next);
}
