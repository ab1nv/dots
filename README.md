# Dots

Personal dotfiles, synced into place with symlinks. Start with the OpenCode
`/learn` tutor; zsh, tmux, and the rest land here next.

## Layout

```
dots/
├── AGENTS.md                 # global OpenCode instructions
├── opencode.jsonc            # global OpenCode config   (coming next)
├── tui.jsonc                 # terminal UI config        (coming next)
├── .opencode/
│   ├── agents/               # subagents  (researcher, diagram-maker)
│   ├── commands/             # slash commands (learn)
│   ├── skills/               # skills (learn)
│   └── plugins/              # plugins                  (reserved)
├── tmux/                     # tmux config              (coming next)
└── zsh/                      # zsh config               (coming next)
```

Everything the user-facing config points at lives in this one repo, so a machine
is set up by cloning `dots` and creating a handful of symlinks.

## Symlink map

| System path | Points at |
| --- | --- |
| `~/.config/opencode/AGENTS.md` | `dots/AGENTS.md` |
| `~/.config/opencode/opencode.jsonc` | `dots/opencode.jsonc` |
| `~/.config/opencode/tui.jsonc` | `dots/tui.jsonc` |
| `~/.config/opencode/agents` | `dots/.opencode/agents` |
| `~/.config/opencode/commands` | `dots/.opencode/commands` |
| `~/.config/opencode/skills` | `dots/.opencode/skills` |
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
