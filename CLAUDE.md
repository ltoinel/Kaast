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

## Audio/Video Playback (Remotion)

All audio/video playback in the frontend MUST use Remotion components. Never use raw HTML `<video>` or `<audio>` tags directly.

Reference: https://www.remotion.dev/docs/video-tags

### Available components

- **`<OffthreadVideo />`** (recommended) — Built on Rust + FFmpeg, guarantees frame-perfect playback. Supports the widest range of containers (.aac, .avi, .caf, .flac, .flv, .m4a, .mkv, .mp3, .mp4, .ogg, .wav, .webm). Does not support looping.
- **`<Video />`** (from `@remotion/media`) — WebCodecs-based, fastest rendering, frame-perfect. Requires CORS configuration. Falls back to `<OffthreadVideo />` for unsupported formats.
- **`<Html5Video />`** (from `remotion`) — Traditional HTML5 `<video>` wrapper. Not guaranteed frame-accurate. Allows looping and partial downloads with `muted` property.

### Rules

- Prefer `<OffthreadVideo />` by default for reliable frame-perfect rendering
- All three components support `playbackRate` for speed adjustment
- `toneFrequency` (pitch change) only works during rendering
- Use `useRemotionEnvironment()` to deploy different components in preview vs rendering modes

## Code Quality

### Clean Code

- Follow Clean Code principles: meaningful names, single responsibility, DRY, KISS
- Functions and methods must do one thing and do it well
- Avoid magic numbers and hardcoded values — use named constants
- Prefer explicit code over clever code: readability first

### Documentation

- All functions, components, hooks, and Tauri commands must have JSDoc (TypeScript) or `///` doc comments (Rust)
- Document the **why**, not just the **what** — explain intent and business logic
- Each component file must start with a brief header comment describing its purpose
- Keep comments up to date when modifying code — stale comments are worse than no comments

### Cyclomatic Complexity

- Keep cyclomatic complexity per function below **10**
- Extract complex conditionals into well-named helper functions or variables
- Prefer early returns over deep nesting
- Split large components (>150 lines of logic) into smaller, focused sub-components or custom hooks
- Avoid nested ternaries — use intermediate variables or helper functions instead

## Conventions

- Language: English (default), multilingual via react-i18next
- UI strings: Use translation keys via `useTranslation()` hook, never hardcode strings
- Translation files: `src/i18n/locales/{lang}.json` with flat keys prefixed by component name
- Comments in code: English
- CSS: Custom properties from `src/styles.css` (DaVinci Resolve theme)
- Buttons: Global `.btn` system (`.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-sm`)
- Tauri commands: snake_case in Rust, camelCase in TypeScript via `safeInvoke()`
