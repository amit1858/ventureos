"""Key masking + cheap shape validation. NEVER returns or logs the plaintext."""

from __future__ import annotations

import re
from typing import Literal

ProviderId = Literal[
    "openai",
    "azure_openai",
    "anthropic",
    "gemini",
    "github_models",
    "ollama",
    "azure_ai_foundry",
]

_PATTERNS: dict[str, re.Pattern[str] | None] = {
    "openai": re.compile(r"^sk-[A-Za-z0-9_\-]{20,}$"),
    "azure_openai": re.compile(r"^[A-Za-z0-9]{32,}$"),
    "anthropic": re.compile(r"^sk-ant-[A-Za-z0-9_\-]{20,}$"),
    "gemini": re.compile(r"^[A-Za-z0-9_\-]{30,}$"),
    "github_models": re.compile(r"^(ghp_|github_pat_)[A-Za-z0-9_]{20,}$"),
    "ollama": None,
    "azure_ai_foundry": re.compile(r"^[A-Za-z0-9]{32,}$"),
}


def mask_key(secret: str) -> str:
    """Return a display-only masked version of `secret`."""
    if not isinstance(secret, str):
        return "****"
    trimmed = secret.strip()
    if len(trimmed) <= 8:
        return "****"
    return f"{trimmed[:4]}****{trimmed[-4:]}"


def validate_key_shape(provider: ProviderId, secret: str) -> dict[str, str | bool]:
    if provider not in _PATTERNS:
        return {"ok": False, "reason": f"Unknown provider '{provider}'."}
    pattern = _PATTERNS[provider]
    if pattern is None:
        return {"ok": True}
    if not pattern.match(secret):
        return {"ok": False, "reason": f"Secret does not match expected pattern for '{provider}'."}
    return {"ok": True}
