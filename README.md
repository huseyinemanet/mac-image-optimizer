# Image Optimizer (Local-Only Desktop App)

TinyPNG-like Electron desktop app that optimizes JPG/JPEG/PNG/WebP files **100% locally**.
No uploads, no cloud calls.

## Renderer UI Stack

- **Headless UI** (`@headlessui/react`) for interactive primitives
- **Tailwind CSS** for styling
- **react-hot-toast** for toasts

## Minimal Single-Screen Flow

1. Click **Add…** and choose **Folder…** or **Files…** (or drag & drop).
2. Click one primary button (**Optimize** or **Convert to WebP**, based on mode).
3. Watch progress in the bottom bar and completion toast.

## Layout

- **Top bar**: Add… menu, Settings gear, conditional Restore
- **Main**: Drop zone (empty) or compact table list
- **Bottom bar**: summary, run-only progress + cancel, mode dropdown, single primary action

## Right-Click Context Menu Implementation

Headless UI does not provide a native context menu component.
Implementation used:
- Capture native `onContextMenu` event on row (`preventDefault`) and store cursor position.
- Render a lightweight fixed-position menu at cursor coordinates.
- Menu items are built with **Headless UI `Menu`** for keyboard navigation semantics.
- Close behavior: click outside or `Esc`.

Actions:
- Optimize selected
- Convert to WebP (selected)
- Reveal in Finder
- Remove from list

## Toast Implementation

Using **react-hot-toast** in `ToastHost`:
- Success: saved bytes/percent + elapsed time
- Issues/errors: brief message + optional `View report` action

## Safety Defaults

- Output mode default: **Optimized subfolder**
- Skip-if-larger default: **ON** (`Allow larger outputs` OFF)
- Metadata default: **OFF**
- Replace mode creates backups under `.optimise-backup/YYYY-MM-DD_HH-mm-ss/`
- Writes use: temp file -> validate (sharp metadata) -> atomic rename

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Package (macOS)

```bash
npm run package
```

Installer outputs are in `apps/desktop/release/`.

## IPC (unchanged core contract)

Preload exposes:
- `selectFolder()`
- `selectFiles()`
- `scanPaths(paths)`
- `startRun(payload)`
- `cancelRun(runId)`
- `restoreLastRun()`
- `canRestoreLastRun()`
- `onProgress(cb)`
- `revealInFileManager(paths)`
- `openPath(path)`
- `copyToClipboard(text)`

## Troubleshooting

- No files loaded: check extension and folder permissions.
- Files skipped: likely `skip-if-larger` safety rule.
- Large folders: keep concurrency on Auto for best stability.
