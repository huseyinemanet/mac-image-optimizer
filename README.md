# Mac Image Optimizer

A premium, **100% local** image optimization suite built exclusively for macOS. Designed with a native aesthetic and optimized for Apple Silicon, it provides professional-grade results without ever leaving your machine.

---

## ✨ Features

- **Blazing Fast Pipeline** — Harnesses `MozJPEG`, `pngquant`, `oxipng`, and `cwebp` for optimal compression.
- **Convert to WebP** — Elegant batch conversion with configurable presets and visual fidelity guards.
- **SSIM Quality Protection** — Intelligent quality guard ensures every optimization meets your visual standards (default SSIM 0.99).
- **macOS Native Excellence** — Custom UI built to feel like part of the system, including:
    - Native macOS notifications & completion alerts.
    - System-style toggles, sliders, and tabbed settings panels.
    - Full dark mode support.
- **Workflow Integration** —
    - **Watch Folders**: Automated optimization for chosen directories.
    - **Clipboard Support**: Copy images/screenshots; optimize them instantly from the clipboard.
    - **Drag & Drop**: Seamlessly add files and folders to the queue.
- **Advanced Control** — Multi-threaded execution, automatic updates, and a "Restore Last Run" safety net with local backups.

## 🛠 Tech Stack

| Component | Technology |
|---|---|
| **Framework** | Electron 40 (Stable) |
| **Frontend** | React 19, TypeScript 5.9 |
| **Styling** | Tailwind CSS 4.2 |
| **Processing** | sharp, MozJPEG, pngquant, oxipng, cwebp |
| **Metrics** | SSIM.js |
| **Build Tool** | Vite 7 |

## 📁 Project Structure

```
mac-image-optimizer/
├── apps/desktop/                   # Electron desktop application
│   ├── src/
│   │   ├── main/                   # Main process (IPC, Optimizer, Watchers)
│   │   ├── renderer/               # React renderer (macOS-native UI)
│   │   └── shared/                 # Shared types & utilities
│   └── resources/                  # Bundled native binaries
├── docs/                           # Project documentation
├── scripts/                        # Build & maintenance scripts
└── package.json                    # Workspace configuration
```

## 🚀 Getting Started

### Prerequisites

- **macOS** 13+ (Ventura or later recommended)
- **Node.js** ≥ 22.12
- **npm** ≥ 10

### Development

```bash
# Install dependencies
npm install

# Start development environment
npm run dev
```

### Distribution

```bash
# Build production assets
npm run build

# Package for macOS (creates DMG)
npm run package
```

Outputs are located in `apps/desktop/release/`.

## 🔒 Safety & Performance

- **Non-Destructive by Default**: Saves to an `Optimized` subfolder; original files remain untouched.
- **Atomic Operations**: Uses temporary files and atomic renames to prevent data loss.
- **Local First**: Zero cloud dependency. Your images never leave your Mac.
- **Apple Silicon Optimized**: Multi-threaded worker pool scales automatically with your Mac's CPU cores.

## 📄 License

MIT © 2026
