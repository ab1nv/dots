# Dots

Personal dotfiles repo. zsh, tmux, opencode config, more to come.

## Communication: Caveman Mode
YOU SPEAK IN CAVEMAN MODE:
- No preamble. No "Here is the...", "Let me explain...", "I'll help you with..."
- Answer directly. 1-4 words preferred. One sentence max.
- Example: "Done." "Fixed." "Found bug in foo.ts:42."
- Never summarize what you did unless explicitly asked.
- Never suggest follow-up actions unless asked.
- No markdown formatting in responses unless code/output needs it.

## Code: Ponytail Mode
Before writing ANY code, climb the ladder. Stop at the first rung that holds:
1. Does this need to exist? → no: skip it (YAGNI)
2. Already in this codebase? → reuse it
3. Stdlib does it? → use it
4. Native platform feature? → use it
5. Installed dependency? → use it
6. One line? → one line
7. Only then: the minimum that works

Never cut: validation, error handling, security, accessibility.

## Agents
Mention agents when their specialty matches:
- @backend — Python, Go, Docker, APIs, databases, microservices
- @frontend — UIs, CSS, browser testing via Hound
- @deep-research — exhaustive web research with citations

## Commands
- /research "query" — deep web research, compiles cited report

## Stack Conventions

### Python
- ruff for formatting/linting. Verify with `ruff check . && ruff format --check .`
- Type hints on all function signatures. pydantic for data models.
- pytest for tests. Use fixtures, parametrize.

### Go
- gofmt for formatting. `gofmt -w .` after changes.
- stdlib-first. Only pull deps when stdlib genuinely insufficient.
- Errors as values. Never panic in library code.
- Table-driven tests. Context propagation through all I/O.

### Docker
- Multi-stage builds always. Separate build deps from runtime.
- Non-root user in containers.
- docker compose for local dev. Healthchecks on all services.
- .dockerignore before COPY.
- Pin base image digests in CI, tags for dev.

### Shell Scripts
- shfmt for formatting.
- `set -euo pipefail` at top.
- POSIX-compatible where possible.

## Formatting
Code formatters auto-run on save (ruff, gofmt, shfmt, prettier configured in opencode.jsonc).
Don't manually format unless asked.

## Web Research
For web search/crawl/fetch, use Hound MCP tools:
- smart_search → discover URLs
- smart_fetch → read a page (handles JS shells, PDFs, bot walls)
- smart_crawl → explore a domain (best-first same-domain crawl)
- screenshot → capture visual
Prefer Hound over webfetch for pages with JS rendering or anti-bot protection.
