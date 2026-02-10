<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Kaast - Tauri + React

## Project Type
- **Framework**: Tauri 2.0 (Rust backend + React frontend)
- **Platform**: Cross-platform (Windows, Linux, macOS)
- **Scope**: Podcast editor with AI, inspired by DaVinci Resolve

## Architecture
- Frontend: React 18 + TypeScript + Vite
- Backend: Rust (Tauri 2.0)
- Video Processing: FFmpeg (embedded via sidecar)
- AI: Google Gemini API
- i18n: react-i18next with system language auto-detection
- UI: DaVinci Resolve-inspired dark theme with CSS variables

## Development Guidelines
- Use TypeScript for type safety
- Follow Tauri 2.0 best practices for IPC (invoke/commands)
- Implement video processing in Rust backend via FFmpeg sidecar
- Keep UI responsive during video operations
- Use global `.btn` CSS system for buttons (btn-primary, btn-secondary, btn-success)
- Use CSS variables defined in styles.css for theming
- All user-facing strings must use react-i18next translation keys (`useTranslation` hook)
- Translation files in `src/i18n/locales/` with flat keys prefixed by component name
