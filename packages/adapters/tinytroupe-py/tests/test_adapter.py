"""
Tests for the TinyTroupe adapter & CLI (Sprint 1D).

These tests run without the real `tinytroupe` package by installing fakes into
`sys.modules`. They cover:

  * Adapter output shape (generate_personas, run_interview, run_focus_group,
    run_buying_committee) maps to the Foundry contract surface.
  * Stance heuristics produce deterministic decisions.
  * CLI dispatch rejects calls when no OPENAI_API_KEY is present.
  * Sanitiser strips secret patterns (sk-…, Bearer …) from outbound messages.
  * The bridge never reflects the secret into stdout / error text.
"""
from __future__ import annotations

import importlib
import io
import json
import os
import sys
import types
from typing import Any

import pytest


# ── Fake tinytroupe ─────────────────────────────────────────────────────────

class _FakePerson:
    def __init__(self, name: str = "Persona") -> None:
        self.name = name
        self._defs: dict[str, Any] = {}
        self.episodic_memory: list[dict[str, str]] = []

    def define(self, key: str, value: Any) -> None:
        self._defs[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        return self._defs.get(key, default)

    def listen(self, text: str) -> None:
        self.episodic_memory.append({"speaker": "interviewer", "content": text})

    def act(self) -> None:
        self.episodic_memory.append({
            "speaker": "self",
            "content": f"{self.name}: I love this offer and want to buy it now.",
        })


class _FakeWorld:
    def __init__(self, name: str, agents: list[Any]) -> None:
        self.name = name
        self.agents = agents

    def broadcast(self, message: str) -> None:
        for a in self.agents:
            a.episodic_memory.append({"speaker": "world", "content": message})

    def run(self, rounds: int) -> None:
        for _ in range(rounds):
            for a in self.agents:
                a.act()


class _FakeFactory:
    def __init__(self, _prompt: str) -> None:
        pass

    def generate_people(self, n: int) -> list[_FakePerson]:
        return [
            _FakePerson(name=f"Agent {i + 1}")
            for i in range(n)
        ]


def _install_fake_tinytroupe() -> None:
    pkg = types.ModuleType("tinytroupe")
    agent = types.ModuleType("tinytroupe.agent")
    environment = types.ModuleType("tinytroupe.environment")
    factory = types.ModuleType("tinytroupe.factory")
    agent.TinyPerson = _FakePerson  # type: ignore[attr-defined]
    environment.TinyWorld = _FakeWorld  # type: ignore[attr-defined]
    factory.TinyPersonFactory = _FakeFactory  # type: ignore[attr-defined]
    sys.modules["tinytroupe"] = pkg
    sys.modules["tinytroupe.agent"] = agent
    sys.modules["tinytroupe.environment"] = environment
    sys.modules["tinytroupe.factory"] = factory


@pytest.fixture(autouse=True)
def _setup_fake_tinytroupe(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_fake_tinytroupe()
    # Re-import the adapter so its `_tinytroupe_available()` sees the fake.
    if "foundry_tinytroupe.adapter" in sys.modules:
        importlib.reload(sys.modules["foundry_tinytroupe.adapter"])
    if "foundry_tinytroupe.cli" in sys.modules:
        importlib.reload(sys.modules["foundry_tinytroupe.cli"])


BRIEF: dict[str, Any] = {
    "businessIdea": "Faceless CRM for SMB",
    "targetMarket": "SMBs",
    "customerType": "Owner-led sales teams",
    "region": "India",
    "businessSize": "5 to 50",
}


# ── Adapter output shape ────────────────────────────────────────────────────

def test_generate_personas_maps_to_contract_shape() -> None:
    from foundry_tinytroupe.adapter import TinyTroupeRuntime
    runtime = TinyTroupeRuntime()
    out = runtime.generate_personas(BRIEF, {"n": 3})
    assert "personas" in out
    personas = out["personas"]
    assert len(personas) == 3
    for i, p in enumerate(personas, start=1):
        assert p["id"] == f"p{i}"
        # All contract fields must be present.
        for k in (
            "name", "role", "businessContext", "goals", "painPoints",
            "motivations", "objections", "buyingTriggers", "decisionPower",
            "quote", "confidenceScore", "evidenceNotes",
        ):
            assert k in p, f"missing {k}"
        assert 0.0 <= p["confidenceScore"] <= 1.0


def test_run_interview_returns_typed_transcript() -> None:
    from foundry_tinytroupe.adapter import TinyTroupeRuntime
    runtime = TinyTroupeRuntime()
    out = runtime.run_interview(BRIEF, {
        "persona": {"id": "p1", "name": "Ravi", "role": "Owner"},
        "topic": "CRM pain",
        "questions": ["What hurts most?", "What would unlock a purchase?"],
    })
    assert out["personaId"] == "p1"
    assert out["topic"] == "CRM pain"
    assert len(out["turns"]) >= 2
    assert all("speaker" in t and "content" in t for t in out["turns"])


def test_run_focus_group_includes_all_participants() -> None:
    from foundry_tinytroupe.adapter import TinyTroupeRuntime
    runtime = TinyTroupeRuntime()
    out = runtime.run_focus_group(BRIEF, {
        "personas": [
            {"id": "p1", "name": "Ravi", "role": "Owner"},
            {"id": "p2", "name": "Aditi", "role": "Sales"},
        ],
        "topic": "pricing",
        "rounds": 2,
    })
    assert out["topic"] == "pricing"
    assert out["participantIds"] == ["p1", "p2"]
    assert len(out["turns"]) > 0


def test_run_buying_committee_derives_decision_from_stances() -> None:
    from foundry_tinytroupe.adapter import TinyTroupeRuntime
    runtime = TinyTroupeRuntime()
    out = runtime.run_buying_committee(BRIEF, {
        "personas": [
            {"id": "p1", "name": "Ravi", "role": "Owner"},
            {"id": "p2", "name": "Aditi", "role": "Sales"},
        ],
        "offerSummary": "30-day pilot of Faceless CRM",
    })
    assert out["offerSummary"] == "30-day pilot of Faceless CRM"
    assert len(out["members"]) == 2
    for m in out["members"]:
        assert m["stance"] in {"supporter", "skeptic", "neutral", "champion", "blocker"}
    # Fake agents say "love" and "buy" — should land on buy/pilot, never reject.
    assert out["decision"] in {"buy", "pilot"}


# ── Stance heuristics ───────────────────────────────────────────────────────

def test_infer_stance_classifies_text() -> None:
    from foundry_tinytroupe.adapter import _infer_stance
    assert _infer_stance("") == "neutral"
    assert _infer_stance("I love it, sign me up, perfect product!") == "champion"
    assert _infer_stance("Looks great.") == "supporter"
    assert _infer_stance("Concerned about risk, won't proceed.") == "blocker"
    assert _infer_stance("I want to buy, but the risk, the expensive price, and the blocker on adoption worry me.") == "skeptic"


def test_decide_picks_outcome_from_tally() -> None:
    from foundry_tinytroupe.adapter import _decide
    assert _decide({"supporter": 3, "champion": 1, "skeptic": 0, "blocker": 0, "neutral": 0}) == "buy"
    assert _decide({"supporter": 1, "champion": 0, "skeptic": 1, "blocker": 0, "neutral": 0}) == "pilot"
    assert _decide({"supporter": 0, "champion": 0, "skeptic": 0, "blocker": 1, "neutral": 1}) == "reject"
    assert _decide({"supporter": 0, "champion": 0, "skeptic": 0, "blocker": 0, "neutral": 3}) == "defer"


# ── CLI security & dispatch ─────────────────────────────────────────────────

def test_sanitize_strips_secret_patterns() -> None:
    from foundry_tinytroupe.cli import sanitize
    assert "sk-" not in sanitize("error: bad key sk-abcdef1234567890")
    assert "Bearer" not in sanitize("Authorization: Bearer abc.def.ghi")
    assert len(sanitize("x" * 10_000)) <= 500


def test_dispatch_rejects_without_openai_creds(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("AZURE_OPENAI_API_KEY", raising=False)
    from foundry_tinytroupe.cli import dispatch
    out = dispatch({"command": "generate_personas", "brief": BRIEF, "args": {"n": 1}})
    assert out["ok"] is False
    assert "OPENAI_API_KEY" in out["reason"]


def test_dispatch_runs_when_openai_key_present(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "sk-fake-test-secret-1234567890")
    from foundry_tinytroupe.cli import dispatch
    out = dispatch({"command": "generate_personas", "brief": BRIEF, "args": {"n": 2}})
    assert out["ok"] is True
    assert "personas" in out["data"]


def test_dispatch_does_not_leak_secret_into_response(monkeypatch: pytest.MonkeyPatch) -> None:
    secret = "sk-super-secret-leak-test-9999999"
    monkeypatch.setenv("OPENAI_API_KEY", secret)
    from foundry_tinytroupe.cli import dispatch
    # Run every command — none of them should reflect the env-borne secret.
    payloads: list[dict[str, Any]] = [
        {"command": "generate_personas", "brief": BRIEF, "args": {"n": 1}},
        {"command": "run_interview", "brief": BRIEF, "args": {
            "persona": {"id": "p1", "name": "X", "role": "Y"},
            "topic": "t", "questions": ["q1"],
        }},
        {"command": "run_focus_group", "brief": BRIEF, "args": {
            "personas": [
                {"id": "p1", "name": "X", "role": "Y"},
                {"id": "p2", "name": "Z", "role": "W"},
            ],
            "topic": "pricing", "rounds": 1,
        }},
        {"command": "run_buying_committee", "brief": BRIEF, "args": {
            "personas": [
                {"id": "p1", "name": "X", "role": "Y"},
                {"id": "p2", "name": "Z", "role": "W"},
            ],
            "offerSummary": "pilot",
        }},
    ]
    for payload in payloads:
        out = dispatch(payload)
        dumped = json.dumps(out)
        assert secret not in dumped, f"secret leaked into response for {payload['command']}"
        assert "sk-super-secret" not in dumped


def test_dispatch_rejects_unknown_command(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "sk-fake-1234567890")
    from foundry_tinytroupe.cli import dispatch
    out = dispatch({"command": "delete_everything", "brief": {}, "args": {}})
    assert out["ok"] is False
    assert "Unknown command" in out["reason"]


def test_dispatch_rejects_missing_command() -> None:
    from foundry_tinytroupe.cli import dispatch
    out = dispatch({"brief": {}, "args": {}})
    assert out["ok"] is False
    assert "Missing 'command'" in out["reason"]


def test_cli_main_reads_stdin_and_writes_stdout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "sk-fake-1234567890")
    payload = json.dumps({"command": "generate_personas", "brief": BRIEF, "args": {"n": 1}})
    monkeypatch.setattr("sys.stdin", io.StringIO(payload))
    buf = io.StringIO()
    monkeypatch.setattr("sys.stdout", buf)
    from foundry_tinytroupe.cli import main
    rc = main()
    assert rc == 0
    out = json.loads(buf.getvalue().strip())
    assert out["ok"] is True
    assert "personas" in out["data"]
