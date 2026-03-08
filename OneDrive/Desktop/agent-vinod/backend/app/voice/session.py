"""Voice session management using LiveKit Agents.

When ENABLE_VOICE=true, provides real-time voice conversation.
Otherwise, serves as a stub that returns text-only mode.
"""

import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


class VoiceSession:
    """Manages a single voice session with a buyer."""

    def __init__(self, session_id: str, workspace_id: str):
        self.session_id = session_id
        self.workspace_id = workspace_id
        self.is_active = False
        self._room_name: Optional[str] = None
        self._token: Optional[str] = None

    async def start(self) -> dict:
        """Start a voice session. Returns connection info for the frontend."""
        if not settings.enable_voice:
            logger.info("Voice disabled, returning text-only mode")
            return {
                "mode": "text",
                "message": "Voice is not configured. Using text chat mode.",
            }

        try:
            return await self._create_livekit_room()
        except Exception as e:
            logger.error(f"Failed to start voice session: {e}")
            return {
                "mode": "text",
                "message": f"Voice unavailable: {e}. Falling back to text chat.",
            }

    async def _create_livekit_room(self) -> dict:
        """Create a LiveKit room and generate participant token."""
        try:
            from livekit import api as livekit_api

            self._room_name = f"demo-{self.session_id}"

            # Generate token for buyer
            token = livekit_api.AccessToken(
                settings.livekit_api_key,
                settings.livekit_api_secret,
            )
            token.with_identity(f"buyer-{self.session_id}")
            token.with_name("Demo Buyer")
            token.with_grants(livekit_api.VideoGrants(
                room_join=True,
                room=self._room_name,
            ))

            self._token = token.to_jwt()
            self.is_active = True

            return {
                "mode": "voice",
                "livekit_url": settings.livekit_url,
                "token": self._token,
                "room_name": self._room_name,
            }
        except ImportError:
            logger.warning("LiveKit SDK not installed")
            return {
                "mode": "text",
                "message": "LiveKit SDK not installed. Using text chat.",
            }

    async def stop(self) -> None:
        """Stop the voice session."""
        self.is_active = False
        self._token = None
        logger.info(f"Voice session stopped for {self.session_id}")


async def transcribe_audio(audio_bytes: bytes) -> str:
    """Transcribe audio bytes to text using faster-whisper.

    Falls back to returning empty string if faster-whisper is unavailable.
    """
    try:
        from faster_whisper import WhisperModel

        model = WhisperModel("base", device="cpu", compute_type="int8")
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        try:
            segments, _ = model.transcribe(tmp_path)
            text = " ".join(segment.text for segment in segments)
            return text.strip()
        finally:
            os.unlink(tmp_path)
    except ImportError:
        logger.warning("faster-whisper not installed, cannot transcribe")
        return ""
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        return ""
