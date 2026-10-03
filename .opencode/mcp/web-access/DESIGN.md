# web-access — design

A single MCP that merges the two best open-source web stacks for agents, without
reimplementing the hard parts.

```
                    ┌─────────────────────────────┐
   agent ── MCP ──▶ │  web-access (this package)  │
                    │  store · source_check       │
                    └──────────────┬──────────────┘
                                   │ MCP stdio (child)
                    ┌──────────────▼──────────────┐
                    │  Hound / master-fetch       │
                    │  search · stealth · crawl   │
                    │  PDF/OCR · cache · rerank   │
                    └─────────────────────────────┘
```

## Why this split

- **Hound already is the merged engine.** It has the empirically hard parts:
  keyless multi-engine search with circuit breakers and consensus, Patchright
  stealth with a real-Chrome JA4 fingerprint, Turnstile solving, best-first
  crawl with sitemap mapping, pdfplumber/pypdfium2/rapidocr with CID recovery,
  and an SQLite envelope cache. Reimplementing these is the expensive half.
- **pi-web-access contributes protocol-level ideas, not engines**: a bounded
  `response_id` store with paging and `find_text`, claim-level source checking
  with exact offsets and hashes, ordered provider fallback with error
  classification, auth/cookie profiles, SSRF preflight. Those are cheap to
  express in Python and are implemented here where they add value.
- **One language, one process tree.** The merged server is Python; Hound is its
  child. No TS/Python split, no duplicated browser management.

## Tool contract

| Tool | Backend | Notes |
| --- | --- | --- |
| `web_search` | Hound `mcp_smart_search` | Multi-query fan-out (≤5, concurrent), merged + reranked by relevance. |
| `web_fetch` | Hound `mcp_smart_fetch` | HTTP → stealth auto-escalation; `focus` BM25; `actions`; PDFs; `mode=screenshot`. |
| `web_crawl` | Hound `mcp_smart_crawl` | Best-first + `sitemap='auto'`, `discover_only`. |
| `web_content` | local SQLite store | `response_id`, offset/limit, `find_text` ≤10 needles. |
| `source_check` | search + fetch + local | Passages with offsets + SHA-256; status heuristic. |
| `web_admin` | Hound + local | `version`, `cache_stats`, `cache_clear`, `doctor`. |

## Honest limits

- CAPTCHA coverage is Hound's: Cloudflare Turnstile (interactive/managed) is
  solved; reCAPTCHA/hCaptcha/DataDome/Akamai are not. When blocked, the envelope
  reports `content_ok=false` and a `page_type` such as `bot_wall`, and
  `next_action` tells the agent to switch source — never to invent content.
- `source_check` is heuristic passage matching, not entailment. The status is a
  pointer; the passages and hashes are the evidence.
- pi-web-access's 33 paid providers and hosted unlockers are not ported. Hound's
  BYOK (`hound keys add serper|tavily|exa|firecrawl|tinyfish`) plus 10 keyless
  engines cover search; hosted fetch is intentionally out of scope (privacy +
  cost). Add them as fetch providers only if a target class needs them.
- Auth/cookie profiles and video/GitHub-clone fetch are pi features not ported
  here. Hound's `cookies` fetch option is the current path.
