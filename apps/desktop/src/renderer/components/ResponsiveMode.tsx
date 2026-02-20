import React, { useState } from 'react';
import { motion } from 'motion/react';
import type { OptimiseSettings, ResponsiveSettings, ExportPreset } from '../../shared/types';
import { IconAdd } from './Icons';

interface ResponsiveModeProps {
	settings: OptimiseSettings;
	onChange: (settings: OptimiseSettings) => void;
	onRun: () => void;
	busy: boolean;
	fileCount: number;
}

const WIDTH_PRESETS = {
	'Web Standard': [320, 480, 640, 768, 1024, 1280, 1536, 1920, 2560],
	'Hero / High-res': [768, 1024, 1280, 1536, 1920, 2560, 3200, 3840],
	'Thumbnail / Cards': [160, 240, 320, 400, 480, 640, 800],
};

const SIZES_TEMPLATES = {
	'default': '(max-width: 768px) 100vw, 768px',
	'full-width': '100vw',
	'container': '(max-width: 1024px) 100vw, 1024px',
	'custom': '',
};

export function ResponsiveMode({ settings, onChange, onRun, busy, fileCount }: ResponsiveModeProps): React.JSX.Element {
	const rSettings = settings.responsiveSettings;
	const [customWidths, setCustomWidths] = useState(rSettings.widths.join(', '));
	const [selectedPreset, setSelectedPreset] = useState('Web Standard');
	const [headerScrolled, setHeaderScrolled] = useState(false);

	const updateResponsive = (patch: Partial<ResponsiveSettings>) => {
		onChange({
			...settings,
			responsiveSettings: {
				...rSettings,
				...patch,
			},
		});
	};

	const handlePresetChange = (presetName: string) => {
		setSelectedPreset(presetName);
		if (presetName !== 'Custom') {
			const widths = WIDTH_PRESETS[presetName as keyof typeof WIDTH_PRESETS];
			updateResponsive({ widths });
			setCustomWidths(widths.join(', '));
		}
	};

	const handleWidthsInput = (value: string) => {
		setCustomWidths(value);
		const widths = value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
		updateResponsive({ widths });
		setSelectedPreset('Custom');
	};

	const handleTemplateChange = (template: string) => {
		updateResponsive({
			sizesTemplate: template,
			customSizes: SIZES_TEMPLATES[template as keyof typeof SIZES_TEMPLATES] || rSettings.customSizes
		});
	};

	return (
		<div className="responsive-mode flex flex-col h-full" style={{ background: 'var(--macos-content-bg)' }}>
			<header className={`mode-sticky-header flex justify-between items-center shrink-0 ${headerScrolled ? 'is-scrolled' : ''}`}>
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Responsive Image Generator</h1>
					<p className="text-sm text-[var(--macos-secondary)]">Generate multiple widths and formats for better web performance.</p>
				</div>
			</header>

			<div
				className="mode-scroll flex-1 overflow-y-auto min-h-0 pb-8"
				onScroll={(e) => setHeaderScrolled(e.currentTarget.scrollTop > 4)}
			>
				<div className="flex flex-col gap-4">
					<section className="bg-[var(--macos-surface-raised)] border border-[var(--macos-separator)] rounded-xl p-4 shadow-sm space-y-4">
						<h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--macos-secondary)]">Configuration</h2>

						<div className="space-y-4">
							<div className="responsive-option-row">
								<span className="responsive-option-label">Mode</span>
								<select
									className="macos-select macos-select-mode responsive-option-select"
									value={rSettings.mode}
									onChange={(e) => updateResponsive({ mode: e.target.value as any })}
								>
									<option value="width">Width-based (w descriptors)</option>
									<option value="dpr">DPR-based (1x/2x/3x)</option>
								</select>
							</div>
							<div className="responsive-option-divider" />

							{rSettings.mode === 'width' ? (
								<>
									<div className="responsive-option-row">
										<span className="responsive-option-label">Width Preset</span>
										<select
											className="macos-select macos-select-mode responsive-option-select"
											value={selectedPreset}
											onChange={(e) => handlePresetChange(e.target.value)}
										>
											{Object.keys(WIDTH_PRESETS).map(p => <option key={p} value={p}>{p}</option>)}
											<option value="Custom">Custom Widths</option>
										</select>
									</div>
									<div className="responsive-option-divider" />

									<div className="flex flex-col space-y-1.5">
										<span className="text-[13px] font-medium">Custom Widths (comma separated)</span>
										<input
											type="text"
											className="macos-input text-xs w-full"
											value={customWidths}
											onChange={(e) => handleWidthsInput(e.target.value)}
											placeholder="e.g. 320, 640, 1024"
										/>
									</div>
								</>
							) : (
								<div className="flex flex-col space-y-1.5">
									<span className="text-[13px] font-medium">Base CSS Width (px)</span>
									<input
										type="number"
										className="macos-input text-xs w-full"
										value={rSettings.dprBaseWidth}
										onChange={(e) => updateResponsive({ dprBaseWidth: parseInt(e.target.value, 10) })}
									/>
								</div>
							)}
						</div>
					</section>

					<section className="bg-[var(--macos-surface-raised)] border border-[var(--macos-separator)] rounded-xl p-4 shadow-sm space-y-4">
						<h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--macos-secondary)]">Output Policy</h2>

						<div className="space-y-4">
							<div className="responsive-option-row">
								<span className="responsive-option-label">Format Strategy</span>
								<select
									className="macos-select macos-select-mode responsive-option-select"
									value={rSettings.formatPolicy}
									onChange={(e) => updateResponsive({ formatPolicy: e.target.value as any })}
								>
									<option value="webp-fallback">WebP + Original Fallback (Recommended)</option>
									<option value="keep">Keep Original Format Only</option>
									<option value="webp-only">WebP Only (Warning: No legacy support)</option>
								</select>
							</div>
							<div className="responsive-option-divider" />

							<div className="responsive-option-row">
								<span className="responsive-option-label">Optimisation Preset</span>
								<select
									className="macos-select macos-select-mode responsive-option-select"
									value={rSettings.optimizationPreset}
									onChange={(e) => updateResponsive({ optimizationPreset: e.target.value as ExportPreset })}
								>
									<option value="web">Web High</option>
									<option value="design">Design / Retina</option>
									<option value="original">Original (Passthrough)</option>
								</select>
							</div>

							<div className="pt-2 space-y-3 border-t border-[var(--macos-separator)] mt-4">
								<div className="flex items-center justify-between">
									<span className="text-[13px] font-medium text-[var(--macos-text)]">Allow upscaling</span>
									<label className="macos-toggle">
										<input
											type="checkbox"
											checked={rSettings.allowUpscale}
											onChange={(e) => updateResponsive({ allowUpscale: e.target.checked })}
										/>
										<div className="toggle-track"></div>
										<motion.span
											className="toggle-thumb"
											initial={false}
											animate={{ x: rSettings.allowUpscale ? 11 : 0 }}
											transition={{ type: 'spring', stiffness: 720, damping: 42, mass: 0.22 }}
										/>
									</label>
								</div>

								<div className="flex items-center justify-between">
									<span className="text-[13px] font-medium text-[var(--macos-text)]">Include original width</span>
									<label className="macos-toggle">
										<input
											type="checkbox"
											checked={rSettings.includeOriginal}
											onChange={(e) => updateResponsive({ includeOriginal: e.target.checked })}
										/>
										<div className="toggle-track"></div>
										<motion.span
											className="toggle-thumb"
											initial={false}
											animate={{ x: rSettings.includeOriginal ? 11 : 0 }}
											transition={{ type: 'spring', stiffness: 720, damping: 42, mass: 0.22 }}
										/>
									</label>
								</div>
							</div>
						</div>
					</section>
				</div>

				{rSettings.mode === 'width' && (
					<section className="mt-4 bg-[var(--macos-surface-raised)] border border-[var(--macos-separator)] rounded-xl p-4 shadow-sm space-y-4">
						<h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--macos-secondary)]">HTML Snippet Options</h2>
						<div className="flex flex-col gap-4">
							<div className="responsive-option-row">
								<span className="responsive-option-label">Sizes Template</span>
								<select
									className="macos-select macos-select-mode responsive-option-select"
									value={rSettings.sizesTemplate}
									onChange={(e) => handleTemplateChange(e.target.value)}
								>
									<option value="default">Default Responsive</option>
									<option value="full-width">Full Width (100vw)</option>
									<option value="container">Container Constrained</option>
									<option value="custom">Custom Sizes...</option>
								</select>
							</div>
							<div className="responsive-option-divider" />

							<div className="flex flex-col space-y-1.5">
								<span className="text-[13px] font-medium">Sizes Attribute</span>
								<input
									type="text"
									className="macos-input text-xs w-full"
									value={rSettings.customSizes}
									onChange={(e) => updateResponsive({ customSizes: e.target.value, sizesTemplate: 'custom' })}
									placeholder='e.g. (max-width: 1024px) 100vw, 1024px'
								/>
							</div>
						</div>
					</section>
				)}
			</div>

			<div className="pt-4 px-4 pb-4 mt-auto border-t border-[var(--macos-separator)] flex items-center justify-between shrink-0">
				<div className="text-sm text-[var(--macos-secondary)] font-medium">
					{fileCount === 0 ? 'No images added' : `${fileCount} image${fileCount > 1 ? 's' : ''} queued`}
				</div>
				<button
					onClick={onRun}
					disabled={busy || fileCount === 0}
					className="macos-btn-primary px-6"
				>
					{busy ? (
						<>
							<div className="animate-spin h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full" />
							<span>Processing...</span>
						</>
					) : (
						<span>Generate Responsive Set</span>
					)}
				</button>
			</div>
		</div>
	);
}
