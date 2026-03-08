"""Demo session API routes - the core buyer-facing endpoints."""

import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database import get_session
from app.models.workspace import Workspace
from app.models.session import (
    DemoSession, SessionMessage, SessionCreate, SessionRead,
    MessageCreate, MessageRead, SessionSummaryRead, BrowserAction,
)
from app.models.recipe import DemoRecipe
from app.services.planner import plan_response
from app.browser.executor import (
    start_browser_session, execute_recipe, execute_action,
    close_browser_session, take_screenshot, get_browser_state,
)
from app.analytics.summary import generate_session_summary
from app.voice.session import VoiceSession

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionRead)
def create_session(data: SessionCreate, db: Session = Depends(get_session)):
    """Create a new demo session from a public token."""
    ws = db.exec(
        select(Workspace).where(
            Workspace.public_token == data.public_token,
            Workspace.is_active == True,
        )
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Invalid demo link")

    session = DemoSession(
        workspace_id=ws.id,
        public_token=data.public_token,
        buyer_name=data.buyer_name,
        buyer_email=data.buyer_email,
        mode=data.mode,
    )
    db.add(session)

    # Add welcome message
    welcome = SessionMessage(
        session_id=session.id,
        role="agent",
        content=f"Welcome to the {ws.name} demo! I'm your AI assistant. You can ask me about the product, and I can show you features live. What would you like to explore?",
        message_type="text",
    )
    db.add(welcome)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=SessionRead)
def get_session_info(session_id: str, db: Session = Depends(get_session)):
    session = db.get(DemoSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/{session_id}/messages", response_model=list[MessageRead])
def get_messages(session_id: str, db: Session = Depends(get_session)):
    return db.exec(
        select(SessionMessage)
        .where(SessionMessage.session_id == session_id)
        .order_by(SessionMessage.created_at)
    ).all()


@router.post("/{session_id}/message", response_model=MessageRead)
async def send_message(
    session_id: str,
    data: MessageCreate,
    db: Session = Depends(get_session),
):
    """Process a buyer message: store it, plan a response, and return the agent reply."""
    session = db.get(DemoSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    # Store user message
    user_msg = SessionMessage(
        session_id=session_id,
        role="user",
        content=data.content,
        message_type=data.message_type,
    )
    db.add(user_msg)
    db.commit()

    # Plan and generate response
    plan = await plan_response(db, session, data.content)

    # Store agent response
    agent_msg = SessionMessage(
        session_id=session_id,
        role="agent",
        content=plan.response_text,
        message_type="text",
        planner_decision=plan.decision,
        metadata_json=json.dumps({
            "recipe_id": plan.recipe_id,
            "citations": plan.citations,
            "policy_decision": plan.policy_decision.decision if plan.policy_decision else None,
        }),
    )
    db.add(agent_msg)
    db.commit()
    db.refresh(agent_msg)

    # If answer_and_demo and we have a recipe, auto-trigger browser
    if plan.decision == "answer_and_demo" and plan.recipe_id and session.browser_session_id:
        recipe = db.get(DemoRecipe, plan.recipe_id)
        if recipe:
            try:
                await execute_recipe(db, session_id, recipe)
            except Exception as e:
                # Log but don't fail the message
                error_msg = SessionMessage(
                    session_id=session_id,
                    role="system",
                    content=f"Browser action failed: {e}",
                    message_type="text",
                )
                db.add(error_msg)
                db.commit()

    return agent_msg


@router.post("/{session_id}/start-browser")
async def start_browser(session_id: str, db: Session = Depends(get_session)):
    """Start a browser automation session with credential locking."""
    session = db.get(DemoSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    cred_id = await start_browser_session(db, session)
    if not cred_id:
        raise HTTPException(status_code=503, detail="No sandbox credentials available. All accounts may be in use.")

    return {"status": "browser_started", "credential_id": cred_id}


@router.post("/{session_id}/execute-recipe")
async def run_recipe(
    session_id: str,
    recipe_id: str,
    db: Session = Depends(get_session),
):
    """Execute a specific demo recipe in the browser."""
    session = db.get(DemoSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    recipe = db.get(DemoRecipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    results = await execute_recipe(db, session_id, recipe)
    return {
        "status": "completed",
        "steps_executed": len(results),
        "steps_succeeded": sum(1 for r in results if r.success),
        "results": [
            {
                "action": r.action_type,
                "success": r.success,
                "narration": r.narration,
                "error": r.error,
                "screenshot": r.screenshot_b64 is not None,
            }
            for r in results
        ],
    }


@router.post("/{session_id}/explore")
async def explore_action(
    session_id: str,
    action: str,
    target: str = None,
    value: str = None,
    db: Session = Depends(get_session),
):
    """Execute a single exploratory browser action."""
    session = db.get(DemoSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await execute_action(db, session_id, action, target, value)
    return {
        "success": result.success,
        "action": result.action_type,
        "narration": result.narration,
        "error": result.error,
        "screenshot": result.screenshot_b64,
        "page_url": result.page_url,
    }


@router.get("/{session_id}/screenshot")
async def get_screenshot(session_id: str):
    """Get current browser screenshot."""
    screenshot = await take_screenshot(session_id)
    if not screenshot:
        raise HTTPException(status_code=404, detail="No active browser or screenshot failed")
    return {"screenshot": screenshot}


@router.get("/{session_id}/browser-state")
async def get_browser_state_endpoint(session_id: str):
    """Get current browser page state."""
    state = await get_browser_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="No active browser session")
    return state


@router.post("/{session_id}/voice/start")
async def start_voice(session_id: str, db: Session = Depends(get_session)):
    """Start a voice session for this demo."""
    session = db.get(DemoSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    voice = VoiceSession(session_id, session.workspace_id)
    result = await voice.start()

    if result.get("mode") == "voice":
        session.mode = "voice"
        db.add(session)
        db.commit()

    return result


@router.post("/{session_id}/end")
async def end_session(session_id: str, db: Session = Depends(get_session)):
    """End a demo session, close browser, generate summary."""
    session = db.get(DemoSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Close browser if active
    await close_browser_session(db, session_id)

    # Update session status
    session.status = "ended"
    session.ended_at = datetime.now(timezone.utc)
    db.add(session)
    db.commit()

    # Generate summary
    summary = generate_session_summary(db, session_id)

    return {
        "status": "ended",
        "summary": {
            "lead_intent_score": summary.lead_intent_score,
            "summary_text": summary.summary_text,
            "total_messages": summary.total_messages,
        },
    }


@router.get("/{session_id}/summary", response_model=SessionSummaryRead)
def get_session_summary(session_id: str, db: Session = Depends(get_session)):
    """Get the analytics summary for a session."""
    from app.models.session import SessionSummary
    summary = db.exec(
        select(SessionSummary).where(SessionSummary.session_id == session_id)
    ).first()
    if not summary:
        # Generate on demand
        summary = generate_session_summary(db, session_id)
    return summary


@router.get("/{session_id}/actions")
def get_browser_actions(session_id: str, db: Session = Depends(get_session)):
    """Get all browser actions for audit trail."""
    actions = db.exec(
        select(BrowserAction)
        .where(BrowserAction.session_id == session_id)
        .order_by(BrowserAction.created_at)
    ).all()
    return actions
