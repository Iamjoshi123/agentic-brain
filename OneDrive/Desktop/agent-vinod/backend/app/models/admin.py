"""Admin platform models for organizations, auth, product config, and knowledge."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
import uuid

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Organization(SQLModel, table=True):
    __tablename__ = "organizations"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AdminUser(SQLModel, table=True):
    __tablename__ = "admin_users"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    email: str = Field(unique=True, index=True)
    full_name: str
    password_hash: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Membership(SQLModel, table=True):
    __tablename__ = "memberships"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    organization_id: str = Field(foreign_key="organizations.id", index=True)
    user_id: str = Field(foreign_key="admin_users.id", index=True)
    role: str = Field(default="owner", index=True)
    created_at: datetime = Field(default_factory=utc_now)


class Invite(SQLModel, table=True):
    __tablename__ = "invites"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    organization_id: str = Field(foreign_key="organizations.id", index=True)
    email: str = Field(index=True)
    role: str = Field(default="viewer")
    token: str = Field(default_factory=lambda: uuid.uuid4().hex, unique=True, index=True)
    accepted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)


class AuthSession(SQLModel, table=True):
    __tablename__ = "auth_sessions"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    organization_id: str = Field(foreign_key="organizations.id", index=True)
    user_id: str = Field(foreign_key="admin_users.id", index=True)
    token_hash: str = Field(index=True, unique=True)
    expires_at: datetime
    created_at: datetime = Field(default_factory=utc_now)


class BillingAccount(SQLModel, table=True):
    __tablename__ = "billing_accounts"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    organization_id: str = Field(foreign_key="organizations.id", index=True, unique=True)
    plan: str = Field(default="starter")
    status: str = Field(default="trialing")
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    billing_email: Optional[str] = None
    seats: int = Field(default=1)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ApiCredentialSet(SQLModel, table=True):
    __tablename__ = "api_credential_sets"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    organization_id: str = Field(foreign_key="organizations.id", index=True)
    workspace_id: Optional[str] = Field(default=None, foreign_key="workspaces.id", index=True)
    provider: str = Field(index=True)
    label: str
    api_key_encrypted: str
    metadata_json: str = Field(default="{}")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class BrandingSettings(SQLModel, table=True):
    __tablename__ = "branding_settings"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    organization_id: str = Field(foreign_key="organizations.id", index=True, unique=True)
    company_name: str = Field(default="DemoAgent")
    logo_url: Optional[str] = None
    primary_color: str = Field(default="#e8a84c")
    accent_color: str = Field(default="#111214")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ProductConfig(SQLModel, table=True):
    __tablename__ = "product_configs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True, unique=True)
    agent_name: str = Field(default="Avery")
    greeting_template: str = Field(
        default="Welcome to the demo. I'll walk you through the product and answer questions as we go."
    )
    warmth: int = Field(default=65)
    enthusiasm: int = Field(default=70)
    formality: int = Field(default=40)
    response_length: str = Field(default="balanced")
    confidence_threshold: int = Field(default=60)
    citation_mode: str = Field(default="admin_only")
    navigation_style: str = Field(default="show_while_telling")
    model_provider: str = Field(default="auto")
    avoid_topics_json: str = Field(default="[]")
    escalation_message: str = Field(default="Let me route that to a human teammate.")
    escalation_destination: str = Field(default="sales@demoagent.local")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ProductSessionSettings(SQLModel, table=True):
    __tablename__ = "product_session_settings"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True, unique=True)
    time_limit_minutes: int = Field(default=30)
    welcome_flow: str = Field(default="guided")
    suggested_questions_json: str = Field(default="[]")
    post_session_message: str = Field(default="Thanks for taking the demo. We'll follow up with the next steps.")
    recording_enabled: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ProductShareSettings(SQLModel, table=True):
    __tablename__ = "product_share_settings"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True, unique=True)
    share_title: str = Field(default="Interactive product demo")
    share_description: str = Field(default="Open the demo and ask questions while the agent walks you through the product.")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class KnowledgeSource(SQLModel, table=True):
    __tablename__ = "knowledge_sources"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    source_type: str = Field(index=True)
    title: str
    source_url: Optional[str] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    content_text: Optional[str] = None
    transcript_text: Optional[str] = None
    status: str = Field(default="pending", index=True)
    sync_status: str = Field(default="queued", index=True)
    metadata_json: str = Field(default="{}")
    document_id: Optional[str] = Field(default=None, foreign_key="documents.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class KnowledgeJob(SQLModel, table=True):
    __tablename__ = "knowledge_jobs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    source_id: str = Field(foreign_key="knowledge_sources.id", index=True)
    job_type: str = Field(default="ingest")
    status: str = Field(default="queued", index=True)
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class SessionRecording(SQLModel, table=True):
    __tablename__ = "session_recordings"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    session_id: str = Field(foreign_key="sessions.id", index=True, unique=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    video_path: Optional[str] = None
    audio_path: Optional[str] = None
    status: str = Field(default="pending")
    duration_seconds: Optional[int] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class LoginRequest(SQLModel):
    email: str
    password: str


class ProductOverviewUpdate(SQLModel):
    name: str
    description: Optional[str] = None
    product_url: Optional[str] = None
    allowed_domains: Optional[str] = None
    browser_auth_mode: str = "credentials"
    is_active: bool = True


class ProductConfigUpdate(SQLModel):
    agent_name: str
    greeting_template: str
    warmth: int
    enthusiasm: int
    formality: int
    response_length: str
    confidence_threshold: int
    citation_mode: str
    navigation_style: str
    model_provider: str
    avoid_topics_json: str
    escalation_message: str
    escalation_destination: str


class ProductSessionSettingsUpdate(SQLModel):
    time_limit_minutes: int
    welcome_flow: str
    suggested_questions_json: str
    post_session_message: str
    recording_enabled: bool


class ProductShareSettingsUpdate(SQLModel):
    share_title: str
    share_description: str


class BrandingUpdate(SQLModel):
    company_name: str
    logo_url: Optional[str] = None
    primary_color: str
    accent_color: str


class BillingUpdate(SQLModel):
    plan: str
    status: str
    billing_email: Optional[str] = None
    seats: int = 1


class InviteCreate(SQLModel):
    email: str
    role: str


class ApiCredentialWrite(SQLModel):
    provider: str
    label: str
    api_key: str
    workspace_id: Optional[str] = None


class KnowledgeSourceCreate(SQLModel):
    title: str
    source_url: Optional[str] = None
    content_text: Optional[str] = None
    transcript_text: Optional[str] = None
    metadata_json: str = "{}"


class TestAgentRequest(SQLModel):
    message: str
