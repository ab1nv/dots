#!/usr/bin/env bash
# Sync this dotfiles repo into place with symlinks. Idempotent.
set -euo pipefail

DOTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

link() {
	local target="$1" path="$2"
	mkdir -p "$(dirname "$path")"
	ln -sfn "$target" "$path"
	echo "  $path -> $target"
}

echo "Shell"
link "$DOTS/zsh/zshrc" "$HOME/.zshrc"
link "$DOTS/zsh/zshenv" "$HOME/.zshenv"

echo "Prompt"
link "$DOTS/starship/starship.toml" "$HOME/.config/starship.toml"

echo "Terminal"
link "$DOTS/ghostty" "$HOME/.config/ghostty"
link "$DOTS/tmux/tmux.conf" "$HOME/.tmux.conf"

echo "Editor"
mkdir -p "$DOTS/nvim"
link "$DOTS/nvim" "$HOME/.config/nvim"

echo "OpenCode"
link "$DOTS/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"
link "$DOTS/opencode.jsonc" "$HOME/.config/opencode/opencode.jsonc"
link "$DOTS/cli.json" "$HOME/.config/opencode/cli.json"
link "$DOTS/.opencode/agents" "$HOME/.config/opencode/agents"
link "$DOTS/.opencode/commands" "$HOME/.config/opencode/commands"
link "$DOTS/.opencode/skills" "$HOME/.config/opencode/skills"
link "$DOTS/.opencode/plugins" "$HOME/.config/opencode/plugins"

echo
echo "Done. Restart your shell; make sure zsh is your login shell (chsh -s /usr/bin/zsh)."
