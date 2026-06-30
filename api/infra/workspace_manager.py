"""Owns the lifecycle of the active workspace's DB connections and background
tasks, and performs runtime switches between wiki folders.

A single instance lives on `app.state.workspace_manager`. `open()` brings a
workspace fully online (DBs, storage, factory, watcher, reconcile); `switch()`
tears the current one down and opens another in its place. Because the rest of
the app reads `app.state.sqlite_db` / `factory` / `storage_service` /
`workspace_path` (and `services.local._workspace_root()` reads
`settings.WORKSPACE_PATH`) per request, updating those handles + the settings
singleton is what makes the switch visible everywhere.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from pathlib import Path

from config import settings
from infra.db.sqlite import create_pool
from infra.storage.local import LocalStorageService
from services.local import LocalServiceFactory

logger = logging.getLogger("llmwiki.api")

_LOCAL_USER_ID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "local"))


class WorkspaceManager:
    def __init__(self, app, api_url: str):
        self.app = app
        self.api_url = api_url
        self.user_id = _LOCAL_USER_ID
        self._lock = asyncio.Lock()
        self.reconcile_task: asyncio.Task | None = None
        self.watcher_task: asyncio.Task | None = None
        self.reconcile_db = None
        self.watcher_db = None
        self.main_db = None

    async def open(self, workspace: Path) -> None:
        """Bring `workspace` online: dirs, DBs, services, background tasks."""
        from routes.files import set_workspace_root

        workspace = workspace.resolve()
        workspace.mkdir(parents=True, exist_ok=True)
        (workspace / "wiki").mkdir(exist_ok=True)
        (workspace / ".llmwiki").mkdir(exist_ok=True)
        (workspace / ".llmwiki" / "cache").mkdir(exist_ok=True)

        db_path = str(workspace / ".llmwiki" / "index.db")
        db = await create_pool(db_path)

        # Ensure a workspace row exists.
        cursor = await db.execute("SELECT id FROM workspace LIMIT 1")
        if not await cursor.fetchone():
            ws_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO workspace (id, name, description, user_id) VALUES (?, ?, '', ?)",
                (ws_id, workspace.name, self.user_id),
            )
            await db.commit()
            logger.info("Initialized local workspace: %s", workspace)

        # Each background writer gets its own connection.
        self.reconcile_db = await create_pool(db_path, init_schema=False)
        self.watcher_db = await create_pool(db_path, init_schema=False)

        storage = LocalStorageService(str(workspace), self.api_url)
        factory = LocalServiceFactory(db, storage, self.user_id)

        # Publish state so request handlers see the new workspace.
        self.app.state.sqlite_db = db
        self.app.state.storage_service = storage
        self.app.state.factory = factory
        self.app.state.workspace_path = str(workspace)
        self.main_db = db

        # `services.local._workspace_root()` reads this singleton directly.
        settings.WORKSPACE_PATH = str(workspace)
        set_workspace_root(str(workspace))

        from domain.local_processor import reconcile_workspace
        self.reconcile_task = asyncio.create_task(reconcile_workspace(self.reconcile_db, workspace))

        try:
            from domain.watcher import watch_workspace
            self.watcher_task = asyncio.create_task(watch_workspace(self.watcher_db, workspace))
            logger.info("File watcher started: %s", workspace)
        except ImportError:
            logger.warning("watchfiles not installed — file watcher disabled")
            self.watcher_task = None

        logger.info("Workspace online: %s", workspace)

    async def switch(self, workspace: Path) -> None:
        """Tear down the current workspace and open `workspace` in its place."""
        async with self._lock:
            await self._teardown()
            await self.open(workspace)

    async def _teardown(self) -> None:
        """Cancel background tasks and close all DB connections."""
        for attr in ("reconcile_task", "watcher_task"):
            task = getattr(self, attr)
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                except Exception:
                    logger.exception("error awaiting %s cancellation", attr)
                setattr(self, attr, None)

        for attr in ("reconcile_db", "watcher_db", "main_db"):
            db = getattr(self, attr)
            if db:
                try:
                    await db.close()
                except Exception:
                    logger.exception("error closing %s", attr)
                setattr(self, attr, None)

    async def shutdown(self) -> None:
        await self._teardown()
