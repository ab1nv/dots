"""CLI: web-access (stdio MCP by default)."""

from __future__ import annotations

import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="web-access", description="Merged web access MCP for OpenCode"
    )
    parser.add_argument(
        "--http", action="store_true", help="serve streamable HTTP instead of stdio"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument(
        "--doctor", action="store_true", help="print diagnostics and exit"
    )
    args = parser.parse_args()

    if args.doctor:
        from .server import _doctor

        info = _doctor()
        for key, value in info.items():
            print(f"{key}: {value}")
        if not info.get("hound_binary"):
            sys.exit(
                "hound binary not found (pipx install hound-mcp / uv tool install hound-mcp)"
            )
        return

    from .server import create_server

    server = create_server(host=args.host, port=args.port)
    server.run(transport="streamable-http" if args.http else "stdio")


if __name__ == "__main__":
    main()
