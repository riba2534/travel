// SettingsPanel 分享 tab 的内容：控制 ShareButton 一键出图时显示哪些内容。
// 修改这里的默认值会影响下一次点「生成分享图」的输出。

import { useAppStore, type ShareOptions } from '../state/store';

const LAYER_OPTS: Array<{ key: keyof ShareOptions; label: string; hint: string }> = [
  { key: 'showPoints', label: '轨迹点', hint: '发光的点位层（默认开）' },
  { key: 'showTrack', label: '轨迹线', hint: '连续路径线' },
  { key: 'showHeatmap', label: '热力图', hint: '密度叠加层' },
];

const TEXT_OPTS: Array<{ key: keyof ShareOptions; label: string; hint: string }> = [
  { key: 'title', label: '标题', hint: '左上角「HPCのJourneys」' },
  { key: 'stats', label: '关键统计', hint: 'km / 城市 / 点 / 年份' },
  { key: 'date', label: '签名 + 日期', hint: '右下角品牌 + 生成日期' },
];

export default function ShareSettings() {
  const shareOpts = useAppStore((s) => s.shareOpts);
  const setShareOpt = useAppStore((s) => s.setShareOpt);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-text-dim leading-relaxed">
        设置点击底栏「分享」按钮时要渲染的内容。一般用默认即可，只在需要调整时改这里。
      </p>

      <Group title="地图图层" opts={LAYER_OPTS} values={shareOpts} onChange={setShareOpt} />
      <Group title="文字叠加" opts={TEXT_OPTS} values={shareOpts} onChange={setShareOpt} />
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
  opts: Array<{ key: keyof ShareOptions; label: string; hint: string }>;
  values: ShareOptions;
  onChange: (key: keyof ShareOptions, v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] uppercase tracking-wider text-text-dim mb-1">{title}</div>
      {opts.map(({ key, label, hint }) => (
        <label
          key={String(key)}
          className="flex items-start gap-2 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-white/[0.04]"
        >
          <input
            type="checkbox"
            checked={values[key]}
            onChange={(e) => onChange(key, e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent accent-accent"
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
