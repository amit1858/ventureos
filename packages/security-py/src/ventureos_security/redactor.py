"""Pattern-based redactor — mirrors security-ts/redactor.ts."""

from __future__ import annotations

import re
from typing import Protocol

_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("openai", re.compile(r"sk-[A-Za-z0-9_\-]{20,}")),
    ("anthropic", re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}")),
    ("github-pat", re.compile(r"\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b")),
    ("aws-akid", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    (
        "jwt",
        re.compile(
            r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b"
        ),
    ),
    (
        "pem",
        re.compile(r"-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----"),
    ),
    ("pg-url", re.compile(r"\bpostgres(?:ql)?://[^\s'\"]+", re.IGNORECASE)),
    ("azure-key", re.compile(r"\b[A-Za-z0-9]{84,88}\b")),
]


class Redactor(Protocol):
    def redact(self, text: str) -> str: ...


class PatternRedactor:
    def redact(self, text: str) -> str:
        if not text:
            return text
        out = text
        for name, regex in _PATTERNS:
            out = regex.sub(f"[REDACTED:{name}]", out)
        return out


default_redactor: Redactor = PatternRedactor()
