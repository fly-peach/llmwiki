"""Local MCP server for stdio (Claude Desktop / Claude Code / Cursor).

One workspace = one MCP server. Filesystem is truth. SQLite is the index.

Usage:
    python -m local_server --workspace ~/research
    python -m local_server ~/research
    python -m local_server --workspace ~/research --preset read-only
    python -m local_server --workspace ~/research --allow "read,search,create"
"""

import argparse
import asyncio
import logging
import os
import sys
import uuid
from datetime import date
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("llmwiki.local")

_LOCAL_USER_ID = os.environ.get("LLMWIKI_USER_ID", str(uuid.uuid5(uuid.NAMESPACE_DNS, "local")))
os.environ["SUPAVAULT_USER_ID"] = _LOCAL_USER_ID


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="LLM Wiki local MCP server")
    parser.add_argument("workspace", nargs="?", default=".", help="Path to workspace folder")
    parser.add_argument("--workspace", dest="workspace_flag", default=None, help="Path to workspace folder")
    parser.add_argument(
        "--preset",
        default=None,
        choices=["read-only", "no-delete", "wiki-only", "full"],
        help="Permission preset (read-only, no-delete, wiki-only, full)"
    )
    parser.add_argument(
        "--allow",
        default=None,
        help="Comma-separated list of allowed tools (e.g. 'read,search,create')"
    )
    return parser.parse_args()


async def _init_workspace(workspace_path: str) -> None:
    """Initialize workspace: create dirs, SQLite, default workspace row, scaffold wiki files."""
    ws = Path(workspace_path).resolve()

    (ws / "wiki").mkdir(parents=True, exist_ok=True)
    (ws / ".llmwiki").mkdir(parents=True, exist_ok=True)
    (ws / ".llmwiki" / "cache").mkdir(parents=True, exist_ok=True)

    from vaultfs import SqliteVaultFS
    await SqliteVaultFS.init(str(ws))

    fs = SqliteVaultFS(_LOCAL_USER_ID)
    existing = await fs.get_workspace()
    if not existing:
        ws_name = ws.name
        ws_id = await fs.ensure_workspace(ws_name)
        today = date.today().isoformat()
        overview_content = (
            "---\n"
            "title: Overview\n"
            f"description: Research hub for {ws_name}.\n"
            f"date: {today}\n"
            "tags: [overview, wiki]\n"
            "---\n\n"
            f"This wiki tracks research on {ws_name}.\n\n"
            "## Key Findings\n\n"
            "No sources ingested yet.\n\n"
            "## Recent Updates\n\n"
            "No activity yet."
        )
        log_content = "Chronological record of ingests, queries, and maintenance passes."

        await fs.create_document(
            ws_id, "overview.md", "Overview", "/wiki/", "md",
            overview_content,
            ["overview", "wiki"],
            date=today,
            metadata={"description": f"Research hub for {ws_name}."},
        )
        await fs.create_document(
            ws_id, "log.md", "Log", "/wiki/", "md",
            log_content,
            ["log"],
        )

        overview_path = ws / "wiki" / "overview.md"
        if not overview_path.exists():
            overview_path.write_text(overview_content + "\n", encoding="utf-8")
        log_path = ws / "wiki" / "log.md"
        if not log_path.exists():
            log_path.write_text(log_content + "\n", encoding="utf-8")

        logger.info("Initialized workspace: %s", ws)
    else:
        logger.info("Workspace ready: %s", ws)


def main():
    args = _parse_args()
    workspace = args.workspace_flag or args.workspace
    workspace = str(Path(workspace).resolve())

    # 解析权限
    from tools import resolve_allowed_tools, PRESETS
    allowed_tools = resolve_allowed_tools(allow=args.allow, preset=args.preset or "full")

    # 确定权限模式名称
    if args.preset:
        perm_mode = args.preset
    elif args.allow:
        perm_mode = f"custom({','.join(sorted(allowed_tools))})"
    else:
        perm_mode = "full"

    logger.info("MCP Permission mode: %s", perm_mode)
    logger.info("Allowed tools: %s", sorted(allowed_tools))

    sys.modules["local_server"] = sys.modules[__name__]

    loop = asyncio.new_event_loop()
    loop.run_until_complete(_init_workspace(workspace))

    from mcp.server.fastmcp import FastMCP
    from tools import register
    from vaultfs import SqliteVaultFS

    # 根据权限生成不同的 instructions
    if args.preset == "read-only":
        instructions = (
            "You are connected to an LLM Wiki workspace in READ-ONLY mode. "
            "You can read, search, and browse the user's files and wiki pages, "
            "but you cannot create, edit, or delete anything. "
            "Call the `guide` tool first to see available knowledge bases and learn the full workflow."
        )
    elif args.preset == "no-delete":
        instructions = (
            "You are connected to an LLM Wiki workspace in NO-DELETE mode. "
            "You can read, search, create, and edit content, "
            "but you cannot delete any files. "
            "Call the `guide` tool first to see available knowledge bases and learn the full workflow."
        )
    elif args.preset == "wiki-only":
        instructions = (
            "You are connected to an LLM Wiki workspace in WIKI-ONLY mode. "
            "You can read and search all indexed content, but create/edit/append writes "
            "are restricted to the `/wiki/` folder. Do not modify raw source files. "
            "Deletion is disabled. "
            "Call the `guide` tool first to see available knowledge bases and learn the full workflow."
        )
    else:
        instructions = (
            "You are connected to an LLM Wiki workspace. The user has uploaded files, notes, "
            "and documents that you can read, search, edit, and organize. "
            "Call the `guide` tool first to see available knowledge bases and learn the full workflow."
        )

    mcp = FastMCP(
        name="LLM Wiki",
        instructions=instructions,
    )

    def _get_user_id(ctx):
        return _LOCAL_USER_ID

    # 注册工具，传入允许的工具列表
    register(
        mcp,
        _get_user_id,
        lambda user_id: SqliteVaultFS(user_id),
        allowed_tools=allowed_tools,
        permission_mode=perm_mode,
    )

    @mcp.tool(name="ping", description="Test connectivity")
    async def ping() -> str:
        return "pong"

    logger.info("Local MCP server ready — workspace: %s (permissions: %s)", workspace, perm_mode)
    asyncio.run(mcp.run_stdio_async())


if __name__ == "__main__":
    main()
