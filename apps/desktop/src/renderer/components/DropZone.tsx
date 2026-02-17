import type { DragEventHandler } from 'react';

interface DropZoneProps {
  onDrop: DragEventHandler<HTMLDivElement>;
  onDragEnter: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  isDragActive: boolean;
}

export function DropZone({ onDrop, onDragEnter, onDragLeave, isDragActive }: DropZoneProps): JSX.Element {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={`grid h-full place-items-center rounded-xl border-2 border-dashed transition-colors ${
        isDragActive ? 'border-sky-400 bg-sky-50/60' : 'border-slate-300 bg-slate-50/60'
      }`}
    >
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Drop a folder or images here</h2>
        <p className="mt-1 text-sm text-slate-500">Or click Add…</p>
      </div>
    </div>
  );
}
