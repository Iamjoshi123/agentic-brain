"""Admin authentication routes."""

from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session
from app.models.admin import AdminUser, AuthSession, LoginRequest, Membership
from app.services.admin_auth import hash_token
from app.services.admin_auth import (
    admin_context_dependency,
    create_auth_session,
    ensure_admin_bootstrap,
    verify_password,
)

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


@router.post("/login")
def login(data: LoginRequest, response: Response, db: Session = Depends(get_session)):
    ensure_admin_bootstrap(db)
    user = db.exec(select(AdminUser).where(AdminUser.email == data.email.lower())).first()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    memberships = db.exec(select(Membership).where(Membership.user_id == user.id)).all()
    membership = memberships[0] if memberships else None
    if membership is None:
        raise HTTPException(status_code=403, detail="No organization membership")

    token, auth_session = create_auth_session(db, membership.organization_id, user.id)
    response.set_cookie(
        key="admin_session",
        value=token,
        httponly=True,
        samesite="lax",
        secure=not settings.is_dev,
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
        },
        "organization_id": membership.organization_id,
        "role": membership.role,
        "session_id": auth_session.id,
    }


@router.post("/logout")
def logout(
    response: Response,
    admin_session: str | None = Cookie(default=None),
    db: Session = Depends(get_session),
):
    if admin_session:
        session = db.exec(select(AuthSession).where(AuthSession.token_hash == hash_token(admin_session))).first()
        if session is not None:
            db.delete(session)
            db.commit()
    response.delete_cookie("admin_session", path="/", samesite="lax", secure=not settings.is_dev)
    return {"status": "ok"}


@router.get("/me")
def me(context: dict = Depends(admin_context_dependency("viewer"))):
    return {
        "user": {
            "id": context["user"].id,
            "email": context["user"].email,
            "full_name": context["user"].full_name,
        },
        "organization": {
            "id": context["organization"].id if context["organization"] else None,
            "name": context["organization"].name if context["organization"] else None,
            "slug": context["organization"].slug if context["organization"] else None,
        },
        "role": context["membership"].role,
    }
