"""Admin console routes for products, knowledge, sessions, branding, settings, and analytics."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from app.analytics.summary import generate_session_summary
from app.config import settings
from app.database import get_session
from app.models.admin import (
    AdminUser,
    ApiCredentialSet,
    ApiCredentialWrite,
    BillingAccount,
    BillingUpdate,
    BrandingSettings,
    BrandingUpdate,
    Invite,
    InviteCreate,
    KnowledgeJob,
    KnowledgeSource,
    KnowledgeSourceCreate,
    Membership,
    ProductConfig,
    ProductConfigUpdate,
    ProductOverviewUpdate,
    ProductSessionSettings,
    ProductSessionSettingsUpdate,
    ProductShareSettings,
    ProductShareSettingsUpdate,
    SessionRecording,
    TestAgentRequest,
)
from app.models.document import Document
from app.models.session import BrowserAction, DemoSession, SessionMessage
from app.models.workspace import Workspace
from app.services.admin_auth import admin_context_dependency
from app.services.admin_platform import (
    ensure_product_config,
    ensure_session_settings,
    ensure_share_settings,
    fallback_citations_for_query,
    fetch_help_doc_text,
    finish_job,
    ingest_knowledge_source,
    mask_api_key,
    parse_json_array,
    parse_json_object,
    resolve_citations,
    save_upload,
    session_citations,
    share_payload,
    start_job,
    transcribe_video,
    utc_now,
)
from app.services.encryption import encrypt
from app.services.planner import plan_response

router = APIRouter(prefix="/admin", tags=["admin"])


def _org_workspace_query(organization_id: str):
    return select(Workspace).where(Workspace.organization_id == organization_id)


def _product_or_404(db: Session, organization_id: str, workspace_id: str) -> Workspace:
    workspace = db.exec(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.organization_id == organization_id,
        )
    ).first()
    if workspace is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return workspace


def _summary_for_session(db: Session, session: DemoSession):
    from app.models.session import SessionSummary

    summary = db.exec(select(SessionSummary).where(SessionSummary.session_id == session.id)).first()
    if summary is None and session.status == "ended":
        summary = generate_session_summary(db, session.id)
    return summary


def _product_summary(db: Session, workspace: Workspace) -> dict[str, Any]:
    config = ensure_product_config(db, workspace.id)
    session_settings = ensure_session_settings(db, workspace.id)
    share = ensure_share_settings(db, workspace)
    knowledge_count = db.exec(
        select(KnowledgeSource).where(KnowledgeSource.workspace_id == workspace.id)
    ).all()
    sessions = db.exec(select(DemoSession).where(DemoSession.workspace_id == workspace.id)).all()
    return {
        "id": workspace.id,
        "organization_id": workspace.organization_id,
        "name": workspace.name,
        "description": workspace.description,
        "product_url": workspace.product_url,
        "allowed_domains": workspace.allowed_domains,
        "browser_auth_mode": workspace.browser_auth_mode,
        "public_token": workspace.public_token,
        "is_active": workspace.is_active,
        "created_at": workspace.created_at,
        "updated_at": workspace.updated_at,
        "knowledge_count": len(knowledge_count),
        "session_count": len(sessions),
        "recording_enabled": session_settings.recording_enabled,
        "citation_mode": config.citation_mode,
        "navigation_style": config.navigation_style,
        **share_payload(workspace, share),
    }


def _dashboard_payload(db: Session, organization_id: str) -> dict[str, Any]:
    products = db.exec(_org_workspace_query(organization_id).where(Workspace.is_active)).all()
    sessions = db.exec(
        select(DemoSession).where(DemoSession.workspace_id.in_([product.id for product in products]))
    ).all() if products else []
    completed_sessions = [session for session in sessions if session.status == "ended"]
    summaries = [_summary_for_session(db, session) for session in completed_sessions]
    summaries = [summary for summary in summaries if summary is not None]

    top_questions: list[str] = []
    objections: list[str] = []
    features: list[str] = []
    for summary in summaries:
        top_questions.extend(parse_json_array(summary.top_questions))
        objections.extend(parse_json_array(summary.objections))
        features.extend(parse_json_array(summary.features_interest))

    average_intent = round(
        sum(summary.lead_intent_score for summary in summaries) / len(summaries),
        1,
    ) if summaries else 0.0
    positive_intent_sessions = sum(1 for summary in summaries if summary.lead_intent_score >= 70)

    return {
        "stats": {
            "products": len(products),
            "demos_taken": len(sessions),
            "completed_demos": len(completed_sessions),
            "positive_intent_sessions": positive_intent_sessions,
            "average_intent_score": average_intent,
            "transcript_coverage": len(sessions),
            "recording_enabled_products": sum(
                1
                for product in products
                if ensure_session_settings(db, product.id).recording_enabled
            ),
        },
        "reports": {
            "top_questions": list(dict.fromkeys(top_questions))[:8],
            "objections": list(dict.fromkeys(objections))[:8],
            "features_interest": list(dict.fromkeys(features))[:8],
        },
        "products": [_product_summary(db, product) for product in products],
    }


@router.get("/dashboard")
def dashboard(
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    return _dashboard_payload(db, context["organization"].id)


@router.get("/products")
def list_products(
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    products = db.exec(_org_workspace_query(context["organization"].id).order_by(Workspace.created_at.desc())).all()
    return [_product_summary(db, product) for product in products]


@router.post("/products")
def create_product(
    data: ProductOverviewUpdate,
    context: dict = Depends(admin_context_dependency("admin")),
    db: Session = Depends(get_session),
):
    workspace = Workspace(
        organization_id=context["organization"].id,
        name=data.name,
        description=data.description,
        product_url=data.product_url,
        allowed_domains=data.allowed_domains or "",
        browser_auth_mode=data.browser_auth_mode,
        is_active=data.is_active,
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    ensure_product_config(db, workspace.id)
    ensure_session_settings(db, workspace.id)
    ensure_share_settings(db, workspace)
    return _product_summary(db, workspace)


@router.get("/products/{workspace_id}")
def get_product(
    workspace_id: str,
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    workspace = _product_or_404(db, context["organization"].id, workspace_id)
    return _product_summary(db, workspace)


@router.patch("/products/{workspace_id}")
def update_product(
    workspace_id: str,
    data: ProductOverviewUpdate,
    context: dict = Depends(admin_context_dependency("editor")),
    db: Session = Depends(get_session),
):
    workspace = _product_or_404(db, context["organization"].id, workspace_id)
    workspace.name = data.name
    workspace.description = data.description
    workspace.product_url = data.product_url
    workspace.allowed_domains = data.allowed_domains or ""
    workspace.browser_auth_mode = data.browser_auth_mode
    workspace.is_active = data.is_active
    workspace.updated_at = utc_now()
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return _product_summary(db, workspace)


@router.get("/products/{workspace_id}/knowledge")
def list_knowledge_sources(
    workspace_id: str,
    source_type: Optional[str] = None,
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    _product_or_404(db, context["organization"].id, workspace_id)
    query = select(KnowledgeSource).where(KnowledgeSource.workspace_id == workspace_id)
    if source_type:
        query = query.where(KnowledgeSource.source_type == source_type)
    sources = db.exec(query.order_by(KnowledgeSource.created_at.desc())).all()
    jobs = db.exec(select(KnowledgeJob).where(KnowledgeJob.workspace_id == workspace_id)).all()
    jobs_by_source: dict[str, list[dict[str, Any]]] = {}
    for job in jobs:
        jobs_by_source.setdefault(job.source_id, []).append(
            {
                "id": job.id,
                "job_type": job.job_type,
                "status": job.status,
                "error_message": job.error_message,
                "created_at": job.created_at,
                "started_at": job.started_at,
                "finished_at": job.finished_at,
            }
        )
    return [
        {
            "id": source.id,
            "workspace_id": source.workspace_id,
            "source_type": source.source_type,
            "title": source.title,
            "source_url": source.source_url,
            "file_name": source.file_name,
            "status": source.status,
            "sync_status": source.sync_status,
            "metadata": parse_json_object(source.metadata_json),
            "document_id": source.document_id,
            "created_at": source.created_at,
            "updated_at": source.updated_at,
            "jobs": jobs_by_source.get(source.id, []),
        }
        for source in sources
    ]


def _create_source(
    db: Session,
    workspace_id: str,
    *,
    source_type: str,
    title: str,
    content_text: str,
    metadata: Optional[dict[str, Any]] = None,
    source_url: str | None = None,
    file_name: str | None = None,
    transcript_text: str | None = None,
    file_path: str | None = None,
    file_type: str = "md",
) -> dict[str, Any]:
    source = KnowledgeSource(
        workspace_id=workspace_id,
        source_type=source_type,
        title=title,
        source_url=source_url,
        file_name=file_name,
        file_path=file_path,
        transcript_text=transcript_text,
        content_text=content_text if source_type != "video" else None,
        status="processing",
        sync_status="syncing",
        metadata_json=json.dumps(metadata or {}),
    )
    db.add(source)
    db.commit()
    db.refresh(source)

    job = start_job(db, workspace_id, source.id)
    try:
        source, document = ingest_knowledge_source(
            db,
            source,
            content_text=content_text,
            file_type=file_type,
            metadata=metadata,
        )
    except Exception as exc:
        source.status = "error"
        source.sync_status = "error"
        db.add(source)
        db.commit()
        finish_job(db, job, status="failed", error_message=str(exc))
        raise HTTPException(status_code=400, detail=f"Knowledge ingestion failed: {exc}") from exc

    finish_job(db, job, status="completed")
    return {
        "id": source.id,
        "document_id": document.id,
        "status": source.status,
        "sync_status": source.sync_status,
    }


@router.post("/products/{workspace_id}/knowledge/help-docs")
def add_help_doc(
    workspace_id: str,
    data: KnowledgeSourceCreate,
    context: dict = Depends(admin_context_dependency("editor")),
    db: Session = Depends(get_session),
):
    _product_or_404(db, context["organization"].id, workspace_id)
    text = data.content_text or (fetch_help_doc_text(data.source_url) if data.source_url else "")
    return _create_source(
        db,
        workspace_id,
        source_type="help_doc_url",
        title=data.title,
        content_text=text,
        metadata={"kind": "help_doc"},
        source_url=data.source_url,
        file_type="html",
    )


@router.post("/products/{workspace_id}/knowledge/custom-entries")
def add_custom_entry(
    workspace_id: str,
    data: KnowledgeSourceCreate,
    context: dict = Depends(admin_context_dependency("editor")),
    db: Session = Depends(get_session),
):
    _product_or_404(db, context["organization"].id, workspace_id)
    metadata = parse_json_object(data.metadata_json)
    question = metadata.get("question") or data.title
    answer = metadata.get("answer") or data.content_text or ""
    combined = f"Question: {question}\nAnswer: {answer}"
    return _create_source(
        db,
        workspace_id,
        source_type="custom_entry",
        title=data.title,
        content_text=combined,
        metadata={"kind": "custom_entry", "question": question, "answer": answer},
        file_type="manual_note",
    )


@router.post("/products/{workspace_id}/knowledge/files")
async def add_file_source(
    workspace_id: str,
    title: str = Form(...),
    content_text: str = Form(default=""),
    file_type: str = Form(default="txt"),
    file: UploadFile = File(...),
    context: dict = Depends(admin_context_dependency("editor")),
    db: Session = Depends(get_session),
):
    _product_or_404(db, context["organization"].id, workspace_id)
    raw = await file.read()
    path = save_upload(file.filename or title, raw)
    text = content_text or raw.decode("utf-8", errors="replace")
    return _create_source(
        db,
        workspace_id,
        source_type="file",
        title=title,
        content_text=text,
        metadata={"kind": "file", "file_name": file.filename},
        file_name=file.filename or title,
        file_path=path,
        file_type=file_type,
    )


@router.post("/products/{workspace_id}/knowledge/videos")
async def add_video_source(
    workspace_id: str,
    title: str = Form(...),
    transcript_text: str = Form(default=""),
    file: UploadFile = File(...),
    context: dict = Depends(admin_context_dependency("editor")),
    db: Session = Depends(get_session),
):
    _product_or_404(db, context["organization"].id, workspace_id)
    raw = await file.read()
    path = save_upload(file.filename or title, raw)
    transcript = transcribe_video(path, fallback_text=transcript_text)
    return _create_source(
        db,
        workspace_id,
        source_type="video",
        title=title,
        content_text=transcript,
        transcript_text=transcript,
        metadata={"kind": "video", "file_name": file.filename},
        file_name=file.filename or title,
        file_path=path,
        file_type="video_transcript",
    )


@router.get("/products/{workspace_id}/config")
def get_product_config(
    workspace_id: str,
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    _product_or_404(db, context["organization"].id, workspace_id)
    return ensure_product_config(db, workspace_id)


@router.put("/products/{workspace_id}/config")
def update_product_config(
    workspace_id: str,
    data: ProductConfigUpdate,
    context: dict = Depends(admin_context_dependency("editor")),
    db: Session = Depends(get_session),
):
    _product_or_404(db, context["organization"].id, workspace_id)
    config = ensure_product_config(db, workspace_id)
    for field, value in data.model_dump().items():
        setattr(config, field, value)
    config.updated_at = utc_now()
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.get("/products/{workspace_id}/session-settings")
def get_product_session_settings(
    workspace_id: str,
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    _product_or_404(db, context["organization"].id, workspace_id)
    return ensure_session_settings(db, workspace_id)


@router.put("/products/{workspace_id}/session-settings")
def update_product_session_settings(
    workspace_id: str,
    data: ProductSessionSettingsUpdate,
    context: dict = Depends(admin_context_dependency("editor")),
    db: Session = Depends(get_session),
):
    _product_or_404(db, context["organization"].id, workspace_id)
    settings_row = ensure_session_settings(db, workspace_id)
    for field, value in data.model_dump().items():
        setattr(settings_row, field, value)
    settings_row.updated_at = utc_now()
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return settings_row


@router.get("/products/{workspace_id}/share")
def get_product_share(
    workspace_id: str,
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    workspace = _product_or_404(db, context["organization"].id, workspace_id)
    share = ensure_share_settings(db, workspace)
    return share_payload(workspace, share)


@router.put("/products/{workspace_id}/share")
def update_product_share(
    workspace_id: str,
    data: ProductShareSettingsUpdate,
    context: dict = Depends(admin_context_dependency("editor")),
    db: Session = Depends(get_session),
):
    workspace = _product_or_404(db, context["organization"].id, workspace_id)
    share = ensure_share_settings(db, workspace)
    share.share_title = data.share_title
    share.share_description = data.share_description
    share.updated_at = utc_now()
    db.add(share)
    db.commit()
    db.refresh(share)
    return share_payload(workspace, share)


@router.post("/products/{workspace_id}/test-agent")
async def test_agent(
    workspace_id: str,
    data: TestAgentRequest,
    context: dict = Depends(admin_context_dependency("editor")),
    db: Session = Depends(get_session),
):
    workspace = _product_or_404(db, context["organization"].id, workspace_id)
    session = DemoSession(workspace_id=workspace.id, public_token=workspace.public_token, mode="text")
    plan = await plan_response(db, session, data.message)
    citations = resolve_citations(db, plan.citations)
    if not citations:
        citations = fallback_citations_for_query(db, workspace.id, data.message)
    return {
        "decision": plan.decision,
        "response_text": plan.response_text,
        "recipe_id": plan.recipe_id,
        "citations": citations,
    }


@router.get("/sessions")
def list_sessions(
    workspace_id: Optional[str] = None,
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    products = db.exec(_org_workspace_query(context["organization"].id)).all()
    workspace_ids = [product.id for product in products]
    query = select(DemoSession).where(DemoSession.workspace_id.in_(workspace_ids))
    if workspace_id:
        query = query.where(DemoSession.workspace_id == workspace_id)
    sessions = db.exec(query.order_by(DemoSession.started_at.desc())).all()
    product_lookup = {product.id: product for product in products}

    payload = []
    for session in sessions:
        summary = _summary_for_session(db, session)
        recording = db.exec(select(SessionRecording).where(SessionRecording.session_id == session.id)).first()
        payload.append(
            {
                "id": session.id,
                "workspace_id": session.workspace_id,
                "product_name": product_lookup.get(session.workspace_id).name if product_lookup.get(session.workspace_id) else None,
                "buyer_name": session.buyer_name,
                "buyer_email": session.buyer_email,
                "status": session.status,
                "mode": session.mode,
                "live_status": session.live_status,
                "started_at": session.started_at,
                "ended_at": session.ended_at,
                "lead_intent_score": summary.lead_intent_score if summary else 0,
                "summary_text": summary.summary_text if summary else None,
                "transcript_available": True,
                "recording_available": bool(recording and recording.video_path),
            }
        )
    return payload


@router.get("/sessions/{session_id}")
def get_session_detail(
    session_id: str,
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    session = db.get(DemoSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _product_or_404(db, context["organization"].id, session.workspace_id)

    summary = _summary_for_session(db, session)
    messages = db.exec(
        select(SessionMessage).where(SessionMessage.session_id == session_id).order_by(SessionMessage.created_at)
    ).all()
    actions = db.exec(
        select(BrowserAction).where(BrowserAction.session_id == session_id).order_by(BrowserAction.created_at)
    ).all()
    recording = db.exec(select(SessionRecording).where(SessionRecording.session_id == session_id)).first()
    return {
        "session": session,
        "summary": summary,
        "messages": messages,
        "actions": actions,
        "recording": recording,
        "citations_used": session_citations(db, session_id),
    }


@router.get("/sessions/{session_id}/recording")
def get_session_recording(
    session_id: str,
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    session = db.get(DemoSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _product_or_404(db, context["organization"].id, session.workspace_id)
    recording = db.exec(select(SessionRecording).where(SessionRecording.session_id == session_id)).first()
    if recording is None or not recording.video_path:
        raise HTTPException(status_code=404, detail="Recording not found")
    if not Path(recording.video_path).exists():
        raise HTTPException(status_code=404, detail="Recording file is unavailable")
    return FileResponse(recording.video_path, media_type="video/webm")


@router.get("/embed-share")
def list_embed_share(
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    products = db.exec(_org_workspace_query(context["organization"].id)).all()
    return [
        {
            "product_id": product.id,
            "product_name": product.name,
            **share_payload(product, ensure_share_settings(db, product)),
        }
        for product in products
    ]


@router.get("/branding")
def get_branding(
    context: dict = Depends(admin_context_dependency("viewer")),
    db: Session = Depends(get_session),
):
    branding = db.exec(
        select(BrandingSettings).where(BrandingSettings.organization_id == context["organization"].id)
    ).first()
    if branding is None:
        raise HTTPException(status_code=404, detail="Branding not found")
    return branding


@router.put("/branding")
def update_branding(
    data: BrandingUpdate,
    context: dict = Depends(admin_context_dependency("admin")),
    db: Session = Depends(get_session),
):
    branding = db.exec(
        select(BrandingSettings).where(BrandingSettings.organization_id == context["organization"].id)
    ).first()
    if branding is None:
        branding = BrandingSettings(organization_id=context["organization"].id)
    for field, value in data.model_dump().items():
        setattr(branding, field, value)
    branding.updated_at = utc_now()
    db.add(branding)
    db.commit()
    db.refresh(branding)
    return branding


@router.get("/settings/account")
def get_account_settings(
    context: dict = Depends(admin_context_dependency("viewer")),
):
    return {
        "user": {
            "email": context["user"].email,
            "full_name": context["user"].full_name,
        },
        "organization": {
            "id": context["organization"].id,
            "name": context["organization"].name,
            "slug": context["organization"].slug,
        },
        "role": context["membership"].role,
    }


@router.get("/settings/members")
def get_members(
    context: dict = Depends(admin_context_dependency("owner")),
    db: Session = Depends(get_session),
):
    memberships = db.exec(
        select(Membership).where(Membership.organization_id == context["organization"].id)
    ).all()
    users = {member.user_id: db.get(AdminUser, member.user_id) for member in memberships}
    invites = db.exec(select(Invite).where(Invite.organization_id == context["organization"].id)).all()
    return {
        "members": [
            {
                "id": member.id,
                "role": member.role,
                "email": users[member.user_id].email if users.get(member.user_id) else None,
                "full_name": users[member.user_id].full_name if users.get(member.user_id) else None,
            }
            for member in memberships
        ],
        "invites": invites,
    }


@router.post("/settings/invites")
def create_invite(
    data: InviteCreate,
    context: dict = Depends(admin_context_dependency("owner")),
    db: Session = Depends(get_session),
):
    invite = Invite(
        organization_id=context["organization"].id,
        email=data.email.lower(),
        role=data.role,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    frontend = settings.frontend_url.rstrip("/")
    return {
        "id": invite.id,
        "email": invite.email,
        "role": invite.role,
        "invite_link": f"{frontend}/admin/login?invite={invite.token}",
    }


@router.get("/settings/billing")
def get_billing(
    context: dict = Depends(admin_context_dependency("owner")),
    db: Session = Depends(get_session),
):
    billing = db.exec(
        select(BillingAccount).where(BillingAccount.organization_id == context["organization"].id)
    ).first()
    if billing is None:
        raise HTTPException(status_code=404, detail="Billing account not found")
    return {
        "id": billing.id,
        "plan": billing.plan,
        "status": billing.status,
        "billing_email": billing.billing_email,
        "seats": billing.seats,
        "stripe_customer_id": billing.stripe_customer_id,
        "stripe_subscription_id": billing.stripe_subscription_id,
        "plans": {
            "monthly": settings.stripe_price_monthly,
            "annual": settings.stripe_price_annual,
            "enterprise_contact_url": settings.stripe_enterprise_contact_url,
        },
    }


@router.put("/settings/billing")
def update_billing(
    data: BillingUpdate,
    context: dict = Depends(admin_context_dependency("owner")),
    db: Session = Depends(get_session),
):
    billing = db.exec(
        select(BillingAccount).where(BillingAccount.organization_id == context["organization"].id)
    ).first()
    if billing is None:
        billing = BillingAccount(organization_id=context["organization"].id)
    for field, value in data.model_dump().items():
        setattr(billing, field, value)
    billing.updated_at = utc_now()
    db.add(billing)
    db.commit()
    db.refresh(billing)
    return billing


@router.post("/settings/billing/webhook")
def stripe_webhook(
    payload: dict[str, Any],
    db: Session = Depends(get_session),
):
    event_type = payload.get("type")
    data = payload.get("data", {}).get("object", {})
    stripe_customer_id = data.get("customer")
    if not stripe_customer_id:
        return {"status": "ignored"}
    billing = db.exec(
        select(BillingAccount).where(BillingAccount.stripe_customer_id == stripe_customer_id)
    ).first()
    if billing is None:
        return {"status": "ignored"}
    if event_type in {"checkout.session.completed", "customer.subscription.updated"}:
        billing.status = data.get("status") or "active"
        billing.stripe_subscription_id = data.get("subscription") or billing.stripe_subscription_id
        billing.updated_at = utc_now()
        db.add(billing)
        db.commit()
    return {"status": "ok"}


@router.get("/settings/api-keys")
def get_api_keys(
    workspace_id: Optional[str] = None,
    context: dict = Depends(admin_context_dependency("owner")),
    db: Session = Depends(get_session),
):
    query = select(ApiCredentialSet).where(ApiCredentialSet.organization_id == context["organization"].id)
    if workspace_id:
        query = query.where(ApiCredentialSet.workspace_id == workspace_id)
    secrets = db.exec(query.order_by(ApiCredentialSet.updated_at.desc())).all()
    return [
        {
            "id": secret.id,
            "provider": secret.provider,
            "label": secret.label,
            "workspace_id": secret.workspace_id,
            "masked_key": mask_api_key(f"{secret.provider}-{secret.id[-6:]}"),
            "metadata": parse_json_object(secret.metadata_json),
            "updated_at": secret.updated_at,
        }
        for secret in secrets
    ]


@router.put("/settings/api-keys")
def put_api_key(
    data: ApiCredentialWrite,
    context: dict = Depends(admin_context_dependency("owner")),
    db: Session = Depends(get_session),
):
    record = db.exec(
        select(ApiCredentialSet).where(
            ApiCredentialSet.organization_id == context["organization"].id,
            ApiCredentialSet.provider == data.provider,
            ApiCredentialSet.workspace_id == data.workspace_id,
        )
    ).first()
    if record is None:
        record = ApiCredentialSet(
            organization_id=context["organization"].id,
            workspace_id=data.workspace_id,
            provider=data.provider,
            label=data.label,
            api_key_encrypted=encrypt(data.api_key),
        )
    else:
        record.label = data.label
        record.api_key_encrypted = encrypt(data.api_key)
        record.updated_at = utc_now()
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "provider": record.provider,
        "label": record.label,
        "workspace_id": record.workspace_id,
    }
