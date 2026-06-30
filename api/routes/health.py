from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/v1/workspace")
async def workspace_info(request: Request):
    """Return workspace info for local mode."""
    ws_path = getattr(request.app.state, 'workspace_path', '.')
    return {"workspace_path": ws_path}
