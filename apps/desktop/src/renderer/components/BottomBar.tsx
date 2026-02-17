import { Menu } from '@headlessui/react';
import type { RunMode } from '@/shared/types';

interface BottomBarProps {
  summaryLine: string;
  busy: boolean;
  done: number;
  savedText: string;
  savedPercent: number;
  progressPercent: number;
  mode: RunMode;
  canRun: boolean;
  onModeChange: (mode: RunMode) => void;
  onRun: () => void;
  onCancel: () => void;
}

const modeLabel: Record<RunMode, string> = {
  optimize: 'Optimize',
  optimizeAndWebp: 'Optimize + WebP',
  convertWebp: 'Convert to WebP'
};

export function BottomBar({
  summaryLine,
  busy,
  done,
  savedText,
  savedPercent,
  progressPercent,
  mode,
  canRun,
  onModeChange,
  onRun,
  onCancel
}: BottomBarProps): JSX.Element {
  return (
    <footer className="card flex items-center justify-between rounded-xl px-3 py-2">
      <div className="text-sm text-slate-700">{summaryLine}</div>

      <div className="flex min-w-[340px] items-center justify-center gap-2">
        {busy ? (
          <>
            {done > 0 || savedPercent > 0 ? <div className="text-xs text-slate-600">Saved {savedText} ({savedPercent}%)</div> : null}
            <div className="h-2 w-44 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-slate-800 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </button>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Menu as="div" className="relative">
          <Menu.Button className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Mode ▾
          </Menu.Button>
          <Menu.Items className="absolute right-0 top-9 z-20 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg focus:outline-none">
            {(Object.keys(modeLabel) as RunMode[]).map((item) => (
              <Menu.Item key={item}>
                {({ active }) => (
                  <button
                    type="button"
                    onClick={() => onModeChange(item)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${active ? 'bg-slate-100' : ''}`}
                  >
                    {modeLabel[item]} {item === mode ? '✓' : ''}
                  </button>
                )}
              </Menu.Item>
            ))}
          </Menu.Items>
        </Menu>

        <button
          type="button"
          onClick={onRun}
          disabled={!canRun || busy}
          className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {mode === 'convertWebp' ? 'Convert to WebP' : 'Optimize'}
        </button>
      </div>
    </footer>
  );
}
