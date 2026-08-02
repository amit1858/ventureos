"""
TinyTroupe subprocess CLI.

Invoked from the TypeScript host (`apps/web/src/lib/personalab.ts`) as an
alternate engine. Reads a JSON command from stdin, writes a JSON result to
stdout.

The host hands the user's BYOK secret to this process ONLY through the curated
environment variables `OPENAI_API_KEY` / `AZURE_OPENAI_*` (TinyTroupe's expected
config surface). The host never serialises the secret onto the command line and
never logs the subprocess environment.

If the real `tinytroupe` package is not installed, the CLI exits with a clear,
non-secret error so the host can fall back to its built-in orchestrator.

Input shape (stdin, one JSON object):
  {
    "command": "generate_personas" | "run_interview"
              | "run_focus_group" | "run_buying_committee",
    "brief":   { ... PersonaLabBrief ... },
    "args":    { ... command-specific ... }
  }

Output shape (stdout, one JSON object):
  { "ok": true,  "data": { ... } }
  { "ok": false, "reason": "string (sanitised)" }
"""
from __future__ import annotations

import json
import os
import re
import sys
from typing import Any


SECRET_PATTERN = re.compile(r"(sk-[A-Za-z0-9_\-]{8,}|Bearer\s+\S+)")


def sanitize(message: str) -> str:
    """Strip anything that looks like a credential from outbound text."""
    return SECRET_PATTERN.sub("***", message)[:500]


def require_tinytroupe() -> Any:
    try:
        import tinytroupe  # type: ignore[import-not-found]
        return tinytroupe
    except Exception as exc:  # pragma: no cover - only in real subprocess
        print(json.dumps({
            "ok": False,
            "reason": (
                "tinytroupe is not installed in the VENTUREOS_TINYTROUPE_PYTHON "
                "environment. Install with `uv pip install tinytroupe` or fall "
                "back to the built-in PersonaLab engine."
            ),
        }))
        raise SystemExit(0) from exc


def _have_openai_credentials() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY")) or bool(os.environ.get("AZURE_OPENAI_API_KEY"))


def dispatch(payload: dict[str, Any]) -> dict[str, Any]:
    command = payload.get("command")
    if not isinstance(command, str):
        return {"ok": False, "reason": "Missing 'command'."}
    if not _have_openai_credentials():
        return {
            "ok": False,
            "reason": (
                "TinyTroupe requires OPENAI_API_KEY (or AZURE_OPENAI_API_KEY) in the "
                "subprocess environment. The host must pass it as env, never as args."
            ),
        }

    # Defer real TinyTroupe wiring to the adapter module. The CLI's job is to
    # validate inputs and route — the heavy lifting lives in adapter.py so it
    # can be unit-tested without spawning a subprocess.
    from .adapter import TinyTroupeRuntime  # noqa: WPS433 - intentional local import

    try:
        runtime = TinyTroupeRuntime()
        if command == "generate_personas":
            return {"ok": True, "data": runtime.generate_personas(payload.get("brief", {}), payload.get("args", {}))}
        if command == "run_interview":
            return {"ok": True, "data": runtime.run_interview(payload.get("brief", {}), payload.get("args", {}))}
        if command == "run_focus_group":
            return {"ok": True, "data": runtime.run_focus_group(payload.get("brief", {}), payload.get("args", {}))}
        if command == "run_buying_committee":
            return {"ok": True, "data": runtime.run_buying_committee(payload.get("brief", {}), payload.get("args", {}))}
        return {"ok": False, "reason": f"Unknown command: {command}"}
    except NotImplementedError as exc:
        return {"ok": False, "reason": sanitize(str(exc))}
    except Exception as exc:  # noqa: BLE001 - last-ditch sanitiser
        return {"ok": False, "reason": sanitize(str(exc))}


def main() -> int:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(json.dumps({"ok": False, "reason": f"Invalid JSON on stdin: {exc.msg}"}))
        return 1
    if not isinstance(payload, dict):
        print(json.dumps({"ok": False, "reason": "Expected JSON object on stdin."}))
        return 1
    print(json.dumps(dispatch(payload)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
