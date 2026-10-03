#!/usr/bin/env bash
# Install the web-access MCP for a fresh Arch machine.
set -euo pipefail

DOTS="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
PKG="$DOTS/.opencode/mcp/web-access"

echo "==> system packages"
sudo pacman -S --needed --noconfirm python uv curl sqlite xdg-utils

echo "==> Hound engine (if missing)"
if ! command -v hound >/dev/null 2>&1; then
	uv tool install "hound-mcp[all]"
fi

echo "==> web-access"
uv tool install --editable "$PKG"

echo "==> browser (bundled Chromium fallback for Patchright)"
# Hound prefers system Chrome (best JA4). Install google-chrome from AUR for that.
python -m playwright install chromium >/dev/null 2>&1 || true

echo "==> doctor"
web-access --doctor
