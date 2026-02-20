import React from 'react';
import { IconAdd, IconGear, IconWatch, IconResponsive } from './Icons';

import logo from '../assets/logo.png';

interface SidebarProps {
	busy: boolean;
	showRestore: boolean;
	currentView: 'batch' | 'watch' | 'responsive';
	onViewChange: (view: 'batch' | 'watch' | 'responsive') => void;
	onPickFolder: () => void;
	onPickFiles: () => void;
	onRestore: () => void;
	onOpenSettings: () => void;
}

function IconFolderSet() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>folder-plus</title><g fill="#212121"><path d="M4.25 2C2.73079 2 1.5 3.23079 1.5 4.75V6.5H16.5V6.25C16.5 4.73079 15.2692 3.5 13.75 3.5H8.72395L8.34569 3.02827C7.82347 2.37825 7.03552 2 6.201 2H4.25Z"></path> <path fillRule="evenodd" clipRule="evenodd" d="M15.5 12.25C15.5 11.8358 15.1642 11.5 14.75 11.5C14.3358 11.5 14 11.8358 14 12.25V14H12.25C11.8358 14 11.5 14.3358 11.5 14.75C11.5 15.1642 11.8358 15.5 12.25 15.5H14V17.25C14 17.6642 14.3358 18 14.75 18C15.1642 18 15.5 17.6642 15.5 17.25V15.5H17.25C17.6642 15.5 18 15.1642 18 14.75C18 14.3358 17.6642 14 17.25 14H15.5V12.25Z"></path> <path d="M16.5 6.5H1.5V13.25C1.5 14.7692 2.73079 16 4.25 16H10.3789C10.1396 15.6425 10 15.2125 10 14.75C10 13.5074 11.0074 12.5 12.25 12.5H12.5V12.25C12.5 11.0074 13.5074 10 14.75 10C15.4568 10 16.0875 10.3259 16.5 10.8357V6.5Z" fillOpacity="0.4"></path></g></svg>
	);
}


function IconFilesSet() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>design-file-plus</title><g fill="#212121"><path d="M1 3.75C1 2.23079 2.23079 1 3.75 1H9.336C9.79834 1 10.2449 1.18293 10.574 1.5133L14.4873 5.42667C14.816 5.75536 15 6.20014 15 6.664V9.51373C14.9179 9.50466 14.8345 9.5 14.75 9.5C13.5074 9.5 12.5 10.5074 12.5 11.75V12H12.25C11.0074 12 10 13.0074 10 14.25C10 15.4926 11.0074 16.5 12.25 16.5H12.5V16.75C12.5 16.8303 12.5042 16.9096 12.5124 16.9877C12.426 16.9958 12.3385 17 12.25 17H3.75C2.23079 17 1 15.7692 1 14.25V3.75Z" fillOpacity="0.4"></path> <path fillRule="evenodd" clipRule="evenodd" d="M15.5 11.75C15.5 11.3358 15.1642 11 14.75 11C14.3358 11 14 11.3358 14 11.75V13.5H12.25C11.8358 13.5 11.5 13.8358 11.5 14.25C11.5 14.6642 11.8358 15 12.25 15H14V16.75C14 17.1642 14.3358 17.5 14.75 17.5C15.1642 17.5 15.5 17.1642 15.5 16.75V15H17.25C17.6642 15 18 14.6642 18 14.25C18 13.8358 17.6642 13.5 17.25 13.5H15.5V11.75Z"></path> <path d="M10.5 10C11.605 10 12.5 9.105 12.5 8C12.5 6.895 11.605 6 10.5 6C9.395 6 8.5 6.895 8.5 8C8.5 9.105 9.395 10 10.5 10Z"></path> <path d="M7.60001 10H5.89999C5.40299 10 5 10.403 5 10.9V12.6C5 13.097 5.40299 13.5 5.89999 13.5H7.60001C8.09701 13.5 8.5 13.097 8.5 12.6V10.9C8.5 10.403 8.09701 10 7.60001 10Z"></path> <path d="M7.402 7.64801C7.526 7.43101 7.52497 7.16199 7.39897 6.94699L6.06899 4.667C5.81799 4.237 5.10998 4.239 4.86098 4.667L3.53099 6.94602C3.40499 7.16202 3.403 7.43001 3.528 7.64801C3.652 7.86501 3.885 8 4.135 8H6.79399C7.04399 8 7.278 7.86501 7.402 7.64801Z"></path></g></svg>
	);
}


function IconRestoreLast() {
	return (
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M9 1.125a7.875 7.875 0 100 15.75 7.875 7.875 0 000-15.75zm0 2.813a.844.844 0 01.844.844v3.87l2.284 2.284a.844.844 0 11-1.192 1.192l-2.498-2.498A.844.844 0 017.312 9V4.781A.844.844 0 019 3.938z"
				fill="var(--macos-icon-color)"
			/>
		</svg>
	);
}


export function Sidebar({
	busy,
	showRestore,
	currentView,
	onViewChange,
	onPickFolder,
	onPickFiles,
	onRestore,
	onOpenSettings
}: SidebarProps): React.JSX.Element {
	return (
		<aside className="sidebar">
			<div className="sidebar-header">
			</div>

			<nav className="sidebar-menu">
				<div className="sidebar-section-label">Modes</div>
				<button
					type="button"
					className={`sidebar-item ${currentView === 'batch' ? 'active' : ''}`}
					onClick={() => onViewChange('batch')}
				>
					<IconFilesSet />
					Batch Mode
				</button>
				<button
					type="button"
					className={`sidebar-item ${currentView === 'watch' ? 'active' : ''}`}
					onClick={() => onViewChange('watch')}
				>
					<IconWatch className="w-[18px] h-[18px]" />
					Folder Watch
				</button>
				<button
					type="button"
					className={`sidebar-item ${currentView === 'responsive' ? 'active' : ''}`}
					onClick={() => onViewChange('responsive')}
				>
					<IconResponsive className="w-[18px] h-[18px]" />
					Responsive
				</button>

				<div className="mt-4" />
				<div className="sidebar-section-label">Add Images</div>
				<button type="button" className="sidebar-item" disabled={busy || currentView === 'watch'} onClick={onPickFolder}>
					<IconFolderSet />
					Add Folder
				</button>
				<button type="button" className="sidebar-item" disabled={busy || currentView === 'watch'} onClick={onPickFiles}>
					<IconFilesSet />
					Add Files
				</button>

				{showRestore && currentView === 'batch' ? (
					<>
						<div className="sidebar-section-label">Actions</div>
						<button type="button" className="sidebar-item" disabled={busy} onClick={onRestore}>
							<IconRestoreLast />
							Restore Last Run
						</button>
					</>
				) : null}
			</nav>

			<div className="sidebar-bottom">
				<button type="button" className="sidebar-item" onClick={onOpenSettings}>
					<IconGear className="h-[16px] w-[16px]" />
					Settings
				</button>
			</div>
		</aside>
	);
}
