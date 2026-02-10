# Kaast

Kaast is a modern, high-performance podcast editor inspired by DaVinci Resolve, built with Tauri and React.

## Features

- ✂️ **Cut videos** with FFmpeg
- 🔗 **Merge multiple videos** into one
- ✨ **Add transitions** (fade, dissolve, wipe)
- 📤 **Export to MP4** with different quality levels
- 🎬 **Real-time preview**
- ⚡ **Responsive and intuitive** interface
- 🎙️ **AI script generation** (Gemini)
- 📦 **Embedded FFmpeg** (no manual installation needed)
- 🌐 **Multilingual** (EN, FR, DE, ES, IT, PT, NL, PL)

## Technologies

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + Tauri 2.0
- **Video Processing**: FFmpeg (embedded via sidecar)
- **AI**: Google Gemini API
- **i18n**: react-i18next (system language auto-detection)
- **Supported Formats**: MP4, AVI, MOV, MKV, WebM

## Supported Platforms

- ✅ Windows 10/11 (x86_64)
- ✅ macOS (ARM aarch64 + Intel x86_64)
- ✅ Linux (x86_64) — AppImage / DEB / RPM

## Prerequisites (development)

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install)

### Installing Rust

**Windows**:
1. Download and run [rustup-init.exe](https://win.rustup.rs/)
2. Follow the installer instructions
3. Restart your terminal

**macOS / Linux**:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Installation

```bash
npm install
npm run download-ffmpeg
```

## Development

```bash
npm run tauri dev
```

> **Note**: Do not use `npm run dev` alone — it only starts the frontend without the Rust backend.

The first build may take several minutes as Rust compiles all dependencies.

## Build

```bash
npm run tauri build
```

The executable will be generated in `src-tauri/target/release/`.

## License

MIT
