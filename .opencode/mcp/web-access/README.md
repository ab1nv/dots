# web-access-mcp

Merged web-access MCP for OpenCode. **Engine**: [Hound / master-fetch](https://github.com/dondai1234/master-fetch) (MIT) does the hard part — 10 keyless search engines with consensus and neural reranking, Patchright stealth fetching (system Chrome, fingerprint profiles, Cloudflare Turnstile, bezier mouse), best-first crawl + sitemap, PDF tables + CID/scanned OCR, SQLite cache. **Layer**: this package adds a pi-web-access-style retrieval store (`response_id`, paging, `find_text`) and a `source_check` artifact.

## Tools

| Tool | Purpose |
| --- | --- |
| `web_search` | Search; `queries[]` for up to 5 related questions in one call. |
| `web_fetch` | Fetch 1–50 URLs; `focus=` returns only the relevant part; `actions=` drives the stealth browser; `mode=screenshot`. |
| `web_crawl` | Best-first crawl or sitemap map (`sitemap='auto'`, `discover_only`). |
| `web_content` | Page any previous response or `find_text` across it with offsets/hashes. |
| `source_check` | Claim → searched, fetched passages with SHA-256 hashes and a heuristic status. |
| `web_admin` | `version` · `cache_stats` · `cache_clear` · `doctor`. |

## Install (Arch)

```sh
uv tool install --editable ~/projects/dots/.opencode/mcp/web-access
web-access --doctor
```

Requires the Hound engine: `hound` on PATH (pipx/uv install of `hound-mcp[all]`).

## OpenCode

```jsonc
{
  "mcp": {
    "servers": {
      "web-access": { "type": "local", "command": ["web-access"], "codemode": false }
    }
  }
}
```

## Config

- `WEB_ACCESS_HOUND_BIN` — hound binary (default: `hound` on PATH).
- `WEB_ACCESS_STORE_DIR` — response store (default `$XDG_CACHE_HOME/web-access`).
- `WEB_ACCESS_BROWSER_IDLE_TIMEOUT` — forwarded to Hound (default 300s).
- Hound's own env (`HOUND_SEARCH_*`, `HTTP_PROXY`, BYOK keys via `hound keys`) applies.
