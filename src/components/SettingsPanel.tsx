import ThemePicker from './ThemePicker';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: Props) {
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

        <div className="p-4">
          <ThemePicker />
        </div>
      </div>
    </>
  );
}
