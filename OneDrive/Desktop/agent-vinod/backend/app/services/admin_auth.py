"""Helpers for admin bootstrap, password hashing, and request authentication."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets
from typing import Callable

from fastapi import Cookie, Depends, HTTPException
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session
from app.models.admin import (
    AdminUser,
    AuthSession,
    BillingAccount,
    BrandingSettings,
    Membership,
    Organization,
)
from app.models.workspace import Workspace

_ROLE_ORDER = {
    "viewer": 0,
    "editor": 1,
    "admin": 2,
    "owner": 3,
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_timestamp(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 480000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt_hex, digest_hex = password_hash.split("$", 1)
    except ValueError:
        return False
    expected = bytes.fromhex(digest_hex)
    actual = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        480000,
    )
    return hmac.compare_digest(actual, expected)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session_token() -> str:
    return secrets.token_urlsafe(32)


def ensure_admin_bootstrap(db: Session) -> tuple[Organization, AdminUser, Membership]:
    org = db.exec(select(Organization).order_by(Organization.created_at)).first()
    if org is None:
        org = Organization(
            name=settings.admin_bootstrap_org_name,
            slug=_slugify(settings.admin_bootstrap_org_name),
        )
        db.add(org)
        db.commit()
        db.refresh(org)

    user = db.exec(select(AdminUser).where(AdminUser.email == settings.admin_bootstrap_email.lower())).first()
    if user is None:
        user = AdminUser(
            email=settings.admin_bootstrap_email.lower(),
            full_name="Admin Owner",
            password_hash=hash_password(settings.admin_bootstrap_password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    membership = db.exec(
        select(Membership).where(
            Membership.organization_id == org.id,
            Membership.user_id == user.id,
        )
    ).first()
    if membership is None:
        membership = Membership(organization_id=org.id, user_id=user.id, role="owner")
        db.add(membership)
        db.commit()
        db.refresh(membership)

    branding = db.exec(select(BrandingSettings).where(BrandingSettings.organization_id == org.id)).first()
    if branding is None:
        branding = BrandingSettings(organization_id=org.id, company_name=org.name)
        db.add(branding)

    billing = db.exec(select(BillingAccount).where(BillingAccount.organization_id == org.id)).first()
    if billing is None:
        billing = BillingAccount(organization_id=org.id, plan="starter", status="trialing")
        db.add(billing)

    existing_workspaces = db.exec(
        select(Workspace).where(Workspace.organization_id.is_(None))
    ).all()
    for workspace in existing_workspaces:
        workspace.organization_id = org.id
        db.add(workspace)

    db.commit()
    return org, user, membership


def create_auth_session(db: Session, organization_id: str, user_id: str) -> tuple[str, AuthSession]:
    token = create_session_token()
    expires_at = utc_now() + timedelta(days=settings.admin_session_days)
    session = AuthSession(
        organization_id=organization_id,
        user_id=user_id,
        token_hash=hash_token(token),
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return token, session


def get_membership_for_user(db: Session, organization_id: str, user_id: str) -> Membership | None:
    return db.exec(
        select(Membership).where(
            Membership.organization_id == organization_id,
            Membership.user_id == user_id,
        )
    ).first()


def admin_context_dependency(min_role: str = "viewer") -> Callable:
    def dependency(
        admin_session: str | None = Cookie(default=None),
        db: Session = Depends(get_session),
    ) -> dict:
        ensure_admin_bootstrap(db)
        if not admin_session:
            raise HTTPException(status_code=401, detail="Authentication required")

        session = db.exec(
            select(AuthSession).where(AuthSession.token_hash == hash_token(admin_session))
        ).first()
        if session is None or _normalize_timestamp(session.expires_at) < utc_now():
            raise HTTPException(status_code=401, detail="Session expired")

        user = db.get(AdminUser, session.user_id)
        if user is None or not user.is_active:
            raise HTTPException(status_code=401, detail="User unavailable")

        membership = get_membership_for_user(db, session.organization_id, user.id)
        if membership is None:
            raise HTTPException(status_code=403, detail="Membership missing")
        if _ROLE_ORDER.get(membership.role, -1) < _ROLE_ORDER.get(min_role, 0):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        organization = db.get(Organization, session.organization_id)
        return {
            "session": session,
            "user": user,
            "membership": membership,
            "organization": organization,
        }

    return dependency


def _slugify(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in value)
    compact = "-".join(part for part in cleaned.split("-") if part)
    return compact or "demoagent"
