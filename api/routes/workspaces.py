"""Workspace folder management — register, list, switch, remove wiki folders.

Each folder carries its own `.llmwiki/index.db`. Switching re-points the running
server at a different folder's DB at runtime (no restart). See
`infra.workspace_manager.WorkspaceManager`.
"""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from deps import get_user_id
from infra import workspace_registry
from infra.workspace_init import init_workspace, is_initialized

router = APIRouter(prefix="/v1/workspaces", tags=["workspaces"])


class WorkspacePath(BaseModel):
    path: str


def _folder_info(path_str: str, active: str | None) -> dict:
    p = Path(path_str)
    return {
        "path": path_str,
        "name": p.name or path_str,
        "exists": p.is_dir(),
        "initialized": is_initialized(p),
        "active": path_str == active,
    }


@router.get("")
async def list_workspaces(request: Request, _user_id: str = Depends(get_user_id)):
    """List registered wiki folders with the active one flagged."""
    active = workspace_registry.get_active() or getattr(request.app.state, "workspace_path", None)
    folders = workspace_registry.list_folders()
    if not folders and active:
        folders = [active]
    return {
        "active": active,
        "folders": [_folder_info(p, active) for p in folders],
    }


@router.post("")
async def add_workspace(body: WorkspacePath, request: Request, _user_id: str = Depends(get_user_id)):
    """Register a folder (initializing it if needed) and switch to it."""
    if not body.path or not body.path.strip():
        raise HTTPException(status_code=400, detail="path is required")
    workspace = Path(body.path).resolve()
    if not workspace.exists():
        raise HTTPException(status_code=404, detail=f"Folder does not exist: {workspace}")
    if not workspace.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a folder: {workspace}")

    workspace_registry.add_folder(str(workspace))
    await init_workspace(workspace)

    mgr = request.app.state.workspace_manager
    await mgr.switch(workspace)
    workspace_registry.set_active(str(workspace))

    active = str(workspace)
    return {
        "active": active,
        "folders": [_folder_info(p, active) for p in workspace_registry.list_folders()],
    }


@router.post("/switch")
async def switch_workspace(body: WorkspacePath, request: Request, _user_id: str = Depends(get_user_id)):
    """Switch the active workspace to an already-registered, initialized folder."""
    if not body.path or not body.path.strip():
        raise HTTPException(status_code=400, detail="path is required")
    workspace = Path(body.path).resolve()
    registered = workspace_registry.list_folders()
    if str(workspace) not in registered:
        raise HTTPException(status_code=404, detail="Folder is not registered")
    if not is_initialized(workspace):
        raise HTTPException(status_code=400, detail="Folder is not initialized. Add it first.")

    mgr = request.app.state.workspace_manager
    await mgr.switch(workspace)
    workspace_registry.set_active(str(workspace))

    active = str(workspace)
    return {
        "active": active,
        "folders": [_folder_info(p, active) for p in workspace_registry.list_folders()],
    }


@router.delete("")
async def remove_workspace(path: str, request: Request, _user_id: str = Depends(get_user_id)):
    """Unregister a folder. Files on disk are left untouched."""
    if not path or not path.strip():
        raise HTTPException(status_code=400, detail="path is required")
    workspace = str(Path(path).resolve())
    registered = workspace_registry.list_folders()
    if workspace not in registered:
        raise HTTPException(status_code=404, detail="Folder is not registered")

    data = workspace_registry.remove_folder(workspace)

    # If we removed the active folder, switch to the new active (if any).
    new_active = data.get("active")
    if new_active and new_active != getattr(request.app.state, "workspace_path", None):
        mgr = request.app.state.workspace_manager
        await mgr.switch(Path(new_active))
    elif not new_active:
        raise HTTPException(status_code=400, detail="Cannot remove the only registered workspace")

    return {
        "active": new_active,
        "folders": [_folder_info(p, new_active) for p in workspace_registry.list_folders()],
    }
