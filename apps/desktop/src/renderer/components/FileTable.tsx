import { useState, useRef, useEffect, useCallback, type MouseEvent } from 'react';
import type { FileStatus } from '@/shared/types';

export interface FileTableRow {
  id: string;
  path: string;
  name: string;
  type: string;
  sizeText: string;
  status: FileStatus;
  percentSaved?: number;
  reason?: string;
}

interface FileTableProps {
  rows: FileTableRow[];
  selected: Set<string>;
  onSelect: (path: string, event: MouseEvent<HTMLDivElement>) => void;
  onContextMenu: (path: string, event: MouseEvent<HTMLDivElement>) => void;
  setSelected: (selected: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  showDropHint: boolean;
}

function statusBadge(row: FileTableRow): JSX.Element {
  let badgeLabel = '';
  let badgeBg = 'var(--macos-green)';
  if (row.status === 'Processing') {
    badgeLabel = 'Ready';
    badgeBg = 'var(--macos-green)';
  } else if (row.status === 'Done') {
    if (typeof row.percentSaved === 'number' && row.percentSaved > 0) {
      badgeLabel = `\u2212${row.percentSaved}%`;
      badgeBg = 'var(--macos-green)';
    } else {
      badgeLabel = 'Ready';
      badgeBg = 'var(--macos-green)';
    }
  } else if (row.status === 'Skipped') {
    badgeLabel = 'Skip';
    badgeBg = 'var(--macos-orange)';
  } else if (row.status === 'Failed') {
    badgeLabel = 'Error';
    badgeBg = 'var(--macos-red)';
  } else {
    badgeLabel = row.status;
    badgeBg = 'var(--macos-green)';
  }

  return (
    <div className="badge-status" style={{ background: badgeBg }} title={row.reason}>
      <span className="label-row label-center" style={{ color: '#FFFFFF' }}>{badgeLabel}</span>
    </div>
  );
}

export function FileTable({ rows, selected, onSelect, onContextMenu, setSelected, showDropHint }: FileTableProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lasso, setLasso] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const selectionAtStart = useRef<Set<string>>(new Set());
  const isLassoActive = useRef(false);
  const lassoOccurred = useRef(false);

  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (!startPos.current) return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!isLassoActive.current && distance < 5) return;
    isLassoActive.current = true;
    lassoOccurred.current = true;

    const x = Math.min(e.clientX, startPos.current.x);
    const y = Math.min(e.clientY, startPos.current.y);
    const w = Math.abs(e.clientX - startPos.current.x);
    const h = Math.abs(e.clientY - startPos.current.y);

    setLasso({ x, y, w, h });

    // Calculate intersections
    if (containerRef.current) {
      const rowElements = containerRef.current.querySelectorAll('.tr-row');
      const intersecting = new Set<string>();

      rowElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const path = el.getAttribute('data-path');
        if (!path) return;

        const intersects =
          x < rect.right &&
          x + w > rect.left &&
          y < rect.bottom &&
          y + h > rect.top;

        if (intersects) {
          intersecting.add(path);
        }
      });

      setSelected(() => {
        const next = new Set(selectionAtStart.current);
        intersecting.forEach(p => next.add(p));
        return next;
      });
    }
  }, [setSelected]);

  const handleMouseUp = useCallback(() => {
    startPos.current = null;
    isLassoActive.current = false;
    setLasso(null);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    const isTargetHeader = (e.target as HTMLElement).closest('.tr-header');
    if (isTargetHeader) return;

    const isTargetRow = (e.target as HTMLElement).closest('.tr-row');
    if (!isTargetRow && !e.metaKey && !e.shiftKey) {
      setSelected(new Set());
    }

    selectionAtStart.current = new Set(e.metaKey || e.shiftKey ? selected : []);
    startPos.current = { x: e.clientX, y: e.clientY };
    lassoOccurred.current = false;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className="files-table-container select-none"
      onMouseDown={handleMouseDown}
    >
      {lasso && (
        <div
          className="selection-lasso"
          style={{
            left: lasso.x,
            top: lasso.y,
            width: lasso.w,
            height: lasso.h
          }}
        />
      )}
      {/* Header Row */}
      <div className="tr-header">
        <div className="td-cell td-name">
          <span className="label-header">Name</span>
        </div>
        <div className="td-cell td-type">
          <span className="label-header label-center">Type</span>
        </div>
        <div className="td-cell td-size">
          <span className="label-header label-center">Size</span>
        </div>
        <div className="td-cell td-fixed">
          <span className="label-header label-center">Status</span>
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto mt-1 space-y-[1px] min-h-0">
        {rows.map((row) => {
          const isSelected = selected.has(row.path);
          return (
            <div
              key={row.id}
              data-id={row.id}
              data-path={row.path}
              onClick={(event) => {
                if (lassoOccurred.current) return;
                onSelect(row.path, event);
              }}
              onContextMenu={(event) => onContextMenu(row.path, event)}
              className="tr-row cursor-default"
              style={{
                background: isSelected ? 'var(--macos-selection)' : 'transparent'
              }}
            >
              <div className="td-cell td-name">
                <span className="label-row" style={{ color: isSelected ? 'var(--macos-accent)' : 'var(--macos-text)' }}>
                  {row.name}
                </span>
              </div>
              <div className="td-cell td-type">
                <span className="label-row label-center">{row.type.toUpperCase()}</span>
              </div>
              <div className="td-cell td-size">
                <span className="label-row label-center">{row.sizeText}</span>
              </div>
              <div className="td-cell td-fixed justify-center">
                {statusBadge(row)}
              </div>
            </div>
          );
        })}

        {showDropHint && rows.length > 0 && (
          <div className="px-3 py-2 text-[11px] text-zinc-400 italic">
            Tip: drop more files here to add them
          </div>
        )}
      </div>
    </div>
  );
}
