"""LLM service with hybrid strategy: local Ollama by default, hosted fallback."""

import httpx
import json
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


async def generate(
    prompt: str,
    system: str = "You are a helpful product demo assistant.",
    model: Optional[str] = None,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """Generate a completion using the best available LLM provider.

    Priority: OpenAI > Anthropic > Ollama (local).
    """
    if settings.has_openai:
        return await _generate_openai(prompt, system, model or "gpt-4o-mini", max_tokens, temperature)
    if settings.has_anthropic:
        return await _generate_anthropic(prompt, system, model or "claude-sonnet-4-20250514", max_tokens, temperature)
    return await _generate_ollama(prompt, system, model or "llama3.2", max_tokens, temperature)


async def _generate_openai(prompt: str, system: str, model: str, max_tokens: int, temperature: float) -> str:
    """Call OpenAI chat completions API."""
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            # Fall through to Ollama
            return await _generate_ollama(prompt, system, "llama3.2", max_tokens, temperature)


async def _generate_anthropic(prompt: str, system: str, model: str, max_tokens: int, temperature: float) -> str:
    """Call Anthropic messages API."""
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "system": system,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            resp.raise_for_status()
            return resp.json()["content"][0]["text"]
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            return await _generate_ollama(prompt, system, "llama3.2", max_tokens, temperature)


async def _generate_ollama(prompt: str, system: str, model: str, max_tokens: int, temperature: float) -> str:
    """Call local Ollama API."""
    async with httpx.AsyncClient(timeout=120) as client:
        try:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "system": system,
                    "options": {
                        "num_predict": max_tokens,
                        "temperature": temperature,
                    },
                    "stream": False,
                },
            )
            resp.raise_for_status()
            return resp.json().get("response", "I'm unable to generate a response right now.")
        except Exception as e:
            logger.error(f"Ollama API error: {e}")
            return (
                "I apologize, but I'm currently unable to process your request. "
                "No LLM provider is available. Please check the backend configuration."
            )


async def generate_json(
    prompt: str,
    system: str = "You are a helpful assistant. Respond only with valid JSON.",
    model: Optional[str] = None,
) -> dict:
    """Generate and parse a JSON response from the LLM."""
    raw = await generate(prompt, system, model, temperature=0.1)
    # Try to extract JSON from the response
    try:
        # Handle markdown code blocks
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse LLM JSON response: {raw[:200]}")
        return {"error": "Failed to parse response", "raw": raw}
