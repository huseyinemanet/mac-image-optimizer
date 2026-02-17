import { Menu } from '@headlessui/react';
import { IconAdd, IconGear } from './Icons';

interface TopBarProps {
  busy: boolean;
  showRestore: boolean;
  onPickFolder: () => void;
  onPickFiles: () => void;
  onRestore: () => void;
  onOpenSettings: () => void;
}

export function TopBar({ busy, showRestore, onPickFolder, onPickFiles, onRestore, onOpenSettings }: TopBarProps): JSX.Element {
  const iconButtonClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1';

  return (
    <header className="topbar card flex items-center justify-between rounded-xl px-3 py-2">
      <Menu as="div" className="relative">
        <Menu.Button className={iconButtonClass} aria-label="Add" title="Add">
          <IconAdd className="h-[18px] w-[18px] text-slate-900" />
        </Menu.Button>
        <Menu.Items className="absolute left-0 top-9 z-20 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg focus:outline-none">
          <Menu.Item>
            {({ active }) => (
              <button
                type="button"
                onClick={onPickFolder}
                disabled={busy}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${active ? 'bg-slate-100' : ''}`}
              >
                Folder…
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button
                type="button"
                onClick={onPickFiles}
                disabled={busy}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${active ? 'bg-slate-100' : ''}`}
              >
                Files…
              </button>
            )}
          </Menu.Item>
        </Menu.Items>
      </Menu>

      <div className="flex items-center gap-2">
        {showRestore ? (
          <button
            type="button"
            onClick={onRestore}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Restore
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Settings"
          title="Settings"
          onClick={onOpenSettings}
          className={iconButtonClass}
        >
          <IconGear className="h-[18px] w-[18px] text-slate-900" />
        </button>
      </div>
    </header>
  );
}
