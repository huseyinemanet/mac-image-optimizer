import type { MouseEvent } from 'react';
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
  onSelect: (path: string, event: MouseEvent<HTMLTableRowElement>) => void;
  onContextMenu: (path: string, event: MouseEvent<HTMLTableRowElement>) => void;
  showDropHint: boolean;
}

function statusClass(row: FileTableRow): string {
  if (row.status === 'Done' && typeof row.percentSaved === 'number' && row.percentSaved > 0) {
    return 'status-chip bg-emerald-100 text-emerald-700';
  }
  if (row.status === 'Processing') {
    return 'status-chip bg-slate-100 text-slate-600';
  }
  if (row.status === 'Skipped') {
    return 'status-chip bg-amber-50 text-amber-700';
  }
  if (row.status === 'Failed') {
    return 'status-chip bg-rose-50 text-rose-700';
  }
  return 'status-chip bg-slate-100 text-slate-600';
}

function statusLabel(row: FileTableRow): string {
  if (row.status === 'Processing') {
    return 'Processing...';
  }

  if (row.status === 'Done') {
    if (typeof row.percentSaved === 'number' && row.percentSaved > 0) {
      return `Saved ${row.percentSaved}%`;
    }
    return 'Done';
  }

  if (row.status === 'Skipped') {
    if ((row.reason ?? '').toLowerCase().includes('larger')) {
      return 'Skipped (larger)';
    }
    return 'Skipped';
  }

  return row.status;
}

export function FileTable({ rows, selected, onSelect, onContextMenu, showDropHint }: FileTableProps): JSX.Element {
  return (
    <div className="relative h-full overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
          <tr className="border-b border-slate-200/80 text-left text-xs text-slate-500">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Size</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={(event) => onSelect(row.path, event)}
              onContextMenu={(event) => onContextMenu(row.path, event)}
              className={`cursor-default border-b border-slate-100/80 ${selected.has(row.path) ? 'bg-blue-50' : 'odd:bg-slate-50/40 hover:bg-slate-50'}`}
            >
              <td className="max-w-[560px] truncate px-3 py-2" title={row.path}>
                {row.name}
              </td>
              <td className="px-3 py-2">{row.type.toUpperCase()}</td>
              <td className="px-3 py-2">{row.sizeText}</td>
              <td className="px-3 py-2">
                <span className={statusClass(row)} title={row.reason || row.status}>
                  {statusLabel(row)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showDropHint ? <div className="sticky bottom-0 px-3 py-2 text-xs text-slate-400">Tip: drop more files here to add them</div> : null}
    </div>
  );
}
