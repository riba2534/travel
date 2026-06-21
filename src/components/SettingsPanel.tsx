import { useState } from 'react';
import { createPortal } from 'react-dom';
import ThemePicker from './ThemePicker';
import ShareSettings from './ShareSettings';
import { useDialogFocus } from '../lib/use-dialog-focus';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: Props) {
  const [tab, setTab] = useState<'theme' | 'share'>('theme');
  const panelRef = useDialogFocus<HTMLDivElement>(open, onClose);

  if (!open) return null;

  return createPortal(
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 面板 */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        tabIndex={-1}
        className="control-surface-strong pointer-events-auto fixed inset-x-0 bottom-0 z-40 max-h-[82dvh] w-full overflow-y-auto rounded-b-none rounded-t-2xl border-x-0 border-b-0 sm:inset-x-auto sm:bottom-20 sm:right-5 sm:max-h-[80dvh] sm:w-[min(92vw,400px)] sm:rounded-[var(--radius-control)] sm:border"
      >
        <div className="flex items-center justify-center pb-1 pt-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-current opacity-20" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--ui-border)' }}>
          <h2 className="text-sm font-semibold text-text">设置</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="control-button h-8 w-8"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b px-2 pt-2" role="tablist" style={{ borderColor: 'var(--ui-border)' }}>
          {(
            [
              ['theme', '主题'],
              ['share', '分享图'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              role="tab"
              aria-selected={tab === id}
              className={`rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === id ? 'bg-[var(--ui-hover)] text-text' : 'text-text-dim hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'theme' && <ThemePicker />}
          {tab === 'share' && <ShareSettings />}
        </div>
      </div>
    </>,
    document.body,
  );
}
