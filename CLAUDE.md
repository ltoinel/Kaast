# Kaast - Project Guidelines

## Target Platforms

Kaast is a **desktop application** targeting:
- **Windows** (x86_64) — NSIS / MSI installer
- **Linux** (x86_64) — AppImage / DEB / RPM
- **macOS** (ARM aarch64 + Intel x86_64) — DMG

All code, dependencies, and build scripts MUST support these three platforms.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Rust (Tauri 2.0)
- **AI**: Gemini API (script generation, voice synthesis, scene analysis)
- **Video**: FFmpeg / FFprobe (bundled as Tauri sidecar)
- **UI Theme**: DaVinci Resolve-inspired dark theme (orange accent)

## Architecture

- `src/` — React frontend (components, styles, utils)
- `src-tauri/src/main.rs` — Rust backend (Tauri commands)
- `src-tauri/binaries/` — FFmpeg/FFprobe sidecar binaries (gitignored, downloaded via `scripts/download-ffmpeg.sh`)
- `scripts/` — Build and setup scripts

## FFmpeg Sidecar

FFmpeg is bundled as a Tauri sidecar binary (`bundle.externalBin` in `tauri.conf.json`).
- Binaries are NOT committed to Git (too large, ~80-95 MB per platform)
- Run `npm run download-ffmpeg` to download for the current platform
- Run `bash scripts/download-ffmpeg.sh <target>` for a specific target triple
- The Rust function `sidecar_path()` resolves the bundled binary at runtime, with fallback to system PATH

## Build Commands

```bash
npm run download-ffmpeg    # Download FFmpeg for current platform
npm run tauri dev          # Development mode
npm run tauri build        # Production build for current platform
```

## Conventions

- Language: French for UI labels and user-facing strings
- Comments in code: French
- CSS: Use CSS custom properties from `src/styles.css` (DaVinci Resolve theme)
- Buttons: Use the global `.btn` system (`.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-sm`)
- Tauri commands: snake_case in Rust, camelCase in TypeScript via `safeInvoke()`
