# Kaast - Project Guidelines

## Target Platforms

- **Windows** (x86_64) — NSIS / MSI installer
- **Linux** (x86_64) — AppImage / DEB / RPM
- **macOS** (ARM aarch64 + Intel x86_64) — DMG

## Tech Stack

- Frontend: React 18 + TypeScript + Vite
- Backend: Rust (Tauri 2.0)
- AI: Gemini API (script generation, voice synthesis, scene analysis)
- Video: FFmpeg / FFprobe (bundled as Tauri sidecar)
- i18n: react-i18next with i18next-browser-languagedetector
- UI Theme: DaVinci Resolve-inspired dark theme with orange accent

## Architecture

- `src/` — React frontend (components, styles, utils, i18n)
- `src/i18n/` — i18next config and locale files (en, fr, de, es, it, pt, nl, pl)
- `src-tauri/src/main.rs` — Rust backend (Tauri commands)
- `src-tauri/binaries/` — FFmpeg/FFprobe sidecar binaries (gitignored, downloaded via scripts)
- `scripts/` — Build and setup scripts

## FFmpeg Sidecar

- Binaries NOT committed to Git (~80-95 MB per platform)
- Download via `npm run download-ffmpeg` or `bash scripts/download-ffmpeg.sh <target>`
- Runtime resolution via `sidecar_path()` function with system PATH fallback

## Build Commands

```bash
npm run download-ffmpeg    # Download FFmpeg binaries for current platform
npm run tauri dev          # Development mode
npm run tauri build        # Production build
```

## Conventions

- Language: English (default), multilingual via react-i18next
- UI strings: Use translation keys via `useTranslation()` hook, never hardcode strings
- Translation files: `src/i18n/locales/{lang}.json` with flat keys prefixed by component name
- Comments in code: English
- CSS: Custom properties from `src/styles.css` (DaVinci Resolve theme)
- Buttons: Global `.btn` system (`.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-sm`)
- Tauri commands: snake_case in Rust, camelCase in TypeScript via `safeInvoke()`
