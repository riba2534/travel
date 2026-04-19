import { useState } from 'react';
import { useAppStore } from '../state/store';
import ThemePicker from './ThemePicker';
import ShareExporter from './ShareExporter';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: Props) {
  const setUiHidden = useAppStore((s) => s.setUiHidden);
  const [tab, setTab] = useState<'theme' | 'share' | 'display'>('theme');

  if (!open) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 面板 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        className="pointer-events-auto fixed z-40 bottom-16 right-3 sm:bottom-20 sm:right-5 w-[min(92vw,380px)] max-h-[80dvh] overflow-y-auto rounded-2xl border border-white/[0.08] shadow-2xl backdrop-blur-md"
        style={{ background: 'var(--panel)' }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-sm font-medium text-text">设置</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="h-8 w-8 rounded-lg text-text-dim hover:bg-white/5 hover:text-text transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 border-b border-white/[0.06] px-2 pt-2">
          {([
            ['theme', '主题'],
            ['share', '分享'],
            ['display', '显示'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`px-3 py-1.5 text-xs rounded-t-lg transition-colors ${
                tab === id ? 'bg-white/[0.06] text-text' : 'text-text-dim hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'theme' && <ThemePicker />}
          {tab === 'share' && <ShareExporter />}
          {tab === 'display' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-text-dim leading-relaxed">
                隐藏所有界面元素，只保留地图和轨迹。按 <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">Esc</kbd> 或点击右下角的小图标恢复。
              </p>
              <button
                type="button"
                onClick={() => {
                  setUiHidden(true);
                  onClose();
                }}
                className="w-full rounded-lg bg-accent/15 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/25 transition-colors"
              >
                进入沉浸模式
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
