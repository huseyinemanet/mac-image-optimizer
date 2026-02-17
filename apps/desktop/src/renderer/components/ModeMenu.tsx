import { Menu } from '@headlessui/react';
import type { RunMode } from '@/shared/types';

interface ModeMenuProps {
  mode: RunMode;
  onModeChange: (mode: RunMode) => void;
}

const labels: Record<RunMode, string> = {
  optimize: 'Optimize',
  optimizeAndWebp: 'Optimize + WebP',
  convertWebp: 'Convert to WebP'
};

export function ModeMenu({ mode, onModeChange }: ModeMenuProps): JSX.Element {
  return (
    <Menu.Root>
      <Menu.Trigger className="button-ghost" aria-label="Mode">
        Mode ▾
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8}>
          <Menu.Popup className="menu-popup">
            {(Object.keys(labels) as RunMode[]).map((item) => (
              <Menu.Item key={item} className="menu-item" onClick={() => onModeChange(item)}>
                {labels[item]} {mode === item ? '✓' : ''}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
