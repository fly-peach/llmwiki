"""Cross-workspace registry of wiki folders.

Stored as JSON in the user's home (independent of any single workspace) so it
survives workspace switches and records which folders are known + which is
active. Paths are stored absolute.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_REGISTRY_FILE = Path.home() / ".llmwiki" / "workspaces.json"


def _read() -> dict:
    """Read the registry, returning an empty structure if missing/corrupt."""
    if not _REGISTRY_FILE.exists():
        return {"active": None, "folders": []}
    try:
        data = json.loads(_REGISTRY_FILE.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {"active": None, "folders": []}
        folders = data.get("folders")
        if not isinstance(folders, list):
            folders = []
        active = data.get("active")
        return {"active": active, "folders": [str(p) for p in folders]}
    except (json.JSONDecodeError, OSError):
        logger.warning("workspace registry corrupt, resetting: %s", _REGISTRY_FILE)
        return {"active": None, "folders": []}


def _write(data: dict) -> None:
    """Atomically write the registry."""
    _REGISTRY_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _REGISTRY_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, _REGISTRY_FILE)


def _normalize(path: str) -> str:
    return str(Path(path).resolve())


def list_folders() -> list[str]:
    """Return registered folder paths (absolute), in registration order."""
    return list(_read()["folders"])


def get_active() -> str | None:
    """Return the active folder path, or None."""
    return _read().get("active")


def set_active(path: str) -> str:
    """Mark `path` as the active folder, registering it if unknown."""
    path = _normalize(path)
    data = _read()
    if path not in data["folders"]:
        data["folders"].append(path)
    data["active"] = path
    _write(data)
    return path


def add_folder(path: str) -> str:
    """Register a folder if not already known. Returns the normalized path."""
    path = _normalize(path)
    data = _read()
    if path not in data["folders"]:
        data["folders"].append(path)
        _write(data)
    return path


def remove_folder(path: str) -> dict:
    """Unregister a folder (does NOT touch files on disk).

    If the removed folder was active, the active marker moves to the first
    remaining folder (or None if none remain). Returns the updated registry.
    """
    path = _normalize(path)
    data = _read()
    data["folders"] = [p for p in data["folders"] if p != path]
    if data.get("active") == path:
        data["active"] = data["folders"][0] if data["folders"] else None
    _write(data)
    return data


def ensure_initialized(default_path: str) -> None:
    """Create the registry on first run, seeding it with `default_path`."""
    if _REGISTRY_FILE.exists():
        return
    path = _normalize(default_path)
    _write({"active": path, "folders": [path]})
    logger.info("Initialized workspace registry at %s (active: %s)", _REGISTRY_FILE, path)
