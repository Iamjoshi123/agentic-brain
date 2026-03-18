from __future__ import annotations

import json

from app.models.admin import AdminUser, Membership, SessionRecording
from app.models.document import Document
from app.models.session import DemoSession, SessionMessage, SessionSummary
from app.services.admin_auth import ensure_admin_bootstrap, hash_password
from app.services.llm import settings as llm_settings


def _login_owner(client):
    response = client.post(
        "/api/admin/auth/login",
        json={"email": "admin@demoagent.local", "password": "demo1234"},
    )
    assert response.status_code == 200


def test_admin_login_and_dashboard(client, session, workspace):
    ensure_admin_bootstrap(session)
    _login_owner(client)

    response = client.get("/api/admin/dashboard")
    assert response.status_code == 200
    payload = response.json()
    assert payload["stats"]["products"] >= 1
    assert "reports" in payload


def test_admin_product_and_config_flow(client, session):
    ensure_admin_bootstrap(session)
    _login_owner(client)

    created = client.post(
        "/api/admin/products",
        json={
            "name": "Saleshandy",
            "description": "Outbound sales",
            "product_url": "https://app.saleshandy.com",
            "allowed_domains": "app.saleshandy.com",
            "browser_auth_mode": "credentials",
            "is_active": True,
        },
    )
    assert created.status_code == 200
    product_id = created.json()["id"]

    config = client.put(
        f"/api/admin/products/{product_id}/config",
        json={
            "agent_name": "Nova",
            "greeting_template": "Welcome to the demo",
            "warmth": 75,
            "enthusiasm": 80,
            "formality": 30,
            "response_length": "balanced",
            "confidence_threshold": 60,
            "citation_mode": "buyers",
            "navigation_style": "show_while_telling",
            "model_provider": "openai",
            "avoid_topics_json": json.dumps(["pricing"]),
            "escalation_message": "I will escalate this.",
            "escalation_destination": "sales@example.com",
        },
    )
    assert config.status_code == 200
    assert config.json()["agent_name"] == "Nova"

    session_settings = client.put(
        f"/api/admin/products/{product_id}/session-settings",
        json={
            "time_limit_minutes": 25,
            "welcome_flow": "guided",
            "suggested_questions_json": json.dumps(["Show me reporting"]),
            "post_session_message": "Thanks for your time",
            "recording_enabled": True,
        },
    )
    assert session_settings.status_code == 200
    assert session_settings.json()["recording_enabled"] is True


def test_admin_knowledge_and_test_agent_returns_citations(client, session, workspace, monkeypatch):
    ensure_admin_bootstrap(session)
    _login_owner(client)
    monkeypatch.setattr(llm_settings, "app_env", "test")

    response = client.post(
        f"/api/admin/products/{workspace.id}/knowledge/help-docs",
        json={
            "title": "Reporting Guide",
            "source_url": "https://docs.example.com/reporting",
            "content_text": "Reporting dashboards support filters, exports, and weekly summaries.",
            "metadata_json": "{}",
        },
    )
    assert response.status_code == 200

    dry_run = client.post(
        f"/api/admin/products/{workspace.id}/test-agent",
        json={"message": "How does reporting work?"},
    )
    assert dry_run.status_code == 200
    payload = dry_run.json()
    assert payload["citations"]
    assert payload["citations"][0]["title"] == "Reporting Guide"


def test_admin_sessions_detail_includes_recording_and_citations(client, session, workspace):
    ensure_admin_bootstrap(session)
    _login_owner(client)

    demo = DemoSession(
        workspace_id=workspace.id,
        public_token=workspace.public_token,
        buyer_name="Taylor Buyer",
        mode="live",
        status="ended",
    )
    session.add(demo)
    session.commit()
    session.refresh(demo)

    document = Document(
        workspace_id=workspace.id,
        filename="guide.md",
        file_type="md",
        content_text="Reporting docs",
        metadata_json=json.dumps({"title": "Guide", "source_type": "help_doc_url"}),
        status="ready",
    )
    session.add(document)
    session.commit()
    session.refresh(document)

    session.add(
        SessionMessage(
            session_id=demo.id,
            role="agent",
            content="Here is reporting",
            metadata_json=json.dumps({"citations": [document.id]}),
        )
    )
    session.add(
        SessionSummary(
            session_id=demo.id,
            summary_text="Strong intent",
            lead_intent_score=81,
            total_messages=2,
            total_actions=1,
        )
    )
    session.add(
        SessionRecording(
            session_id=demo.id,
            workspace_id=workspace.id,
            video_path="tmp/admin_uploads/recordings/ws-1/demo.webm",
            status="ready",
        )
    )
    session.commit()

    detail = client.get(f"/api/admin/sessions/{demo.id}")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["recording"]["video_path"].endswith(".webm")
    assert payload["citations_used"][0]["title"] == "Guide"


def test_viewer_cannot_create_product(client, session):
    org, _, _ = ensure_admin_bootstrap(session)
    viewer = AdminUser(
        email="viewer@example.com",
        full_name="Viewer User",
        password_hash=hash_password("viewer-pass"),
    )
    session.add(viewer)
    session.commit()
    session.refresh(viewer)
    session.add(Membership(organization_id=org.id, user_id=viewer.id, role="viewer"))
    session.commit()

    logged_in = client.post(
        "/api/admin/auth/login",
        json={"email": "viewer@example.com", "password": "viewer-pass"},
    )
    assert logged_in.status_code == 200

    response = client.post(
        "/api/admin/products",
        json={
          "name": "Blocked Product",
          "description": "",
          "product_url": "",
          "allowed_domains": "",
          "browser_auth_mode": "credentials",
          "is_active": True,
        },
    )
    assert response.status_code == 403
