import React, { useState, useEffect } from 'react';
import { formatBytes } from '../utils/format';

interface PreviewPanelProps {
	originalPath: string;
	originalSize: number;
	originalBuffer?: Buffer;
	optimizedBuffer?: Buffer;
	optimizedSize?: number;
	params?: string;
	onClose: () => void;
}

export function PreviewPanel({ originalPath, originalSize, originalBuffer, optimizedBuffer, optimizedSize, params, onClose }: PreviewPanelProps): React.JSX.Element {
	const [zoom, setZoom] = useState(1);
	const [viewMode, setViewMode] = useState<'split' | 'toggle'>('split');
	const [showOptimized, setShowOptimized] = useState(true);
	const [splitPos, setSplitPos] = useState(50);

	const [originalUrl, setOriginalUrl] = useState<string | null>(null);
	const [optimizedUrl, setOptimizedUrl] = useState<string | null>(null);

	useEffect(() => {
		if (originalBuffer) {
			const blob = new Blob([new Uint8Array(originalBuffer)]);
			const url = URL.createObjectURL(blob);
			setOriginalUrl(url);
			return () => URL.revokeObjectURL(url);
		}
		setOriginalUrl(null);
		return undefined;
	}, [originalBuffer]);

	useEffect(() => {
		if (optimizedBuffer) {
			const blob = new Blob([new Uint8Array(optimizedBuffer)]);
			const url = URL.createObjectURL(blob);
			setOptimizedUrl(url);
			return () => URL.revokeObjectURL(url);
		}
		return undefined;
	}, [optimizedBuffer]);

	const savings = optimizedSize ? Math.round(((originalSize - optimizedSize) / originalSize) * 100) : 0;

	return (
		<div className="preview-panel">
			<div className="preview-header">
				<div className="flex items-center gap-4">
					<span className="font-semibold text-[13px]">Preview</span>
					<div className="preview-tabs">
						<button className={viewMode === 'split' ? 'active' : ''} onClick={() => setViewMode('split')}>Split</button>
						<button className={viewMode === 'toggle' ? 'active' : ''} onClick={() => setViewMode('toggle')}>Toggle</button>
					</div>
					<div className="preview-zoom gap-2 flex items-center">
						<button onClick={() => setZoom(1)} className={zoom === 1 ? 'active' : ''}>100%</button>
						<button onClick={() => setZoom(2)} className={zoom === 2 ? 'active' : ''}>200%</button>
						<button onClick={() => setZoom(4)} className={zoom === 4 ? 'active' : ''}>400%</button>
					</div>
				</div>
				<button onClick={onClose} className="preview-close">✕</button>
			</div>

			<div className="preview-content">
				<div className="preview-viewport" style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
					{viewMode === 'split' ? (
						<div className="split-view" onMouseMove={(e) => {
							const rect = e.currentTarget.getBoundingClientRect();
							setSplitPos(((e.clientX - rect.left) / rect.width) * 100);
						}}>
							{originalUrl && <img src={originalUrl} className="original" alt="Original" />}
							<div className="optimized-container" style={{ width: `${100 - splitPos}%` }}>
								{optimizedUrl && <img src={optimizedUrl} className="optimized" alt="Optimized" />}
							</div>
							<div className="split-handle" style={{ left: `${splitPos}%` }} />
						</div>
					) : (
						<div className="toggle-view" onMouseDown={() => setShowOptimized(false)} onMouseUp={() => setShowOptimized(true)}>
							{(showOptimized && optimizedUrl) ? (
								<img src={optimizedUrl} alt="Preview Optimized" />
							) : (
								originalUrl ? <img src={originalUrl} alt="Preview Original" /> : null
							)}
							<div className="toggle-hint">{showOptimized ? 'Optimized (Hold to see original)' : 'Original'}</div>
						</div>
					)}
				</div>
			</div>

			<div className="preview-footer">
				<div className="flex flex-col">
					<span className="text-[11px] opacity-60">ORIGINAL</span>
					<span className="text-[14px] font-medium">{formatBytes(originalSize)}</span>
				</div>
				<div className="flex flex-col">
					<span className="text-[11px] opacity-60">OPTIMIZED</span>
					<span className="text-[14px] font-medium text-green-500">{optimizedSize ? formatBytes(optimizedSize) : '...'}</span>
				</div>
				<div className="flex flex-col">
					<span className="text-[11px] opacity-60">SAVINGS</span>
					<span className="text-[14px] font-medium text-green-500">{savings}%</span>
				</div>
				{params && (
					<div className="flex flex-col ml-auto">
						<span className="text-[11px] opacity-60">PARAMETERS</span>
						<span className="text-[12px]">{params}</span>
					</div>
				)}
			</div>
		</div>
	);
}
