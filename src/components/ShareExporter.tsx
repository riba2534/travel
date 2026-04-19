import { useState } from 'react';
import { useAppStore, type ShareOptions } from '../state/store';
import { exportShare, shareOrDownload } from '../lib/share';

const OPTIONS: { key: keyof ShareOptions; label: string; hint: string }[] = [
  { key: 'title', label: '标题「我的足迹」', hint: '左上角大标题' },
  { key: 'stats', label: '关键统计', hint: 'km / 国家数 / 点数 / 年份' },
  { key: 'date', label: '生成日期', hint: '右下角小字' },
  { key: 'watermark', label: '域名水印', hint: '左下角小字' },
];

export default function ShareExporter() {
  const summary = useAppStore((s) => s.summary);
  const shareOpts = useAppStore((s) => s.shareOpts);
  const setShareOpt = useAppStore((s) => s.setShareOpt);
  const setExporting = useAppStore((s) => s.setExporting);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const onExport = async () => {
    const map = (window as unknown as { __map?: import('maplibre-gl').Map }).__map;
    if (!map || !summary) {
      setMsg('地图尚未就绪，请稍后再试');
      return;
    }
    setBusy(true);
    setExporting(true);
    setMsg('正在生成（包含全部足迹点）…');
    try {
      const blob = await exportShare(map, summary, shareOpts);
      await shareOrDownload(blob, `footprint-${Date.now()}.png`);
      setMsg('已生成，请在系统下载或分享菜单查看');
    } catch (e) {
      console.error(e);
      setMsg('生成失败：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-text-dim leading-relaxed">
        生成 1920×1080 横图，包含全部足迹点。下方可选要叠加的文字。
      </p>

      <div className="flex flex-col gap-1.5">
        {OPTIONS.map(({ key, label, hint }) => (
          <label
            key={key}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-white/[0.04]"
          >
            <input
              type="checkbox"
              checked={shareOpts[key]}
              onChange={(e) => setShareOpt(key, e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent accent-accent"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-text">{label}</div>
              <div className="text-[10px] text-text-dim">{hint}</div>
            </div>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={onExport}
        disabled={busy || !summary}
        className="w-full rounded-lg bg-accent px-3 py-2 text-xs font-medium text-bg transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-110"
      >
        {busy ? '生成中…' : '生成分享图'}
      </button>

      {msg && (
        <div className="text-[11px] text-text-dim leading-relaxed" aria-live="polite">
          {msg}
        </div>
      )}
    </div>
  );
}
