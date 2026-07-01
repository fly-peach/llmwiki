import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware as _BaseCORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send


class CORSMiddleware(_BaseCORSMiddleware):
    """CORS middleware that passes WebSocket connections through.

    WebSocket auth is handled by JWT verification in the handler, not by
    origin checks. HTTP requests still get full CORS protection.
    """

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "websocket":
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)

from config import settings

logger = logging.getLogger("llmwiki.api")

from routes.health import router as health_router
from routes.knowledge_bases import router as knowledge_bases_router
from routes.documents import router as documents_router
from routes.me import router as me_router
from routes.usage import router as usage_router
from routes.workspaces import router as workspaces_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from pathlib import Path
    from infra.workspace_manager import WorkspaceManager
    from infra import workspace_registry

    local_user_id = await _local_lifespan_inner(app)

    # Pick the initial workspace: the registry's last-active folder, falling
    # back to the env-configured WORKSPACE_PATH.
    workspace_registry.ensure_initialized(settings.WORKSPACE_PATH)
    active = workspace_registry.get_active() or settings.WORKSPACE_PATH
    initial_ws = Path(active).resolve()

    mgr = WorkspaceManager(app, settings.API_URL)
    app.state.workspace_manager = mgr
    await mgr.open(initial_ws)

    try:
        yield
    finally:
        await mgr.shutdown()


async def _local_lifespan_inner(app: FastAPI):
    """Local mode: set up single-user auth. DB/storage/tasks are handled by
    WorkspaceManager once the initial workspace is opened."""
    import uuid
    from infra.auth.local import LocalAuthProvider

    local_user_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, "local"))
    auth_provider = LocalAuthProvider(local_user_id)

    app.state.mode = "local"
    app.state.auth_provider = auth_provider
    # These are populated by WorkspaceManager.open(), but are referenced by
    # request handlers; declare them up front so attribute access never errors
    # during the brief window before open() completes.
    app.state.sqlite_db = None
    app.state.storage_service = None
    app.state.factory = None
    app.state.workspace_path = settings.WORKSPACE_PATH

    logger.info("Local mode — initial workspace: %s", settings.WORKSPACE_PATH)
    return local_user_id


app = FastAPI(title="LLM Wiki API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Location", "Upload-Offset", "Upload-Length",
        "X-Document-Id",
    ],
)

app.include_router(health_router)
app.include_router(me_router)
app.include_router(usage_router)
app.include_router(knowledge_bases_router)
app.include_router(documents_router)
app.include_router(workspaces_router)

from routes.local_upload import router as local_upload_router
from routes.files import router as files_router, set_workspace_root
from routes.local_graph import router as local_graph_router
app.include_router(local_upload_router)
app.include_router(files_router)
app.include_router(local_graph_router)
set_workspace_root(settings.WORKSPACE_PATH)
