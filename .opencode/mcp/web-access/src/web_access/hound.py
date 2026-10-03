"""Hound engine client.

Spawns the installed `hound` MCP server (master-fetch) over stdio and forwards
tool calls. All heavy lifting — keyless multi-engine search, Patchright stealth
fetch, Turnstile, crawl/sitemap, PDF/OCR, caching — stays in Hound.
"""

from __future__ import annotations

import json
import os
import shutil
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


class HoundError(RuntimeError):
    pass


class Hound:
    def __init__(self, session: ClientSession):
        self.session = session

    @classmethod
    def binary(cls) -> str:
        return (
            os.environ.get("WEB_ACCESS_HOUND_BIN") or shutil.which("hound") or "hound"
        )

    @classmethod
    def server_params(cls) -> StdioServerParameters:
        return StdioServerParameters(
            command=cls.binary(),
            args=[],
            env={
                **os.environ,
                "HOUND_BROWSER_IDLE_TIMEOUT": os.environ.get(
                    "WEB_ACCESS_BROWSER_IDLE_TIMEOUT", "300"
                ),
            },
        )

    async def call(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        try:
            result = await self.session.call_tool(name, arguments)
        except Exception as exc:  # noqa: BLE001 - surface any engine failure verbatim
            raise HoundError(f"hound {name} failed: {exc}") from exc

        structured = getattr(result, "structuredContent", None)
        if isinstance(structured, dict):
            if getattr(result, "isError", False):
                raise HoundError(_text(structured) or f"hound {name} returned an error")
            return structured

        texts = [c.text for c in (result.content or []) if getattr(c, "text", None)]
        raw = "\n".join(texts)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            if getattr(result, "isError", False):
                raise HoundError(raw or f"hound {name} returned an error") from exc
            return {"content": raw}
        if getattr(result, "isError", False):
            raise HoundError(_text(parsed) or f"hound {name} returned an error")
        return parsed if isinstance(parsed, dict) else {"content": parsed}


def _text(value: Any) -> str:
    if isinstance(value, dict):
        for key in ("error", "message", "content", "detail"):
            if key in value and value[key]:
                return str(value[key])
        return json.dumps(value)[:500]
    return str(value or "")
