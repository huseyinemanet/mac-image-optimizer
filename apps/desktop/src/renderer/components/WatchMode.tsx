import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import type { WatchFolderStatus, WatchFolderSettings, WatchFileDetectedEvent, WatchFileOptimizedEvent, WatchTriggerBehavior } from '@/shared/types';
import { formatBytes } from '../utils/format';
import { IconAdd, IconWatch } from './Icons';

interface WatchEvent {
	id: string;
	path: string;
	folder: string;
	status: 'detected' | 'processing' | 'success' | 'failed' | 'skipped';
	timestamp: number;
	beforeBytes?: number;
	afterBytes?: number;
	message?: string;
}

export function WatchMode(): React.JSX.Element {
	const [folders, setFolders] = useState<WatchFolderStatus[]>([]);
	const [events, setEvents] = useState<WatchEvent[]>([]);
	const [counters, setCounters] = useState({ processed: 0, skipped: 0, failed: 0 });
	const [globalSettings, setGlobalSettings] = useState<WatchFolderSettings | null>(null);
	const [headerScrolled, setHeaderScrolled] = useState(false);

	useEffect(() => {
		const init = async () => {
			try {
				const [initialFolders, initialSettings] = await Promise.all([
					window.api.listWatchFolders(),
					window.api.getGlobalWatchSettings()
				]);
				setFolders(initialFolders);
				setGlobalSettings(initialSettings);
			} catch (err) {
				console.error('Failed to initialize Folder Watch:', err);
			}
		};
		void init();
	}, []);

	useEffect(() => {
		const offDetected = window.api.onWatchFileDetected((event: WatchFileDetectedEvent) => {
			setEvents(prev => {
				const newEvent: WatchEvent = {
					id: `${Date.now()}-${event.path}`,
					path: event.path,
					folder: event.folder,
					status: 'detected',
					timestamp: Date.now()
				};
				return [newEvent, ...prev].slice(0, 100);
			});
		});

		const offOptimized = window.api.onWatchFileOptimized((event: WatchFileOptimizedEvent) => {
			setEvents(prev => prev.map(e => {
				if (e.path === event.path && (e.status === 'detected' || e.status === 'processing')) {
					return {
						...e,
						status: event.status,
						beforeBytes: event.beforeBytes,
						afterBytes: event.afterBytes,
						message: event.message
					};
				}
				return e;
			}));

			setCounters(prev => ({
				processed: prev.processed + (event.status === 'success' ? 1 : 0),
				skipped: prev.skipped + (event.status === 'skipped' ? 1 : 0),
				failed: prev.failed + (event.status === 'failed' ? 1 : 0)
			}));
		});

		return () => {
			offDetected();
			offOptimized();
		};
	}, []);

	const handleAddFolder = async () => {
		const path = await window.api.selectFolder();
		if (path) {
			const updated = await window.api.addWatchFolder(path);
			setFolders(updated);
		}
	};

	const handleRemoveFolder = async (path: string) => {
		const updated = await window.api.removeWatchFolder(path);
		setFolders(updated);
	};

	const handleToggleFolder = async (path: string, enabled: boolean) => {
		const updated = await window.api.toggleWatchFolder(path, enabled);
		setFolders(updated);
	};

	const handleToggleGlobal = async () => {
		if (!globalSettings) return;
		const next = { ...globalSettings, watchEnabled: !globalSettings.watchEnabled };
		await window.api.updateGlobalWatchSettings(next);
		setGlobalSettings(next);
	};

	const handleUpdateGlobal = async (key: keyof WatchFolderSettings, value: any) => {
		if (!globalSettings) return;
		const next = { ...globalSettings, [key]: value };
		await window.api.updateGlobalWatchSettings(next);
		setGlobalSettings(next);
	};

	return (
		<div className="watch-mode flex flex-col h-full" style={{ background: 'var(--macos-content-bg)' }}>
			<header className={`mode-sticky-header flex justify-between items-center shrink-0 ${headerScrolled ? 'is-scrolled' : ''}`}>
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Folder Watch</h1>
					<p className="text-sm text-[var(--macos-secondary)]">Automated optimization for your workflow</p>
				</div>
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={handleToggleGlobal}
						className="macos-btn-primary px-6"
					>
						{globalSettings?.watchEnabled ? 'Watching Active' : 'Watching Paused'}
					</button>
					<button
						type="button"
						onClick={handleAddFolder}
						className="macos-icon-btn h-9 w-9 rounded-full bg-[var(--macos-secondary)]/10 hover:bg-[var(--macos-secondary)]/20 transition-colors"
					>
						<IconAdd className="w-5 h-5" />
					</button>
				</div>
			</header>

			<div
				className="mode-scroll flex-1 overflow-y-auto min-h-0 pb-8"
				onScroll={(e) => setHeaderScrolled(e.currentTarget.scrollTop > 4)}
			>
				<div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
					{/* Watched Folders Section */}
					<section className="bg-[var(--macos-surface-raised)] border border-[var(--macos-separator)] rounded-xl p-4 shadow-sm space-y-4">
						<div className="flex justify-between items-center">
							<h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--macos-secondary)]">Watched Folders</h2>
							<span className="text-[10px] bg-[var(--macos-accent)]/10 text-[var(--macos-accent)] px-2 py-0.5 rounded-full font-bold">{folders.length}</span>
						</div>

						{folders.length === 0 ? (
							<div className="text-center py-10 px-4 border-2 border-dashed border-[var(--macos-separator)] rounded-lg">
								<p className="text-sm text-[var(--macos-secondary)] mb-3">No folders being watched</p>
								<button onClick={handleAddFolder} className="text-sm text-[var(--macos-accent)] font-semibold hover:underline">Add folder to start</button>
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
								{folders.map(folder => (
									<div key={folder.path} className="group flex items-center justify-between bg-[var(--macos-content-bg)]/50 border border-[var(--macos-separator)] p-2.5 rounded-lg hover:border-[var(--macos-accent)]/30 transition-all">
										<div className="flex-1 min-w-0 mr-3">
											<p className="text-sm font-semibold truncate leading-tight">{pathUtils.basename(folder.path)}</p>
											<p className="text-[10px] text-[var(--macos-secondary)] truncate mt-0.5">{folder.path}</p>
										</div>
										<div className="flex items-center gap-3">
											<label className="macos-toggle">
												<input
													type="checkbox"
													checked={folder.enabled}
													onChange={(e) => handleToggleFolder(folder.path, e.target.checked)}
												/>
												<div className="toggle-track"></div>
												<motion.span
													className="toggle-thumb"
													initial={false}
													animate={{ x: folder.enabled ? 11 : 0 }}
													transition={{ type: 'spring', stiffness: 720, damping: 42, mass: 0.22 }}
												/>
											</label>
											<button
												onClick={() => handleRemoveFolder(folder.path)}
												className="p-1 hover:text-[var(--macos-red)] transition-colors opacity-0 group-hover:opacity-100"
												title="Remove folder"
											>
												<span className="text-lg">×</span>
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</section>

					<section className="bg-[var(--macos-surface-raised)] border border-[var(--macos-separator)] rounded-xl p-4 shadow-sm space-y-4">
						<h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--macos-secondary)]">Rule Settings</h2>

						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div className="flex flex-col space-y-1.5">
								<span className="text-[13px] font-medium">Trigger</span>
								<select
									className="macos-select macos-select-mode text-xs w-full"
									value={globalSettings?.triggerBehavior}
									onChange={(e) => handleUpdateGlobal('triggerBehavior', e.target.value)}
								>
									<option value="new">Only new files</option>
									<option value="modified">New + modified</option>
								</select>
							</div>

							<div className="flex flex-col space-y-1.5">
								<span className="text-[13px] font-medium">Stability wait (sec)</span>
								<input
									type="number"
									className="macos-input text-xs w-full"
									value={globalSettings?.stabilityWaitMs ? globalSettings.stabilityWaitMs / 1000 : 2}
									onChange={(e) => handleUpdateGlobal('stabilityWaitMs', Math.max(1, parseInt(e.target.value)) * 1000)}
								/>
							</div>

							<div className="flex flex-col space-y-1.5">
								<span className="text-[13px] font-medium">Size limit (MB)</span>
								<input
									type="number"
									className="macos-input text-xs w-full"
									value={globalSettings?.maxFileSizeMb || 0}
									onChange={(e) => handleUpdateGlobal('maxFileSizeMb', Math.max(0, parseInt(e.target.value)))}
								/>
							</div>
						</div>
					</section>

					<section className="bg-[var(--macos-surface-raised)] border border-[var(--macos-separator)] rounded-xl p-4 grid grid-cols-3 gap-2 shadow-sm text-center">
						<div className="flex flex-col">
							<span className="text-lg font-bold text-[var(--macos-green)]">{counters.processed}</span>
							<span className="text-[9px] uppercase font-bold text-[var(--macos-secondary)] tracking-tighter">Optimized</span>
						</div>
						<div className="flex flex-col border-x border-[var(--macos-separator)]">
							<span className="text-lg font-bold text-[var(--macos-secondary)]">{counters.skipped}</span>
							<span className="text-[9px] uppercase font-bold text-[var(--macos-secondary)] tracking-tighter">Skipped</span>
						</div>
						<div className="flex flex-col">
							<span className="text-lg font-bold text-[var(--macos-red)]">{counters.failed}</span>
							<span className="text-[9px] uppercase font-bold text-[var(--macos-secondary)] tracking-tighter">Failed</span>
						</div>
					</section>

					{/* Live Feed Section */}
					<section className="bg-[var(--macos-surface-raised)] border border-[var(--macos-separator)] rounded-xl shadow-sm flex flex-col overflow-hidden">
						<div className="watch-live-feed-header flex justify-between items-center p-4 bg-[var(--macos-content-bg)]/20">
							<h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--macos-secondary)]">Live Feed</h2>
							<span className="live-badge">Live</span>
						</div>

						<div className="flex flex-col min-h-[160px]">
							{events.length === 0 ? (
								<div className="flex-1 flex flex-col items-center justify-center text-[var(--macos-secondary)] gap-3 py-12">
									<div className="w-12 h-12 bg-[var(--macos-secondary)]/10 rounded-full flex items-center justify-center">
										<IconWatch className="w-6 h-6 opacity-30" />
									</div>
									<div className="watch-empty-message" aria-label="Waiting for images">
										<span className="watch-empty-message-base">Waiting for images...</span>
										<motion.span
											className="watch-empty-message-shine"
											initial={{ backgroundPosition: '220% 0%' }}
											animate={{ backgroundPosition: ['220% 0%', '-180% 0%'] }}
											transition={{ duration: 2.2, ease: 'linear', repeat: Infinity, repeatDelay: 0.6 }}
											aria-hidden="true"
										>
											Waiting for images...
										</motion.span>
									</div>
								</div>
							) : (
								<div className="flex flex-col">
									{events.map(event => (
										<div key={event.id} className="watch-feed-item flex items-center gap-4 p-4 hover:bg-[var(--macos-row-hover)] transition-colors border-b border-[var(--macos-separator)]/30 last:border-b-0">
											<div className={`w-2.5 h-2.5 rounded-full shrink-0 ${event.status === 'success' ? 'bg-[var(--macos-green)] shadow-[0_0_8px_var(--macos-green)]' :
												event.status === 'failed' ? 'bg-[var(--macos-red)] shadow-[0_0_8px_var(--macos-red)]' :
													event.status === 'skipped' ? 'bg-[var(--macos-secondary)]/50' :
														'bg-[var(--macos-accent)] pulse-accent'
												}`} />

											<div className="flex-1 min-w-0">
												<div className="flex justify-between items-start">
													<span className="text-sm font-bold truncate pr-4" title={event.path}>{pathUtils.basename(event.path)}</span>
													<span className="text-[10px] text-[var(--macos-secondary)] tabular-nums font-medium bg-[var(--macos-secondary)]/10 px-1.5 py-0.5 rounded">
														{new Date(event.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
													</span>
												</div>
												<div className="flex items-center gap-2 mt-1">
													<span className={`text-[10px] font-bold uppercase tracking-tighter ${event.status === 'success' ? 'text-[var(--macos-green)]' :
														event.status === 'failed' ? 'text-[var(--macos-red)]' :
															'text-[var(--macos-secondary)]'
														}`}>
														{event.status}
													</span>
													{event.status === 'success' && event.beforeBytes && event.afterBytes && (
														<>
															<span className="text-[10px] text-[var(--macos-tertiary)]">•</span>
															<span className="text-[11px] font-bold text-[var(--macos-green)]">
																-{Math.round((event.beforeBytes - event.afterBytes) / event.beforeBytes * 100)}%
															</span>
															<span className="text-[11px] text-[var(--macos-secondary)]">
																({formatBytes(event.beforeBytes)} → {formatBytes(event.afterBytes)})
															</span>
														</>
													)}
													{event.message && (
														<>
															<span className="text-[10px] text-[var(--macos-tertiary)]">•</span>
															<span className="text-[10px] text-[var(--macos-red)] italic font-medium truncate">{event.message}</span>
														</>
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

// Helper to use path.basename in renderer (fallback)
const pathUtils = {
	basename: (p?: string) => {
		if (!p) return 'Unknown';
		return p.split(/[\\/]/).pop() || p;
	}
};
