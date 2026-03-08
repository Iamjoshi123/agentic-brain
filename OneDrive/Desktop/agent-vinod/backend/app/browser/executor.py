"""Browser execution engine - runs recipes and exploratory actions."""

import json
import logging
from typing import Optional
from sqlmodel import Session, select
from app.browser.driver import PlaywrightDriver, BrowserDriver, ActionResult
from app.models.session import BrowserAction, DemoSession
from app.models.credential import SandboxCredential, SandboxLock
from app.models.recipe import DemoRecipe
from app.services.encryption import decrypt
from app.config import settings

logger = logging.getLogger(__name__)

# In-memory registry of active browser sessions
_active_sessions: dict[str, BrowserDriver] = {}


async def start_browser_session(
    db: Session,
    session: DemoSession,
) -> Optional[str]:
    """Start an isolated browser context and acquire a credential lock.

    Returns the credential_id if successful, None on failure.
    """
    # Find an available credential
    credential = _acquire_credential(db, session)
    if not credential:
        logger.warning(f"No available credentials for workspace {session.workspace_id}")
        return None

    # Start browser
    driver = PlaywrightDriver()
    try:
        await driver.start(headless=settings.playwright_headless)
    except Exception as e:
        logger.error(f"Failed to start browser: {e}")
        _release_credential(db, session.id)
        return None

    _active_sessions[session.id] = driver

    # Login
    login_result = await _login(driver, credential)
    if not login_result.success:
        logger.error(f"Login failed: {login_result.error}")
        # Still keep browser open - admin might want to debug
        _log_action(db, session.id, login_result)

    _log_action(db, session.id, login_result)
    session.credential_id = credential.id
    session.browser_session_id = session.id
    db.add(session)
    db.commit()

    return credential.id


async def execute_recipe(
    db: Session,
    session_id: str,
    recipe: DemoRecipe,
) -> list[ActionResult]:
    """Execute a demo recipe step by step."""
    driver = _active_sessions.get(session_id)
    if not driver:
        logger.error(f"No active browser for session {session_id}")
        return []

    try:
        steps = json.loads(recipe.steps_json)
    except json.JSONDecodeError:
        logger.error(f"Invalid recipe steps JSON for recipe {recipe.id}")
        return []

    results = []
    for step in steps:
        action = step.get("action", "")
        target = step.get("target", "")
        value = step.get("value", "")
        wait_ms = step.get("wait_ms", 1000)

        result = await _execute_step(driver, action, target, value)
        result.narration = step.get("description", result.narration)
        _log_action(db, session_id, result)
        results.append(result)

        if not result.success:
            logger.warning(f"Recipe step failed: {action} {target} - {result.error}")
            # Continue with remaining steps rather than aborting

        if wait_ms > 0:
            await driver.wait(wait_ms)

    return results


async def execute_action(
    db: Session,
    session_id: str,
    action: str,
    target: Optional[str] = None,
    value: Optional[str] = None,
) -> ActionResult:
    """Execute a single browser action."""
    driver = _active_sessions.get(session_id)
    if not driver:
        return ActionResult(success=False, action_type=action, error="No active browser session")

    result = await _execute_step(driver, action, target, value)
    _log_action(db, session_id, result)
    return result


async def get_browser_state(session_id: str) -> Optional[dict]:
    """Get current browser page state for a session."""
    driver = _active_sessions.get(session_id)
    if not driver:
        return None
    return await driver.get_page_state()


async def take_screenshot(session_id: str) -> Optional[str]:
    """Take a screenshot and return base64."""
    driver = _active_sessions.get(session_id)
    if not driver:
        return None
    result = await driver.screenshot()
    return result.screenshot_b64 if result.success else None


async def close_browser_session(db: Session, session_id: str) -> None:
    """Close browser and release credential lock."""
    driver = _active_sessions.pop(session_id, None)
    if driver:
        await driver.close()
    _release_credential(db, session_id)
    logger.info(f"Browser session closed for {session_id}")


def _acquire_credential(db: Session, session: DemoSession) -> Optional[SandboxCredential]:
    """Find and lock an available credential for this workspace."""
    # Get all active credentials
    credentials = db.exec(
        select(SandboxCredential).where(
            SandboxCredential.workspace_id == session.workspace_id,
            SandboxCredential.is_active == True,
        )
    ).all()

    for cred in credentials:
        # Check if already locked
        active_lock = db.exec(
            select(SandboxLock).where(
                SandboxLock.credential_id == cred.id,
                SandboxLock.is_active == True,
            )
        ).first()

        if active_lock is None:
            # Acquire lock
            lock = SandboxLock(
                credential_id=cred.id,
                session_id=session.id,
                is_active=True,
            )
            db.add(lock)
            db.commit()
            logger.info(f"Acquired credential lock: {cred.label}")
            return cred

    return None


def _release_credential(db: Session, session_id: str) -> None:
    """Release credential lock for a session."""
    from datetime import datetime, timezone
    locks = db.exec(
        select(SandboxLock).where(
            SandboxLock.session_id == session_id,
            SandboxLock.is_active == True,
        )
    ).all()
    for lock in locks:
        lock.is_active = False
        lock.released_at = datetime.now(timezone.utc)
        db.add(lock)
    db.commit()


async def _login(driver: BrowserDriver, credential: SandboxCredential) -> ActionResult:
    """Perform login using decrypted credentials."""
    try:
        username = decrypt(credential.username_encrypted)
        password = decrypt(credential.password_encrypted)
    except ValueError as e:
        return ActionResult(success=False, action_type="login", error=str(e))

    # Navigate to login URL
    nav_result = await driver.navigate(credential.login_url)
    if not nav_result.success:
        return nav_result

    # Try common login selectors
    username_selectors = [
        'input[name="username"]', 'input[name="email"]', 'input[type="email"]',
        '#username', '#email', 'input[name="login"]', 'input[placeholder*="email" i]',
        'input[placeholder*="username" i]',
    ]
    password_selectors = [
        'input[name="password"]', 'input[type="password"]', '#password',
    ]
    submit_selectors = [
        'button[type="submit"]', 'input[type="submit"]', 'button:has-text("Log in")',
        'button:has-text("Sign in")', 'button:has-text("Login")',
    ]

    # Type username
    for sel in username_selectors:
        result = await driver.type_text(sel, username)
        if result.success:
            break
    else:
        return ActionResult(success=False, action_type="login", error="Could not find username field")

    # Type password
    for sel in password_selectors:
        result = await driver.type_text(sel, password)
        if result.success:
            break
    else:
        return ActionResult(success=False, action_type="login", error="Could not find password field")

    # Click submit
    for sel in submit_selectors:
        result = await driver.click(sel)
        if result.success:
            break
    else:
        return ActionResult(success=False, action_type="login", error="Could not find submit button")

    await driver.wait(2000)
    screenshot = await driver.screenshot()

    return ActionResult(
        success=True,
        action_type="login",
        narration="Successfully logged in",
        screenshot_b64=screenshot.screenshot_b64 if screenshot.success else None,
        page_url=screenshot.page_url,
        page_title=screenshot.page_title,
    )


async def _execute_step(
    driver: BrowserDriver,
    action: str,
    target: Optional[str] = None,
    value: Optional[str] = None,
) -> ActionResult:
    """Execute a single browser action step."""
    if action == "navigate" and target:
        return await driver.navigate(target)
    elif action == "click" and target:
        return await driver.click(target)
    elif action == "type" and target and value:
        return await driver.type_text(target, value)
    elif action == "screenshot":
        return await driver.screenshot()
    elif action == "wait":
        return await driver.wait(int(value or 1000))
    elif action == "scroll":
        return await driver.scroll(value or "down")
    elif action == "narrate":
        return ActionResult(
            success=True,
            action_type="narrate",
            narration=value or "",
        )
    else:
        return ActionResult(
            success=False,
            action_type=action,
            error=f"Unknown action: {action}",
        )


def _log_action(db: Session, session_id: str, result: ActionResult) -> None:
    """Persist a browser action to the audit trail."""
    action = BrowserAction(
        session_id=session_id,
        action_type=result.action_type,
        target=result.target,
        value=result.value,
        status="success" if result.success else "error",
        screenshot_path=result.screenshot_path,
        error_message=result.error,
        narration=result.narration,
        duration_ms=result.duration_ms,
    )
    db.add(action)
    db.commit()
