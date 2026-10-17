<p align="center">
  <img src="assets/logo.svg" alt="dots" width="300">
</p>

<p align="center">
  <img alt="Arch Linux" src="https://img.shields.io/badge/Arch-Linux-1793d1?logo=archlinux&logoColor=white">
  <img alt="zsh" src="https://img.shields.io/badge/shell-zsh-4e9a06">
  <img alt="Ghostty" src="https://img.shields.io/badge/terminal-Ghostty-5c6a72">
  <img alt="tmux" src="https://img.shields.io/badge/tmux-3.7-1bb91f?logo=tmux&logoColor=white">
  <img alt="Neovim" src="https://img.shields.io/badge/editor-Neovim-57a143?logo=neovim&logoColor=white">
  <img alt="OpenCode" src="https://img.shields.io/badge/OpenCode-v2-111111">
</p>

<p align="center">Personal dotfiles for Arch Linux. Clone, run <code>install.sh</code>, done.</p>

## Install

```sh
git clone https://github.com/ab1nv/dots.git ~/projects/dots
~/projects/dots/install.sh
chsh -s /usr/bin/zsh
```

`install.sh` is idempotent. It only creates symlinks and never edits files in
place.

## Layout

```
dots/
├── install.sh              symlink everything
├── AGENTS.md               global OpenCode instructions
├── opencode.jsonc          global OpenCode config (plugins, MCP, formatter)
├── cli.json                OpenCode terminal settings (theme, attention)
├── .opencode/
│   ├── agents/             vibelearn, leetcode, researcher, diagram-maker
│   ├── commands/           /learn, /exam, /commit
│   ├── skills/             learn, exam, commit, logo-design, anatomy
│   ├── context-mode/       OpenCode V2 port of the context-mode plugin
│   ├── langfuse/           OTLP tracing plugin
│   └── mcp/web-access/     merged web MCP (Python)
├── ghostty/config          terminal
├── tmux/tmux.conf          multiplexer
├── starship/starship.toml  prompt
├── zsh/{zshrc,zshenv}      shell
├── vscode/settings.json    VS Code
├── cargo/config.toml       Rust linker (mold)
├── nvim/                   Neovim config (empty, set up later)
└── assets/logo.svg         repo logo
```

## Files

| Path | What it does | Symlinks to |
| --- | --- | --- |
| `AGENTS.md` | Global OpenCode instructions: Caveman, Ponytail, writing, formatting, file search, context-mode, web research, shadcn, commits, subagents. | `~/.config/opencode/AGENTS.md` |
| `opencode.jsonc` | OpenCode server config: shell, formatter, compaction, plugins, MCP servers, permissions. | `~/.config/opencode/opencode.jsonc` |
| `cli.json` | OpenCode TUI config: gruvbox theme, diffs, sidebar, native notifications and sounds. | `~/.config/opencode/cli.json` |
| `zsh/zshrc` | Interactive zsh: history, completion, autosuggestions, syntax highlight, fzf, starship, zoxide, eza aliases. | `~/.zshrc` |
| `zsh/zshenv` | Env for every zsh: editor, pager, bat theme, PATH, XDG, secrets. | `~/.zshenv` |
| `starship/starship.toml` | Minimal gruvbox prompt. | `~/.config/starship.toml` |
| `ghostty/config` | Ghostty: Gruvbox Dark Hard, JetBrains Mono, maximized, borderless, zsh. | `~/.config/ghostty` |
| `tmux/tmux.conf` | tmux: prefix `C-a`, mouse, vi copy mode, gruvbox status bar. | `~/.tmux.conf` |
| `vscode/settings.json` | VS Code: JetBrains Mono, size 16, ligatures, smooth scrolling. | `~/.config/Code/User/settings.json` |
| `cargo/config.toml` | Rust linker: clang with mold for `x86_64-unknown-linux-gnu`. | `~/.cargo/config.toml` |
| `nvim/` | Empty Neovim config, filled in later. | `~/.config/nvim` |
| `.opencode/agents/` | Custom agents and modes. | `~/.config/opencode/agents` |
| `.opencode/commands/` | Slash commands. | `~/.config/opencode/commands` |
| `.opencode/skills/` | Skills. | `~/.config/opencode/skills` |
| `.opencode/plugins/` | Project-local plugin drop folder. | `~/.config/opencode/plugins` |

## OpenCode

Server config is `opencode.jsonc`, terminal settings are `cli.json`, and
instructions are `AGENTS.md`. Instructions only work through `AGENTS.md`; the
`instructions` config key is ignored in V2.

### Plugins

- `context-mode` (local): routes large tool output to a sandbox and keeps session memory. Also runs an MCP server.
- `langfuse` (local): sends one OTLP trace per turn to Langfuse, with generations, tool spans, tokens, and cost.
- `opencode-gemini-auth`: Google Gemini CLI OAuth.

### MCP servers

- `context-mode`: sandbox execution, FTS5 knowledge base, session memory. Tools appear as `context-mode_ctx_*`.
- `exa` (remote): advanced Exa search, only `exa_web_search_advanced_exa`. Free plan, key from `EXA_API_KEY`.
- `web-access` (local, Python): Hound engine for search, stealth fetch, crawl, screenshots, PDFs, plus `source_check`.

### Modes

Switch with Tab.

- `build`: default coding agent.
- `plan`: read-only planning.
- `vibelearn`: learn by building. You design and write the code; the agent scaffolds and reviews.
- `leetcode`: helvet repo workflow. Scaffold, coach, complexity, commit.

### Subagents

- `researcher`: web facts with citations.
- `diagram-maker`: correct, minimal SVG.

### Commands

- `/learn <concept|@file>`: adaptive tutor. Writes `00. Index.md` plus numbered unit files.
- `/exam [folder|topic]`: exam builder and grader.
- `/commit [push]`: conventional commit, optional push.

### Skills

- `learn`, `exam`, `commit`: as above.
- `logo-design`: logo and brand mark design, with a 1,400 logo SVG library.
- `anatomy`: isometric SVG figures that explain a concept as a real object, with WebGL and 3D.

### Secrets

Secrets stay outside the repo:

- `~/.config/zsh/secrets.zsh` (mode 600), sourced by `zshenv`. Holds `EXA_API_KEY` and `LANGFUSE_*`.
- `~/.config/opencode/langfuse.json` (mode 600): Langfuse keys when the server env is missing.
- `~/.config/environment.d/50-langfuse.conf`: the same keys for systemd user services.

## Shell

zsh with starship, zoxide, eza, fzf, bat.

| Command | Does |
| --- | --- |
| `z name`, `cd name` | zoxide jump. `cd` itself uses zoxide. `cdi` is interactive. |
| `ls`, `l`, `la` | eza long, all, git status, icons. |
| `lt`, `lta` | eza tree, level 2. |
| `cat` | bat. |
| `vim`, `vi` | nvim. |
| `Ctrl+R`, `Ctrl+T`, `Alt+C` | fzf history, files, directories. |

## Terminal

Ghostty runs zsh, maximized, no borders, Gruvbox Dark Hard, JetBrains Mono.
tmux prefix is `Ctrl+a`. Vertical split `|` or `:`, horizontal split `-` or `"`,
command prompt `;`, reload `r`. Mouse is on.

## Editors

Neovim is installed and aliased from `vim` and `vi`. Its config is empty for now.
VS Code uses JetBrains Mono at size 16.

## Arch notes

- pacman: `ghostty zsh starship eza fzf zoxide tmux neovim ttf-jetbrains-mono ttf-jetbrains-mono-nerd ruff zsh-autosuggestions zsh-syntax-highlighting zsh-completions nodejs npm bun yt-dlp ffmpeg tesseract mold clang`.
- Outside pacman: `fff-mcp` (curl script), `context-mode` (npm global), `hound-mcp` and `web-access-mcp` (pipx and uv).
- `google-chrome-stable` is used by Hound for the best TLS fingerprint.
- Native notifications need `notify-send` and a sound player such as `paplay`.
- Login shell is set with `chsh -s /usr/bin/zsh`.
- tmux copy mode uses `wl-copy` on Wayland, with `xclip` as fallback.

## Fresh machine

1. Install the packages above.
2. `git clone https://github.com/ab1nv/dots.git ~/projects/dots && ~/projects/dots/install.sh`.
3. `chsh -s /usr/bin/zsh`, then reopen the terminal.
4. Create `~/.config/zsh/secrets.zsh` with your keys (mode 600).
5. Start OpenCode once so it installs the npm plugins and connects the MCP servers.
