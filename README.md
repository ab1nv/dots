# Dots

Personal dotfiles, synced into place with symlinks. Run `./install.sh` on a new
machine after cloning. Everything user-facing lives in this one repo: OpenCode
(the `/learn` tutor), zsh + starship, Ghostty, tmux, and nvim.

## Layout

```
dots/
├── install.sh                # create all symlinks
├── AGENTS.md                 # global OpenCode instructions
├── opencode.jsonc            # global OpenCode config
├── cli.json                  # OpenCode TUI config (gruvbox theme)
├── .opencode/
│   ├── agents/               # subagents  (researcher, diagram-maker)
│   ├── commands/             # slash commands (learn)
│   ├── skills/               # skills (learn)
│   ├── plugins/              # plugins
│   └── mcp/                  # local MCP servers
├── ghostty/config            # Ghostty terminal
├── tmux/tmux.conf            # tmux
├── starship/starship.toml    # starship prompt
├── zsh/zshrc, zsh/zshenv     # zsh
└── nvim/                     # neovim (config added later)
```

## Symlink map

| System path | Points at |
| --- | --- |
| `~/.config/opencode/AGENTS.md` | `dots/AGENTS.md` |
| `~/.config/opencode/opencode.jsonc` | `dots/opencode.jsonc` |
| `~/.config/opencode/cli.json` | `dots/cli.json` |
| `~/.config/opencode/agents` | `dots/.opencode/agents` |
| `~/.config/opencode/commands` | `dots/.opencode/commands` |
| `~/.config/opencode/skills` | `dots/.opencode/skills` |
| `~/.config/opencode/plugins` | `dots/.opencode/plugins` |
| `~/.config/ghostty` | `dots/ghostty` |
| `~/.config/starship.toml` | `dots/starship/starship.toml` |
| `~/.config/nvim` | `dots/nvim` |
| `~/.tmux.conf` | `dots/tmux/tmux.conf` |
| `~/.zshrc` | `dots/zsh/zshrc` |
| `~/.zshenv` | `dots/zsh/zshenv` |

## The `/learn` tutor

`/learn <concept>` or `/learn @INDEX.md` starts an adaptive one-to-one session.

- Asks the learner's level, then tests (one question at a time) to find the edge
  of what they already know.
- Plans a dependency map (unconditional truths → goal) and teaches node by node.
- Verifies facts with a `researcher` subagent and draws SVGs with a
  `diagram-maker` subagent.
- Writes everything to a topic folder as Markdown for Obsidian: `test.md`,
  `lesson.md`, `progress.md`, and `assets/*.svg`.

Skill: `.opencode/skills/learn/SKILL.md`.
Command: `.opencode/commands/learn.md`.
