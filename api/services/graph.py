"""Graph service — queries and rebuilds the document reference graph.

All SQL lives here. Routes should never execute queries directly.
"""

import json
import logging
import uuid

from infra.db.sqlite import rows_to_dicts, serialized_write
from services.references import build_lookup_maps, extract_references

logger = logging.getLogger(__name__)


def _parse_json(raw, default=None):
    """Safely parse a JSON string or return the value if already parsed."""
    if raw is None:
        return default
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return default


def _build_node(r: dict) -> dict:
    meta = _parse_json(r.get("metadata"), {})
    tags = _parse_json(r.get("tags"), [])
    return {
        "id": str(r["id"]),
        "title": r["title"] or r["filename"].removesuffix(".md").replace("-", " ").replace("_", " "),
        "description": meta.get("description") if isinstance(meta, dict) else None,
        "path": r["path"],
        "file_type": r["file_type"],
        "source_kind": r.get("source_kind", "source"),
        "tags": tags if isinstance(tags, list) else [],
    }


def _build_edge(r: dict) -> dict:
    return {
        "source": str(r["source_document_id"]),
        "target": str(r["target_document_id"]),
        "type": r["reference_type"],
        "page": r["page"],
    }


# ── Local (aiosqlite) ──

async def get_graph_local(db, user_id: str) -> dict:
    """Return {nodes, edges} for the knowledge graph viewer (SQLite)."""
    doc_cursor = await db.execute(
        "SELECT id, filename, title, path, file_type, source_kind, metadata, tags "
        "FROM documents WHERE user_id = ? AND status != 'failed'",
        (user_id,),
    )
    doc_rows = rows_to_dicts(doc_cursor, await doc_cursor.fetchall())

    doc_ids = {r["id"] for r in doc_rows}

    ref_cursor = await db.execute(
        "SELECT source_document_id, target_document_id, reference_type, page "
        "FROM document_references",
    )
    ref_rows = rows_to_dicts(ref_cursor, await ref_cursor.fetchall())

    return {
        "nodes": [_build_node(r) for r in doc_rows],
        "edges": [_build_edge(r) for r in ref_rows
                  if r["source_document_id"] in doc_ids and r["target_document_id"] in doc_ids],
    }


async def rebuild_local(db, user_id: str) -> dict:
    """Parse wiki pages and rebuild reference edges atomically (SQLite)."""
    docs_cursor = await db.execute(
        "SELECT id, filename, title, path, file_type, source_kind "
        "FROM documents WHERE user_id = ?",
        (user_id,),
    )
    all_docs = rows_to_dicts(docs_cursor, await docs_cursor.fetchall())

    filename_to_doc, base_to_doc, wiki_path_to_doc = build_lookup_maps(all_docs)

    wiki_cursor = await db.execute(
        "SELECT id, filename, path, content FROM documents "
        "WHERE user_id = ? AND source_kind = 'wiki' AND file_type = 'md' AND content IS NOT NULL",
        (user_id,),
    )
    wiki_pages = rows_to_dicts(wiki_cursor, await wiki_cursor.fetchall())

    # Delete + inserts commit together under the write lock; roll back on any
    # failure so a mid-rebuild error can't leave the graph wiped.
    async with serialized_write():
        try:
            await db.execute("DELETE FROM document_references")

            total_cites = 0
            total_links = 0

            for page in wiki_pages:
                content = page["content"] or ""
                if not content:
                    continue

                wiki_dir = page["path"].replace("/wiki/", "", 1) if page["path"].startswith("/wiki/") else ""
                edges = extract_references(
                    content, page["id"], wiki_dir,
                    filename_to_doc, base_to_doc, wiki_path_to_doc,
                )

                for edge in edges:
                    if edge["type"] == "cites":
                        await db.execute(
                            "INSERT INTO document_references (id, source_document_id, target_document_id, reference_type, page) "
                            "VALUES (?, ?, ?, 'cites', ?) "
                            "ON CONFLICT (source_document_id, target_document_id, reference_type) "
                            "DO UPDATE SET page = excluded.page",
                            (str(uuid.uuid4()), page["id"], edge["target_id"], edge["page"]),
                        )
                        total_cites += 1
                    else:
                        await db.execute(
                            "INSERT INTO document_references (id, source_document_id, target_document_id, reference_type) "
                            "VALUES (?, ?, ?, 'links_to') "
                            "ON CONFLICT (source_document_id, target_document_id, reference_type) DO NOTHING",
                            (str(uuid.uuid4()), page["id"], edge["target_id"]),
                        )
                        total_links += 1

            await db.commit()
        except Exception:
            await db.rollback()
            raise

    logger.info("Rebuilt references: %d citations, %d links", total_cites, total_links)
    return {"citations": total_cites, "links": total_links}
