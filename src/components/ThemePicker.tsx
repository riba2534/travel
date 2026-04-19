import { useAppStore } from '../state/store';
import { THEMES, themeSwatch } from '../state/themes';

export default function ThemePicker() {
  const themeId = useAppStore((s) => s.themeId);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-text-dim">选择一套主题，实时生效。</p>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((t) => {
          const sw = themeSwatch(t);
          const active = t.id === themeId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              aria-pressed={active}
              className={`flex items-center gap-3 rounded-xl border p-2 text-left transition-all ${
                active
                  ? 'border-accent bg-accent/10'
                  : 'border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.03]'
              }`}
            >
              <div
                className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/10"
                aria-hidden="true"
                style={{ background: sw.bg }}
              >
                <div className="flex h-full items-end gap-[2px] p-[3px]">
                  <span className="flex-1 rounded-sm" style={{ background: sw.accent, height: '60%' }} />
                  <span className="flex-1 rounded-sm" style={{ background: sw.track, height: '90%' }} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-text">{t.name}</div>
                <div className="truncate text-[10px] text-text-dim">
                  {t.mode === 'dark' ? '深色' : '明色'} · {basemapLabel(t.basemap)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function basemapLabel(kind: string): string {
  switch (kind) {
    case 'openfreemap-dark':
      return 'OpenFreeMap';
    case 'openfreemap-liberty':
      return 'Liberty';
    case 'carto-dark':
      return 'Carto 暗';
    case 'carto-voyager':
      return 'Carto 航海';
    default:
      return kind;
  }
}
