"""Browser driver abstraction with Playwright implementation.

Provides BrowserDriver interface and PlaywrightDriver concrete implementation.
Optional BrowserUseDriver can be enabled via env var.
"""

import asyncio
import base64
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class ActionResult:
    success: bool
    action_type: str
    target: Optional[str] = None
    value: Optional[str] = None
    screenshot_b64: Optional[str] = None
    screenshot_path: Optional[str] = None
    error: Optional[str] = None
    duration_ms: int = 0
    narration: Optional[str] = None
    page_url: Optional[str] = None
    page_title: Optional[str] = None


class BrowserDriver(ABC):
    """Abstract browser driver interface."""

    @abstractmethod
    async def start(self, headless: bool = True) -> None:
        """Initialize browser and create a new context."""
        pass

    @abstractmethod
    async def navigate(self, url: str) -> ActionResult:
        """Navigate to a URL."""
        pass

    @abstractmethod
    async def click(self, selector: str) -> ActionResult:
        """Click an element by CSS selector."""
        pass

    @abstractmethod
    async def type_text(self, selector: str, text: str) -> ActionResult:
        """Type text into an input field."""
        pass

    @abstractmethod
    async def screenshot(self) -> ActionResult:
        """Capture a screenshot of the current page."""
        pass

    @abstractmethod
    async def get_page_state(self) -> dict:
        """Get current page URL, title, and visible text summary."""
        pass

    @abstractmethod
    async def wait(self, ms: int = 1000) -> ActionResult:
        """Wait for a specified time."""
        pass

    @abstractmethod
    async def scroll(self, direction: str = "down") -> ActionResult:
        """Scroll the page."""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Close browser and clean up."""
        pass


class PlaywrightDriver(BrowserDriver):
    """Primary browser driver using Playwright."""

    def __init__(self):
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
        self._screenshot_dir = Path("data/screenshots")

    async def start(self, headless: bool = True) -> None:
        from playwright.async_api import async_playwright

        self._screenshot_dir.mkdir(parents=True, exist_ok=True)
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=headless)
        self._context = await self._browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="AgenticDemoBrain/1.0",
        )
        self._page = await self._context.new_page()
        logger.info("Playwright browser started")

    async def navigate(self, url: str) -> ActionResult:
        start = time.time()
        try:
            await self._page.goto(url, wait_until="domcontentloaded", timeout=15000)
            duration = int((time.time() - start) * 1000)
            screenshot = await self._take_screenshot()
            return ActionResult(
                success=True,
                action_type="navigate",
                target=url,
                duration_ms=duration,
                screenshot_b64=screenshot,
                page_url=self._page.url,
                page_title=await self._page.title(),
                narration=f"Navigated to {await self._page.title() or url}",
            )
        except Exception as e:
            return ActionResult(
                success=False,
                action_type="navigate",
                target=url,
                error=str(e),
                duration_ms=int((time.time() - start) * 1000),
            )

    async def click(self, selector: str) -> ActionResult:
        start = time.time()
        try:
            await self._page.wait_for_selector(selector, timeout=5000)
            await self._page.click(selector)
            await self._page.wait_for_load_state("domcontentloaded", timeout=5000)
            duration = int((time.time() - start) * 1000)
            screenshot = await self._take_screenshot()
            return ActionResult(
                success=True,
                action_type="click",
                target=selector,
                duration_ms=duration,
                screenshot_b64=screenshot,
                page_url=self._page.url,
                page_title=await self._page.title(),
                narration=f"Clicked on element",
            )
        except Exception as e:
            return ActionResult(
                success=False,
                action_type="click",
                target=selector,
                error=str(e),
                duration_ms=int((time.time() - start) * 1000),
            )

    async def type_text(self, selector: str, text: str) -> ActionResult:
        start = time.time()
        try:
            await self._page.wait_for_selector(selector, timeout=5000)
            await self._page.fill(selector, text)
            duration = int((time.time() - start) * 1000)
            screenshot = await self._take_screenshot()
            return ActionResult(
                success=True,
                action_type="type",
                target=selector,
                value=text,
                duration_ms=duration,
                screenshot_b64=screenshot,
                page_url=self._page.url,
                narration=f"Typed text into field",
            )
        except Exception as e:
            return ActionResult(
                success=False,
                action_type="type",
                target=selector,
                value=text,
                error=str(e),
                duration_ms=int((time.time() - start) * 1000),
            )

    async def screenshot(self) -> ActionResult:
        start = time.time()
        try:
            screenshot = await self._take_screenshot()
            return ActionResult(
                success=True,
                action_type="screenshot",
                duration_ms=int((time.time() - start) * 1000),
                screenshot_b64=screenshot,
                page_url=self._page.url,
                page_title=await self._page.title(),
            )
        except Exception as e:
            return ActionResult(
                success=False,
                action_type="screenshot",
                error=str(e),
                duration_ms=int((time.time() - start) * 1000),
            )

    async def get_page_state(self) -> dict:
        try:
            title = await self._page.title()
            url = self._page.url
            # Get visible text (limited)
            text = await self._page.evaluate("() => document.body?.innerText?.substring(0, 2000) || ''")
            return {
                "url": url,
                "title": title,
                "visible_text": text[:1000],
            }
        except Exception as e:
            return {"url": "", "title": "", "visible_text": "", "error": str(e)}

    async def wait(self, ms: int = 1000) -> ActionResult:
        start = time.time()
        await asyncio.sleep(ms / 1000)
        return ActionResult(
            success=True,
            action_type="wait",
            value=str(ms),
            duration_ms=ms,
            narration=f"Waited {ms}ms",
        )

    async def scroll(self, direction: str = "down") -> ActionResult:
        start = time.time()
        try:
            delta = 500 if direction == "down" else -500
            await self._page.mouse.wheel(0, delta)
            await asyncio.sleep(0.5)
            screenshot = await self._take_screenshot()
            return ActionResult(
                success=True,
                action_type="scroll",
                value=direction,
                duration_ms=int((time.time() - start) * 1000),
                screenshot_b64=screenshot,
                narration=f"Scrolled {direction}",
            )
        except Exception as e:
            return ActionResult(
                success=False,
                action_type="scroll",
                error=str(e),
                duration_ms=int((time.time() - start) * 1000),
            )

    async def close(self) -> None:
        try:
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
            logger.info("Playwright browser closed")
        except Exception as e:
            logger.error(f"Error closing browser: {e}")

    async def _take_screenshot(self) -> Optional[str]:
        """Take a screenshot and return as base64."""
        try:
            raw = await self._page.screenshot(type="jpeg", quality=70)
            return base64.b64encode(raw).decode()
        except Exception as e:
            logger.warning(f"Screenshot failed: {e}")
            return None
