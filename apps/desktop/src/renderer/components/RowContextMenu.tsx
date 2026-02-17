import { Menu } from '@headlessui/react';
import { useEffect, useRef } from 'react';

export interface RowContextMenuState {
  open: boolean;
  x: number;
  y: number;
  targetPaths: string[];
}

interface RowContextMenuProps {
  state: RowContextMenuState;
  onClose: () => void;
  onOptimize: (paths: string[]) => void;
  onConvert: (paths: string[]) => void;
  onReveal: (paths: string[]) => void;
  onRemove: (paths: string[]) => void;
}

export function RowContextMenu({ state, onClose, onOptimize, onConvert, onReveal, onRemove }: RowContextMenuProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state.open) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [state.open, onClose]);

  if (!state.open) {
    return null;
  }

  const runAndClose = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div ref={rootRef} className="fixed z-50" style={{ left: state.x, top: state.y }}>
      <Menu as="div" className="relative block">
        <Menu.Items static className="w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg focus:outline-none">
          <Menu.Item>
            {({ active }) => (
              <button type="button" onClick={() => runAndClose(() => onOptimize(state.targetPaths))} className={`context-item ${active ? 'bg-slate-100' : ''}`}>
                Optimize selected
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button type="button" onClick={() => runAndClose(() => onConvert(state.targetPaths))} className={`context-item ${active ? 'bg-slate-100' : ''}`}>
                Convert to WebP (selected)
              </button>
            )}
          </Menu.Item>
          <div className="my-1 h-px bg-slate-200" />
          <Menu.Item>
            {({ active }) => (
              <button type="button" onClick={() => runAndClose(() => onReveal(state.targetPaths))} className={`context-item ${active ? 'bg-slate-100' : ''}`}>
                Reveal in Finder/Explorer
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button type="button" onClick={() => runAndClose(() => onRemove(state.targetPaths))} className={`context-item ${active ? 'bg-slate-100' : ''}`}>
                Remove from list
              </button>
            )}
          </Menu.Item>
        </Menu.Items>
      </Menu>
    </div>
  );
}
