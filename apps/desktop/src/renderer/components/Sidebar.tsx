import React from 'react';
import { IconAdd, IconGear } from './Icons';

interface SidebarProps {
	busy: boolean;
	showRestore: boolean;
	onPickFolder: () => void;
	onPickFiles: () => void;
	onRestore: () => void;
	onOpenSettings: () => void;
}

function IconFolderSet() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>folder-plus</title><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" stroke="#212121"><path fillRule="evenodd" clipRule="evenodd" d="M4.25 6.75H13.75C14.855 6.75 15.75 7.645 15.75 8.75V9.61699C15.75 9.82751 15.6987 10.1983 15.5003 10.1281C15.2656 10.0452 15.0131 10 14.75 10C13.5074 10 12.5 11.0074 12.5 12.25V12.5H12.25C11.0074 12.5 10 13.5074 10 14.75C10 14.8757 10.0103 14.999 10.0302 15.1191C10.0533 15.259 9.79222 15.25 9.65038 15.25H4.25C3.145 15.25 2.25 14.355 2.25 13.25V8.75C2.25 7.645 3.145 6.75 4.25 6.75Z" fill="#212121" fillOpacity="0.3" data-stroke="none" stroke="none"></path> <path d="M2.25 8.75V4.75C2.25 3.645 3.145 2.75 4.25 2.75H6.201C6.808 2.75 7.381 3.025 7.761 3.498L8.364 4.25H13.75C14.855 4.25 15.75 5.145 15.75 6.25V9.094"></path> <path d="M14.75 12.25V17.25"></path> <path d="M17.25 14.75H12.25"></path> <path d="M15.75 9.42221V8.75C15.75 7.646 14.855 6.75 13.75 6.75H4.25C3.145 6.75 2.25 7.646 2.25 8.75V13.25C2.25 14.354 3.145 15.25 4.25 15.25H9.2919"></path></g></svg>
	);
}

function IconFilesSet() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><title>file-plus</title><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" stroke="#212121"><path d="M10.336 1.75C10.4801 1.75 10.6212 1.78103 10.75 1.83956V5.24999C10.75 5.80199 11.198 6.24999 11.75 6.24999H15.1603C15.2189 6.37883 15.25 6.51978 15.25 6.664V8.30324C15.25 8.3994 15.2211 8.54729 15.1263 8.53133C15.0039 8.51073 14.8782 8.5 14.75 8.5C13.5074 8.5 12.5 9.50736 12.5 10.75V11H12.25C11.0074 11 10 12.0074 10 13.25C10 14.3834 10.8382 15.3547 11.9285 15.5166V16.25H4.75C3.645 16.25 2.75 15.355 2.75 14.25V3.75C2.75 2.645 3.645 1.75 4.75 1.75H10.336Z" fill="#212121" fillOpacity="0.3" data-stroke="none" stroke="none"></path> <path d="M5.75 6.75H7.75"></path> <path d="M5.75 9.75H10.25"></path> <path d="M15.16 6.24999H11.75C11.198 6.24999 10.75 5.80199 10.75 5.24999V1.85199"></path> <path d="M14.75 10.75V15.75"></path> <path d="M17.25 13.25H12.25"></path> <path d="M15.25 7.7959V6.66409C15.25 6.39899 15.145 6.14411 14.957 5.95711L11.043 2.043C10.855 1.855 10.601 1.75 10.336 1.75H4.75C3.645 1.75 2.75 2.646 2.75 3.75V14.25C2.75 15.354 3.645 16.25 4.75 16.25H11.8071"></path></g></svg>
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

export function Sidebar({ busy, showRestore, onPickFolder, onPickFiles, onRestore, onOpenSettings }: SidebarProps): React.JSX.Element {
	return (
		<aside className="sidebar">
			<div className="sidebar-header" />

			<nav className="sidebar-menu">
				<button type="button" className="sidebar-item" disabled={busy} onClick={onPickFolder}>
					<IconFolderSet />
					Add Folder
				</button>
				<button type="button" className="sidebar-item" disabled={busy} onClick={onPickFiles}>
					<IconFilesSet />
					Add Files
				</button>

				{showRestore ? (
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
