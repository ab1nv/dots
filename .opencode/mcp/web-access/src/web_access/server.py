"""web-access MCP server.

Six tools, token-budget conscious, merging Hound's engine with a pi-web-access
style retrieval/verification layer:

  web_search   -> Hound mcp_smart_search (10 keyless engines, consensus, rerank)
  web_fetch    -> Hound mcp_smart_fetch (HTTP -> Patchright stealth, PDF/OCR)
  web_crawl    -> Hound mcp_smart_crawl (best-first + sitemap)
  web_content  -> local response store: paging + find_text over any response
  source_check -> claim -> passage-level evidence artifact with offsets/hashes
  web_admin    -> version / cache / doctor
"""

from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
import time
from contextlib import asynccontextmanager
from typing import Any

from mcp import ClientSession
from mcp.client.stdio import stdio_client
from mcp.server.fastmcp import Context, FastMCP

from . import __version__, store
from . import source_check as source_check_mod
from .hound import Hound, HoundError

INSTRUCTIONS = """\
Search returns ranked URLs with signals (relevance_score, fetch_relevance,
content_ok). Fetch only what you need, prefer focus= to get the matching part
instead of the whole page, and check content_ok / next_action before trusting a
page. Paginate with next_offset or web_content(response_id=...). Never treat a
snippet as a source; fetch it. For factual claims use source_check and read the
returned passages."""


@asynccontextmanager
async def lifespan(_server: FastMCP):
    params = Hound.server_params()
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield {"hound": Hound(session)}


def create_server(host: str = "127.0.0.1", port: int = 8766) -> FastMCP:
    server = FastMCP(
        "web-access",
        instructions=INSTRUCTIONS,
        host=host,
        port=port,
        lifespan=lifespan,
    )

    def engine(ctx: Context) -> Hound:
        return ctx.request_context.lifespan_context["hound"]

    # ------------------------------------------------------------------ search

    @server.tool()
    async def web_search(
        ctx: Context,
        query: str | None = None,
        queries: list[str] | None = None,
        provider: str | None = None,
        max_results: int = 5,
        freshness: str | None = None,
        domains: list[str] | None = None,
        site: str | None = None,
        exclude_sites: list[str] | None = None,
        language: str | None = None,
        region: str | None = None,
        page: int = 0,
        mode: str = "auto",
        url: str | None = None,
        include_content: bool = False,
        cache_ttl: int = 300,
        proxy: str | None = None,
    ) -> dict[str, Any]:
        """Search the web. Use queries[] to ask up to 5 related questions in one call.

        provider is accepted for compatibility; a known Hound engine name is
        passed through as an engine filter. Results carry a response_id for
        web_content.
        """
        hound = engine(ctx)
        asks = [q for q in (queries or ([query] if query else [])) if q and q.strip()][
            :5
        ]
        if not asks:
            return {"error": "provide query or queries"}

        options: dict[str, Any] = {
            "max_results": max(1, min(20, int(max_results))),
            "cache_ttl": int(cache_ttl),
            "mode": mode,
            "page": max(0, min(10, int(page))),
        }
        for key, value in (
            ("freshness", freshness),
            ("site", site),
            ("language", language),
            ("region", region),
            ("url", url),
        ):
            if value:
                options[key] = value
        if domains:
            options["exclude_sites"] = [d[1:] for d in domains if d.startswith("-")]
            include = [d for d in domains if not d.startswith("-")]
            if include:
                options["site"] = include[0] if len(include) == 1 else None
                if len(include) > 1:
                    options["engines"] = options.get("engines", [])
                    options["_sites"] = include
        if exclude_sites:
            options["exclude_sites"] = list(
                {*(options.get("exclude_sites") or []), *exclude_sites}
            )
        if provider and provider != "auto":
            options["engines"] = [provider]

        async def run(q: str) -> dict[str, Any]:
            try:
                return await hound.call(
                    "mcp_smart_search", {"query": q, "options": options}
                )
            except HoundError as exc:
                return {"error": str(exc)}

        results = await asyncio.gather(*(run(q) for q in asks))
        payload = {"queries": asks, "results": results, "at": time.time()}
        rid = store.save("search", payload)

        merged: list[dict[str, Any]] = []
        errors: list[str] = []
        related: list[str] = []
        for q, result in zip(asks, results):
            if result.get("error"):
                errors.append(f"{q}: {result['error']}")
                continue
            for item in result.get("results", [])[:max_results]:
                item = dict(item)
                item["query"] = q
                merged.append(item)
            related.extend(result.get("related_queries") or [])
            if include_content and not result.get("results"):
                errors.append(f"{q}: no results")
        merged.sort(key=lambda item: item.get("relevance_score") or 0, reverse=True)

        return {
            "response_id": rid,
            "queries": asks,
            "results": merged[: max_results * len(asks)],
            "related_queries": list(dict.fromkeys(related))[:8],
            "errors": errors,
        }

    # ------------------------------------------------------------------- fetch

    @server.tool()
    async def web_fetch(
        ctx: Context,
        url: str | None = None,
        urls: list[str] | None = None,
        mode: str = "readable",
        extraction: str = "markdown",
        css_selector: str | None = None,
        focus: str | None = None,
        max_content_chars: int = 40000,
        offset: int = 0,
        cache_ttl: int = 3600,
        force: str = "auto",
        actions: list[dict[str, Any]] | None = None,
        pages: str | None = None,
        password: str | None = None,
        include_links: bool = False,
        include_media: bool = False,
        respect_robots: bool = False,
        real_chrome: bool = False,
        solve_cloudflare: bool = True,
        wait: int | None = None,
        network_idle: bool = False,
        proxy: str | None = None,
        timeout_ms: int = 30000,
    ) -> dict[str, Any]:
        """Fetch one or many URLs. mode: readable | raw | screenshot.

        focus= runs BM25 filtering and returns only the relevant part (best for
        answering a question). actions= drives the stealth browser
        ({click},{fill:{selector,text}},{press},{wait},{scroll},{wait_selector}).
        """
        hound = engine(ctx)
        targets = [u for u in (urls or ([url] if url else [])) if u and u.strip()][:50]
        if not targets:
            return {"error": "provide url or urls"}

        if mode == "screenshot":
            return await _screenshot(hound, targets[0], full_page=False)

        options: dict[str, Any] = {
            "include_links": include_links,
            "include_media": include_media,
            "respect_robots": respect_robots,
            "network_idle": network_idle,
            "solve_cloudflare": solve_cloudflare,
        }
        if real_chrome:
            options["real_chrome"] = True
        if wait:
            options["wait"] = wait
        if proxy:
            options["proxy"] = proxy

        args: dict[str, Any] = {
            "extraction_type": "text" if mode == "raw" else extraction,
            "max_content_chars": max(500, min(200000, int(max_content_chars))),
            "offset": max(0, int(offset)),
            "cache_ttl": int(cache_ttl),
            "timeout": int(timeout_ms),
            "options": options,
        }
        if css_selector:
            args["css_selector"] = css_selector
        if focus:
            args["focus"] = focus
        if actions:
            args["actions"] = actions[:20]
        if pages:
            args["pages"] = pages
        if password:
            args["password"] = password
        if force == "http":
            args["force_fetcher"] = "http"
        elif force == "browser":
            args["force_fetcher"] = "stealthy"

        if len(targets) == 1:
            args["url"] = targets[0]
        else:
            args["urls"] = targets

        try:
            result = await hound.call("mcp_smart_fetch", args)
        except HoundError as exc:
            return {"error": str(exc), "url": targets[0] if len(targets) == 1 else None}
        if isinstance(result.get("content"), list):
            result["content"] = _content_text(result["content"])
        rid = store.save("fetch", {"args": args, "result": result})
        result["response_id"] = rid
        return result

    # ------------------------------------------------------------------- crawl

    @server.tool()
    async def web_crawl(
        ctx: Context,
        url: str,
        max_pages: int = 10,
        max_depth: int = 2,
        focus: str | None = None,
        crawl_urls: list[str] | None = None,
        discover_only: bool = False,
        sitemap: str = "auto",
        path_include: list[str] | None = None,
        path_exclude: list[str] | None = None,
        max_total_chars: int | None = None,
        deadline_ms: int = 120000,
        concurrency: int = 3,
        cache_ttl: int = 3600,
        respect_robots: bool = False,
        proxy: str | None = None,
    ) -> dict[str, Any]:
        """Crawl a site best-first, or map it with sitemap='auto'|true. discover_only returns the URL map."""
        hound = engine(ctx)
        options: dict[str, Any] = {
            "max_pages": max(1, min(100, int(max_pages))),
            "max_depth": max(0, min(5, int(max_depth))),
            "sitemap": sitemap,
            "deadline_ms": int(deadline_ms),
            "concurrency": max(1, min(5, int(concurrency))),
            "cache_ttl": int(cache_ttl),
            "respect_robots": respect_robots,
        }
        if path_include:
            options["path_include"] = path_include
        if path_exclude:
            options["path_exclude"] = path_exclude
        if max_total_chars:
            options["max_total_chars"] = int(max_total_chars)
        if proxy:
            options["proxy"] = proxy
        args: dict[str, Any] = {"url": url, "options": options}
        if focus:
            args["focus"] = focus
        if crawl_urls:
            args["crawl_urls"] = crawl_urls
        if discover_only:
            args["discover_only"] = True
        try:
            result = await hound.call("mcp_smart_crawl", args)
        except HoundError as exc:
            return {"error": str(exc), "url": url}
        rid = store.save("crawl", {"args": args, "result": result})
        result["response_id"] = rid
        return result

    # ----------------------------------------------------------------- content

    @server.tool()
    async def web_content(
        ctx: Context,
        response_id: str,
        query: str | None = None,
        query_index: int | None = None,
        url: str | None = None,
        url_index: int | None = None,
        offset: int = 0,
        limit: int = 20000,
        find_text: str | list[str] | None = None,
        find_mode: str = "case-insensitive",
    ) -> dict[str, Any]:
        """Read a previous response: page long content, or find_text (<=10 needles) and get matching passages with offsets."""
        payload = store.get(response_id)
        if payload is None:
            return {"error": f"unknown response_id {response_id}"}

        target: Any = payload
        kind = (
            payload.get("queries")
            and "search"
            or payload.get("args")
            and "fetch"
            or "other"
        )
        if kind == "search":
            entries = payload.get("results") or []
            if query_index is not None and 0 <= query_index < len(entries):
                target = entries[query_index]
            elif query is not None:
                for entry in entries:
                    if entry.get("query") == query:
                        target = entry
                        break
                else:
                    return {
                        "error": f"no stored query {query!r}",
                        "queries": payload.get("queries"),
                    }
            elif url is not None:
                for entry in entries:
                    for item in entry.get("results", []):
                        if item.get("url") == url:
                            target = item
                            break
        elif kind == "fetch":
            target = payload.get("result") or payload

        needles = [find_text] if isinstance(find_text, str) else list(find_text or [])
        if needles:
            return {
                "response_id": response_id,
                "find_text": needles,
                "find_mode": find_mode,
                "matches": store.find_text(target, needles[:10], mode=find_mode),
            }
        if kind == "search" and target is payload:
            return {
                "response_id": response_id,
                "queries": payload.get("queries"),
                "results": [
                    {
                        "query": entry.get("query"),
                        "results": entry.get("results"),
                        "error": entry.get("error"),
                    }
                    for entry in payload.get("results", [])
                ],
                "note": "pass query/query_index/url/url_index to narrow, or find_text to search",
            }
        return {
            "response_id": response_id,
            **store.page(target, max(0, int(offset)), max(1, min(200000, int(limit)))),
        }

    # ------------------------------------------------------------ source_check

    @server.tool()
    async def source_check(
        ctx: Context,
        claim: str,
        queries: list[str] | None = None,
        max_results: int = 5,
        fetch_content: bool = True,
        freshness: str | None = None,
        domains: list[str] | None = None,
        provider: str | None = None,
        proxy: str | None = None,
    ) -> dict[str, Any]:
        """Check a factual claim against fetched sources. Returns passages with offsets and SHA-256 hashes and a heuristic status."""
        hound = engine(ctx)
        asks = [q for q in (queries or [claim]) if q and q.strip()][:8]
        options: dict[str, Any] = {"max_results": max(1, min(20, int(max_results)))}
        if freshness:
            options["freshness"] = freshness
        if domains:
            excludes = [d[1:] for d in domains if d.startswith("-")]
            if excludes:
                options["exclude_sites"] = excludes
        if provider and provider != "auto":
            options["engines"] = [provider]
        if proxy:
            options["proxy"] = proxy

        search_results: list[dict[str, Any]] = []
        for q in asks:
            try:
                res = await hound.call(
                    "mcp_smart_search", {"query": q, "options": options}
                )
            except HoundError:
                continue
            search_results.extend(res.get("results", []))

        seen: set[str] = set()
        ranked: list[dict[str, Any]] = []
        for item in search_results:
            url = item.get("url")
            if url and url not in seen:
                seen.add(url)
                ranked.append(item)
        ranked.sort(key=lambda item: item.get("relevance_score") or 0, reverse=True)

        sources: list[dict[str, Any]] = []
        for rank, item in enumerate(
            ranked[: max(1, min(5, int(max_results)))], start=1
        ):
            source = {
                "rank": rank,
                "title": item.get("title"),
                "url": item.get("url"),
                "content": "",
            }
            if fetch_content:
                try:
                    page = await hound.call(
                        "mcp_smart_fetch",
                        {
                            "url": item.get("url"),
                            "focus": claim,
                            "max_content_chars": 30000,
                        },
                    )
                    source["content"] = _content_text(page.get("content"))
                    source["content_ok"] = page.get("content_ok")
                    source["page_type"] = page.get("page_type")
                except HoundError:
                    source["content_ok"] = False
            sources.append(source)

        artifact = source_check_mod.check_claim(claim, sources)
        rid = store.save("source_check", {"artifact": artifact, "sources": sources})
        artifact["response_id"] = rid
        return artifact

    # ------------------------------------------------------------------- admin

    @server.tool()
    async def web_admin(ctx: Context, action: str, all: bool = False) -> dict[str, Any]:
        """action: version | cache_stats | cache_clear | doctor."""
        hound = engine(ctx)
        if action == "version":
            try:
                return await hound.call("version", {})
            except HoundError as exc:
                return {"error": str(exc)}
        if action == "cache_stats":
            try:
                engine_stats = await hound.call("cache_clear", {"all": False})
            except HoundError as exc:
                engine_stats = {"error": str(exc)}
            return {"engine": engine_stats, "store": store.stats()}
        if action == "cache_clear":
            try:
                return await hound.call("cache_clear", {"all": bool(all)})
            except HoundError as exc:
                return {"error": str(exc)}
        if action == "doctor":
            return _doctor()
        return {"error": f"unknown action {action!r}"}

    return server


# ------------------------------------------------------------------- helpers


def _content_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n\n".join(item for item in value if isinstance(item, str))
    return ""


async def _screenshot(hound: Hound, url: str, full_page: bool) -> dict[str, Any]:
    try:
        result = await hound.call(
            "mcp_screenshot", {"url": url, "options": {"full_page": full_page}}
        )
    except HoundError as exc:
        return {"error": str(exc), "url": url}
    # Hound returns image content; if structured came back empty, report honestly.
    out = store.store_dir() / "screenshots"
    out.mkdir(parents=True, exist_ok=True)
    return {
        "url": url,
        "note": "screenshot returned by engine",
        "engine": result,
        "dir": str(out),
    }


def _doctor() -> dict[str, Any]:
    binary = Hound.binary()
    hound_path = shutil.which(binary) if not os.path.isabs(binary) else binary
    version = None
    if hound_path:
        try:
            version = subprocess.run(
                [hound_path, "-v"], capture_output=True, text=True, timeout=20
            ).stdout.strip()
        except Exception:  # noqa: BLE001
            version = "unavailable"
    return {
        "web_access": __version__,
        "hound_binary": hound_path,
        "hound_version": version,
        "store": store.stats(),
        "python": os.sys.version.split()[0],
    }
