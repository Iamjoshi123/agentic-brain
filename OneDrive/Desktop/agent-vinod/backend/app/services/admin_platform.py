"""Utility helpers for admin product config, knowledge ingestion, and citations."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import re
from typing import Any, Optional
import uuid

import httpx
from sqlmodel import Session, select

from app.config import settings
from app.models.admin import (
    KnowledgeJob,
    KnowledgeSource,
    ProductConfig,
    ProductSessionSettings,
    ProductShareSettings,
)
from app.models.document import Document
from app.models.session import SessionMessage
from app.models.workspace import Workspace
from app.retrieval.ingest import ingest_document


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_product_config(db: Session, workspace_id: str) -> ProductConfig:
    config = db.exec(select(ProductConfig).where(ProductConfig.workspace_id == workspace_id)).first()
    if config is None:
        config = ProductConfig(workspace_id=workspace_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def ensure_session_settings(db: Session, workspace_id: str) -> ProductSessionSettings:
    settings_row = db.exec(
        select(ProductSessionSettings).where(ProductSessionSettings.workspace_id == workspace_id)
    ).first()
    if settings_row is None:
        settings_row = ProductSessionSettings(workspace_id=workspace_id)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


def ensure_share_settings(db: Session, workspace: Workspace) -> ProductShareSettings:
    share = db.exec(
        select(ProductShareSettings).where(ProductShareSettings.workspace_id == workspace.id)
    ).first()
    if share is None:
        share = ProductShareSettings(workspace_id=workspace.id)
        db.add(share)
        db.commit()
        db.refresh(share)
    return share


def share_payload(workspace: Workspace, share: ProductShareSettings) -> dict[str, str]:
    frontend = settings.frontend_url.rstrip("/")
    live_link = f"{frontend}/meet/{workspace.public_token}"
    embed_code = (
        f'<iframe src="{live_link}" title="{share.share_title}" '
        'style="width:100%;min-height:720px;border:0;border-radius:24px;" allow="microphone; autoplay"></iframe>'
    )
    return {
        "live_link": live_link,
        "embed_code": embed_code,
        "share_title": share.share_title,
        "share_description": share.share_description,
    }


def start_job(db: Session, workspace_id: str, source_id: str, job_type: str = "ingest") -> KnowledgeJob:
    job = KnowledgeJob(
        workspace_id=workspace_id,
        source_id=source_id,
        job_type=job_type,
        status="running",
        started_at=utc_now(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def finish_job(db: Session, job: KnowledgeJob, *, status: str, error_message: str | None = None) -> KnowledgeJob:
    job.status = status
    job.error_message = error_message
    job.finished_at = utc_now()
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def ingest_knowledge_source(
    db: Session,
    source: KnowledgeSource,
    *,
    content_text: str,
    file_type: str,
    metadata: Optional[dict[str, Any]] = None,
) -> tuple[KnowledgeSource, Document]:
    metadata = metadata or {}
    document = Document(
        workspace_id=source.workspace_id,
        filename=source.file_name or source.title,
        file_type=file_type,
        content_text=content_text,
        metadata_json=json.dumps(
            {
                "knowledge_source_id": source.id,
                "source_type": source.source_type,
                "title": source.title,
                "source_url": source.source_url,
                **metadata,
            }
        ),
        knowledge_source_id=source.id,
        status="pending",
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    ingest_document(db, document, content_override=content_text)
    db.refresh(document)

    source.document_id = document.id
    source.content_text = content_text if source.content_text is None else source.content_text
    source.status = document.status
    source.sync_status = "ready" if document.status == "ready" else "error"
    source.updated_at = utc_now()
    db.add(source)
    db.commit()
    db.refresh(source)
    return source, document


def fetch_help_doc_text(url: str) -> str:
    response = httpx.get(url, timeout=10.0, follow_redirects=True)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    body = response.text
    if "html" not in content_type and "<html" not in body.lower():
        return body
    text = re.sub(r"<script[\s\S]*?</script>", " ", body, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def save_upload(filename: str, payload: bytes) -> str:
    upload_root = Path(settings.admin_upload_dir)
    upload_root.mkdir(parents=True, exist_ok=True)
    ext = Path(filename).suffix
    resolved = upload_root / f"{uuid.uuid4().hex}{ext}"
    resolved.write_bytes(payload)
    return str(resolved)


def transcribe_video(file_path: str, *, fallback_text: str | None = None) -> str:
    if fallback_text:
        return fallback_text
    try:
        from faster_whisper import WhisperModel
    except Exception:
        return fallback_text or ""

    try:
        model = WhisperModel("tiny", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(file_path)
        return " ".join(segment.text.strip() for segment in segments if segment.text).strip()
    except Exception:
        return fallback_text or ""


def mask_api_key(raw: str) -> str:
    if len(raw) <= 6:
        return "*" * len(raw)
    return f"{raw[:3]}{'*' * (len(raw) - 6)}{raw[-3:]}"


def parse_json_array(value: str | None) -> list[Any]:
    if not value:
        return []
    try:
        data = json.loads(value)
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def parse_json_object(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        data = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def resolve_citations(db: Session, document_ids: list[str]) -> list[dict[str, Any]]:
    if not document_ids:
        return []
    documents = db.exec(select(Document).where(Document.id.in_(document_ids))).all()
    by_id = {document.id: document for document in documents}
    citations = []
    for doc_id in document_ids:
        document = by_id.get(doc_id)
        if document is None:
            continue
        metadata = parse_json_object(document.metadata_json)
        excerpt = (document.content_text or "")[:240]
        citations.append(
            {
                "document_id": document.id,
                "title": metadata.get("title") or document.filename,
                "source_type": metadata.get("source_type") or document.file_type,
                "source_url": metadata.get("source_url"),
                "excerpt": excerpt,
            }
        )
    return citations


def fallback_citations_for_query(db: Session, workspace_id: str, query: str, *, limit: int = 3) -> list[dict[str, Any]]:
    keywords = [token for token in re.findall(r"[a-z0-9]+", query.lower()) if len(token) > 2]
    if not keywords:
        return []
    documents = db.exec(
        select(Document).where(Document.workspace_id == workspace_id).order_by(Document.created_at.desc())
    ).all()
    scored: list[tuple[int, Document]] = []
    for document in documents:
        haystack = f"{document.filename}\n{document.content_text or ''}".lower()
        score = sum(1 for keyword in keywords if keyword in haystack)
        if score > 0:
            scored.append((score, document))
    scored.sort(key=lambda item: (-item[0], item[1].created_at), reverse=False)
    return resolve_citations(db, [document.id for _, document in scored[:limit]])


def session_citations(db: Session, session_id: str) -> list[dict[str, Any]]:
    messages = db.exec(
        select(SessionMessage)
        .where(SessionMessage.session_id == session_id, SessionMessage.role == "agent")
        .order_by(SessionMessage.created_at)
    ).all()
    seen: list[str] = []
    for message in messages:
        metadata = parse_json_object(message.metadata_json)
        raw_citations = metadata.get("citations", [])
        if isinstance(raw_citations, list):
            for item in raw_citations:
                if isinstance(item, str) and item and item not in seen:
                    seen.append(item)
    return resolve_citations(db, seen)
