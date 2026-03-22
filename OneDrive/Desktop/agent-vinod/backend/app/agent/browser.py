"""Agent-side browser boundary."""

from app.browser.executor import (
    close_browser_session,
    execute_action,
    execute_recipe,
    execute_recipe_step,
    get_active_driver,
    get_browser_state,
    observe_action_candidates,
    start_browser_session,
    take_screenshot,
)

__all__ = [
    "close_browser_session",
    "execute_action",
    "execute_recipe",
    "execute_recipe_step",
    "get_active_driver",
    "get_browser_state",
    "observe_action_candidates",
    "start_browser_session",
    "take_screenshot",
]

