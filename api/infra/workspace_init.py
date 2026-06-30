"""Shared workspace initialization logic.

Creates the on-disk structure (`wiki/`, `.llmwiki/`, `.llmwiki/cache/`),
the SQLite index with schema + a `workspace` row, and the scaffold wiki
pages (`overview.md`, `log.md`). Used by the API when registering a new
wiki folder at runtime; mirrors what the `llmwiki init` CLI does.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from infra.db.sqlite import create_pool

logger = logging.getLogger(__name__)

_LOCAL_USER_ID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "local"))

_OVERVIEW_BODY = (
    "This wiki tracks research on {name}.\n\n"
    "## Key Findings\n\nNo sources ingested yet.\n\n"
    "## Recent Updates\n\nNo activity yet.\n"
)
_LOG_BODY = "Chronological record of ingests, queries, and maintenance passes.\n"


def is_initialized(workspace: Path) -> bool:
    return (workspace / ".llmwiki" / "index.db").is_file()


async def init_workspace(workspace: Path) -> None:
    """Ensure `workspace` has its directory structure, index DB, workspace row,
    and scaffold wiki pages. Idempotent — safe to call on an already-initialized
    folder (only fills in what's missing)."""
    workspace = workspace.resolve()
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "wiki").mkdir(exist_ok=True)
    (workspace / ".llmwiki").mkdir(exist_ok=True)
    (workspace / ".llmwiki" / "cache").mkdir(exist_ok=True)

    db_path = str(workspace / ".llmwiki" / "index.db")

    # init_schema=True is idempotent (CREATE TABLE IF NOT EXISTS) and also
    # applies the `workspace.kind` migration to older DBs — matches the
    # normal startup path.
    db = await create_pool(db_path)

    # Ensure a workspace row exists.
    cursor = await db.execute("SELECT id FROM workspace LIMIT 1")
    row = await cursor.fetchone()
    if not row:
        ws_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO workspace (id, name, description, user_id) VALUES (?, ?, '', ?)",
            (ws_id, workspace.name, _LOCAL_USER_ID),
        )
        await db.commit()
        logger.info("Created workspace row for: %s", workspace)

    await db.close()

    # Scaffold wiki page files if absent.
    overview = workspace / "wiki" / "overview.md"
    if not overview.exists():
        overview.write_text(_OVERVIEW_BODY.format(name=workspace.name), encoding="utf-8")

    log = workspace / "wiki" / "log.md"
    if not log.exists():
        log.write_text(_LOG_BODY, encoding="utf-8")

    logger.info("Workspace ready: %s", workspace)
