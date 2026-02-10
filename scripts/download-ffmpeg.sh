#!/usr/bin/env bash
set -euo pipefail

# Download static FFmpeg + FFprobe builds for Tauri sidecar bundling.
# Usage:
#   bash scripts/download-ffmpeg.sh              # auto-detect platform
#   bash scripts/download-ffmpeg.sh <target>      # explicit target triple

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BINARIES_DIR="$SCRIPT_DIR/../src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

# Determine target triple
if [ -n "${1:-}" ]; then
    TARGET="$1"
else
    TARGET="$(rustc -vV | grep '^host:' | awk '{print $2}')"
fi

echo "==> Downloading FFmpeg for target: $TARGET"

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

case "$TARGET" in

    x86_64-pc-windows-msvc)
        URL="https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
        echo "    Source: $URL"
        curl -L --progress-bar "$URL" -o "$TEMP_DIR/ffmpeg.zip"
        unzip -q -o "$TEMP_DIR/ffmpeg.zip" -d "$TEMP_DIR"
        BIN_DIR=$(find "$TEMP_DIR" -type d -name "bin" | head -1)
        if [ -z "$BIN_DIR" ]; then
            echo "ERROR: bin/ directory not found in archive"
            exit 1
        fi
        cp "$BIN_DIR/ffmpeg.exe"  "$BINARIES_DIR/ffmpeg-x86_64-pc-windows-msvc.exe"
        cp "$BIN_DIR/ffprobe.exe" "$BINARIES_DIR/ffprobe-x86_64-pc-windows-msvc.exe"
        ;;

    x86_64-unknown-linux-gnu)
        URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
        echo "    Source: $URL"
        curl -L --progress-bar "$URL" -o "$TEMP_DIR/ffmpeg.tar.xz"
        tar xf "$TEMP_DIR/ffmpeg.tar.xz" -C "$TEMP_DIR"
        FFMPEG_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "ffmpeg-*-static" | head -1)
        if [ -z "$FFMPEG_DIR" ]; then
            echo "ERROR: ffmpeg static directory not found in archive"
            exit 1
        fi
        cp "$FFMPEG_DIR/ffmpeg"  "$BINARIES_DIR/ffmpeg-x86_64-unknown-linux-gnu"
        cp "$FFMPEG_DIR/ffprobe" "$BINARIES_DIR/ffprobe-x86_64-unknown-linux-gnu"
        chmod +x "$BINARIES_DIR/ffmpeg-x86_64-unknown-linux-gnu"
        chmod +x "$BINARIES_DIR/ffprobe-x86_64-unknown-linux-gnu"
        ;;

    aarch64-apple-darwin)
        echo "    Source: evermeet.cx (macOS ARM)"
        curl -L --progress-bar "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip" -o "$TEMP_DIR/ffmpeg.zip"
        curl -L --progress-bar "https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip" -o "$TEMP_DIR/ffprobe.zip"
        unzip -q -o "$TEMP_DIR/ffmpeg.zip" -d "$TEMP_DIR"
        unzip -q -o "$TEMP_DIR/ffprobe.zip" -d "$TEMP_DIR"
        cp "$TEMP_DIR/ffmpeg"  "$BINARIES_DIR/ffmpeg-aarch64-apple-darwin"
        cp "$TEMP_DIR/ffprobe" "$BINARIES_DIR/ffprobe-aarch64-apple-darwin"
        chmod +x "$BINARIES_DIR/ffmpeg-aarch64-apple-darwin"
        chmod +x "$BINARIES_DIR/ffprobe-aarch64-apple-darwin"
        ;;

    x86_64-apple-darwin)
        echo "    Source: evermeet.cx (macOS Intel)"
        curl -L --progress-bar "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip" -o "$TEMP_DIR/ffmpeg.zip"
        curl -L --progress-bar "https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip" -o "$TEMP_DIR/ffprobe.zip"
        unzip -q -o "$TEMP_DIR/ffmpeg.zip" -d "$TEMP_DIR"
        unzip -q -o "$TEMP_DIR/ffprobe.zip" -d "$TEMP_DIR"
        cp "$TEMP_DIR/ffmpeg"  "$BINARIES_DIR/ffmpeg-x86_64-apple-darwin"
        cp "$TEMP_DIR/ffprobe" "$BINARIES_DIR/ffprobe-x86_64-apple-darwin"
        chmod +x "$BINARIES_DIR/ffmpeg-x86_64-apple-darwin"
        chmod +x "$BINARIES_DIR/ffprobe-x86_64-apple-darwin"
        ;;

    *)
        echo "ERROR: Unsupported target: $TARGET"
        echo "Supported targets:"
        echo "  x86_64-pc-windows-msvc"
        echo "  x86_64-unknown-linux-gnu"
        echo "  aarch64-apple-darwin"
        echo "  x86_64-apple-darwin"
        exit 1
        ;;
esac

echo ""
echo "==> FFmpeg binaries installed:"
ls -lh "$BINARIES_DIR"/ffmpeg-* "$BINARIES_DIR"/ffprobe-* 2>/dev/null || true
echo ""
echo "Done!"
