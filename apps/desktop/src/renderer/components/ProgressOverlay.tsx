import type { FC } from 'react';

interface ProgressOverlayProps {
	busy: boolean;
	progressPercent: number;
	done: number;
	total: number;
	savedText: string;
	savedPercent: number;
	onCancel: () => void;
}

export const ProgressOverlay: FC<ProgressOverlayProps> = ({
	busy,
	progressPercent,
	done,
	total,
	savedText,
	savedPercent,
	onCancel
}) => {
	if (!busy) return null;

	return (
		<div className="progress-overlay-container">
			<div className="progress-overlay-card macos-surface-raised">
				<div className="flex flex-col items-center gap-4 w-full">
					<div className="flex flex-col items-center gap-1">
						<h2 className="text-[15px] font-semibold text-macos-text">
							Optimizing Images
						</h2>
						<p className="text-[12px] text-macos-secondary">
							{done} of {total} files processed
						</p>
					</div>

					<div className="macos-progress w-full h-[6px]">
						<div
							className="macos-progress-fill"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>

					<div className="flex flex-col items-center gap-1">
						{(done > 0 || savedPercent > 0) && (
							<p className="text-[13px] font-medium text-macos-green">
								Saved {savedText} ({savedPercent}%)
							</p>
						)}
						<p className="text-[11px] text-macos-tertiary">
							{progressPercent}% Complete
						</p>
					</div>

					<button
						type="button"
						onClick={onCancel}
						className="macos-btn-primary mt-2 px-8"
					>
						Stop Optimization
					</button>
				</div>
			</div>
		</div>
	);
};
