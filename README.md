# Mac Image Optimizer

A blazing-fast, **100 % local** image optimizer for macOS — no uploads, no cloud, no subscriptions. Built with Electron and designed to feel native.

---

## ✨ Features

- **Optimize JPG / JPEG / PNG / WebP** — multi-tool candidate pipeline picks the smallest output automatically
- **Convert to WebP** — one-click batch conversion with configurable quality & presets
- **SSIM quality guard** — ensures visual fidelity stays above your threshold (default 0.99)
- **Watch Folders** — drop images into watched directories for hands-free optimization
- **Clipboard auto-optimize** — copies pasted/screenshot images and optimizes them on the fly
- **Multi-threaded worker pool** — automatically scales across CPU cores for parallel processing
- **Drag & drop or file picker** — add files / folders effortlessly
- **Native macOS context menu** — Optimize, Convert to WebP, Reveal in Finder, Remove from list
- **Native macOS notifications** — completion summaries and error alerts
- **Restore last run** — one-click undo with automatic backups
- **macOS-native UI** — custom sidebar, settings dialog with tabbed panels, dark mode support

## 🖥 Screenshots

<!-- Add screenshot here -->

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Electron 40 |
| Frontend | React 19, TypeScript 5.9 |
| Styling | Tailwind CSS 4.2, Headless UI |
| Bundler | Vite 7 |
| Image Processing | sharp, cjpeg (MozJPEG), pngquant, oxipng, cwebp |
| Quality Metric | SSIM.js |
| File Watching | chokidar |
| Testing | Vitest 4 |
| Packaging | electron-builder |

## 📁 Project Structure

```
mac-image-optimizer/
├── apps/desktop/                   # Electron desktop application
│   ├── src/
│   │   ├── main/                   # Main process
│   │   │   ├── main.ts             # App entry, IPC handlers, window management
│   │   │   ├── preload.ts          # Context bridge API
│   │   │   ├── optimizer/          # Optimization pipeline
│   │   │   │   ├── pipeline.ts     # Multi-candidate optimization engine
│   │   │   │   ├── workerPool.ts   # Thread pool for parallel processing
│   │   │   │   └── tools/          # Bundled native binaries (cjpeg, pngquant, oxipng, cwebp)
│   │   │   ├── services/           # Business logic services
│   │   │   ├── watch/              # Watch folder service
│   │   │   └── clipboardWatcher.ts # Clipboard auto-optimize
│   │   ├── renderer/               # React renderer
│   │   │   ├── App.tsx             # Main application component
│   │   │   ├── components/         # UI components (Sidebar, FileTable, BottomBar, etc.)
│   │   │   ├── hooks/              # Custom React hooks
│   │   │   └── index.css           # Tailwind styles
│   │   └── shared/                 # Shared types between main & renderer
│   └── resources/                  # Bundled native binaries & libraries
├── docs/
├── scripts/
└── package.json                    # Workspace root
```

## ⚙️ Settings

Settings are grouped into three tabs:

### General
- **Output mode** — Optimized subfolder (default) or Replace originals (with auto-backup)
- **Skip if larger** — Discards optimized files that end up bigger than the original
- **Preserve metadata** — Keeps EXIF and other metadata during optimization
- **Concurrency** — Auto (CPU-based) or manual thread count

### Optimization
- **JPEG quality range** — min/max quality for MozJPEG candidates
- **PNG optimization level** — oxipng compression level
- **SSIM threshold** — minimum structural similarity score (0.90–1.00)

### WebP
- **Quality** — WebP encoding quality (1–100)
- **Export preset** — Illustration, Photo, Drawing, etc.
- **Lossless mode** — toggle lossless WebP output
- **Near-lossless** — visually lossless at smaller file sizes

## 🚀 Getting Started

### Prerequisites

- **macOS** (Apple Silicon or Intel)
- **Node.js** ≥ 22.12 (recommended)
- **npm** ≥ 10

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts the TypeScript compiler, Vite dev server, and Electron concurrently.

### Build

```bash
npm run build
```

### Package (DMG)

```bash
npm run package
```

Output is in `apps/desktop/release/`.

## 🔒 Safety Defaults

- **Output mode** defaults to **Optimized subfolder** — originals are never touched
- **Skip-if-larger** is **ON** — prevents files from growing after optimization
- **Replace mode** creates timestamped backups under `.optimise-backup/`
- All writes use **temp file → validate → atomic rename** to prevent corruption

## 🧪 Testing

```bash
npm run test
```

## 📄 License

MIT
