// SettingsPanel 分享 tab 的内容：控制 ShareButton 一键出图时显示哪些内容。
// 修改这里的默认值会影响下一次点「生成分享图」的输出。

import {
  useAppStore,
  type ShareOptions,
  type SharePointSize,
  type ShareToggleKey,
  type ShareTrackWidth,
} from '../state/store';

const LAYER_OPTS: Array<{ key: ShareToggleKey; label: string; hint: string }> = [
  { key: 'showPoints', label: '轨迹点', hint: '发光的点位层（默认开）' },
  { key: 'showTrack', label: '轨迹线', hint: '连续路径线' },
  { key: 'showHeatmap', label: '热力图', hint: '密度叠加层' },
];

const TEXT_OPTS: Array<{ key: ShareToggleKey; label: string; hint: string }> = [
  { key: 'title', label: '标题', hint: '左上角「HPCのJourneys」' },
  { key: 'stats', label: '关键统计', hint: 'km / 城市 / 点 / 年份' },
  { key: 'date', label: '签名 + 日期', hint: '右下角品牌 + 生成日期' },
];

const POINT_SIZE_OPTS: Array<{ value: SharePointSize; label: string; hint: string }> = [
  { value: 'fine', label: '精细', hint: '更接近真实点位' },
  { value: 'standard', label: '标准', hint: '减少区域遮挡' },
  { value: 'bold', label: '醒目', hint: '当前默认大小' },
  { value: 'poster', label: '海报', hint: '最强视觉效果' },
];

const TRACK_WIDTH_OPTS: Array<{ value: ShareTrackWidth; label: string; hint: string }> = [
  { value: 'thin', label: '细线', hint: '轻量路径' },
  { value: 'standard', label: '标准', hint: '当前默认粗细' },
  { value: 'bold', label: '粗线', hint: '强调路线' },
  { value: 'poster', label: '海报', hint: '最强路径存在感' },
];

export default function ShareSettings() {
  const shareOpts = useAppStore((s) => s.shareOpts);
  const setShareOpt = useAppStore((s) => s.setShareOpt);
  const setShareDateRange = useAppStore((s) => s.setShareDateRange);
  const setShareStyle = useAppStore((s) => s.setShareStyle);
  const dateRangeEnabled = shareOpts.dateRangeEnabled ?? false;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-text-dim leading-relaxed">
        设置点击底栏分享按钮时渲染的内容。默认适合直接保存或发社交平台。
      </p>

      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
          旅行时间范围
        </div>
        <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--ui-hover)]">
          <input
            type="checkbox"
            checked={dateRangeEnabled}
            onChange={(e) => setShareDateRange({ dateRangeEnabled: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-[var(--ui-border)] bg-transparent accent-accent"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-text">只导出指定日期</div>
            <div className="text-[10px] text-text-dim">
              只筛选该时间段内的点；勾选路径图层时会生成该段线。
            </div>
          </div>
        </label>

        <div className={`grid grid-cols-2 gap-2 ${dateRangeEnabled ? '' : 'opacity-45'}`}>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] text-text-dim">开始日期</span>
            <input
              type="date"
              value={shareOpts.dateStart ?? ''}
              max={shareOpts.dateEnd || undefined}
              disabled={!dateRangeEnabled}
              onChange={(e) => setShareDateRange({ dateStart: e.target.value })}
              className="map-input w-full px-2 text-xs disabled:cursor-not-allowed"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] text-text-dim">结束日期</span>
            <input
              type="date"
              value={shareOpts.dateEnd ?? ''}
              min={shareOpts.dateStart || undefined}
              disabled={!dateRangeEnabled}
              onChange={(e) => setShareDateRange({ dateEnd: e.target.value })}
              className="map-input w-full px-2 text-xs disabled:cursor-not-allowed"
            />
          </label>
        </div>
      </div>

      <Group title="地图图层" opts={LAYER_OPTS} values={shareOpts} onChange={setShareOpt} />

      <ChoiceGroup
        title="点位大小"
        value={shareOpts.pointSize ?? 'bold'}
        opts={POINT_SIZE_OPTS}
        onChange={(pointSize) => setShareStyle({ pointSize })}
      />

      <ChoiceGroup
        title="轨迹线粗细"
        value={shareOpts.trackWidth ?? 'standard'}
        opts={TRACK_WIDTH_OPTS}
        onChange={(trackWidth) => setShareStyle({ trackWidth })}
      />

      <Group title="文字叠加" opts={TEXT_OPTS} values={shareOpts} onChange={setShareOpt} />
    </div>
  );
}

function ChoiceGroup<T extends string>({
  title,
  value,
  opts,
  onChange,
}: {
  title: string;
  value: T;
  opts: Array<{ value: T; label: string; hint: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">{title}</div>
      <div className="grid grid-cols-2 gap-2">
        {opts.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              className="min-h-12 rounded-md border px-2 py-1.5 text-left transition-colors"
              style={{
                borderColor: active ? 'var(--accent)' : 'var(--ui-border)',
                background: active
                  ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
                  : 'transparent',
              }}
            >
              <span className="block text-xs font-medium text-text">{opt.label}</span>
              <span className="block text-[10px] leading-snug text-text-dim">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Group({
  title,
  opts,
  values,
  onChange,
}: {
  title: string;
  opts: Array<{ key: ShareToggleKey; label: string; hint: string }>;
  values: ShareOptions;
  onChange: (key: ShareToggleKey, v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-dim">{title}</div>
      {opts.map(({ key, label, hint }) => (
        <label
          key={String(key)}
          className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--ui-hover)]"
        >
          <input
            type="checkbox"
            checked={Boolean(values[key])}
            onChange={(e) => onChange(key, e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--ui-border)] bg-transparent accent-accent"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-text">{label}</div>
            <div className="text-[10px] text-text-dim">{hint}</div>
          </div>
        </label>
      ))}
    </div>
  );
}
