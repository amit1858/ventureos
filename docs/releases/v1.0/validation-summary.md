# Foundry 1.0 — Validation Summary

## Models validated (live BYOK)

| Provider / model | Role | Full PersonaLab run | Tokens | Est. cost | Failures |
|---|---|---|---|---|---|
| OpenAI `gpt-4o-mini` | **Default** | 89.8 s (9 calls) | 19,158 | ~$0.0055 | 0 |
| OpenAI `gpt-4.1` | **Premium** | 63.8 s (9 calls) | 20,691 | ~$0.0828 | 0 |
| Anthropic `claude-sonnet-4-5` | **Alternative** | 9 calls (hardened) | 39,674 | n/a | 0 |
| Google Gemini | Supported adapter | — | — | — | not live-validated |
| Azure OpenAI | Supported adapter | — | — | — | not live-validated |

Stage timings (gpt-4o-mini): personas 21.5 s · interviews ~6.1/6.7 s · focus group 10.4 s ·
buying committee 42.5 s · insights 2.7 s. Venture-continuity live run: personas 21.1 s ·
research graph 41.0 s · validation 10.6 s (decision **PIVOT**) · build 6.0 s.

## Capabilities validated

BYOK · Venture creation · Personas · Interviews · Focus groups · Buying committee ·
Insights · Research Graph · Venture Validation (Proceed / Pivot / Kill) · Build Planning ·
Persistence · Run history · Cost telemetry · **Venture-scoped artifact continuity**
(auto-discovery; no JSON paste; prerequisite gating).

## Security validation

| Area | Status |
|---|---|
| Open-posture sign-in copy (no allowlist message) | PASS (production) |
| Guided demo public, key-free | PASS (production) |
| Auth gating on `/ventures`, `/settings/byok`; `/labs/*` redirect | PASS (production) |
| BYOK keys encrypted server-side (AES-256-GCM); masked in UI/API | PASS (code + audit) |
| Supabase RLS per-user ownership; service-role server-only | PASS (audit) |
| Two-user cross-user isolation (live) | **PENDING — human-gated** |
| Signed-in persistence + BYOK on production | **PENDING — human-gated** |

The complete two-user isolation test plan is in `security-validation.md`.

## Provider recommendations

- **Default:** OpenAI `gpt-4o-mini` — fastest cost/quality balance; full pipeline < $0.01.
- **Premium:** OpenAI `gpt-4.1` — deeper reasoning, richer personas/committee; ~15× cost.
- **Alternative provider:** Anthropic `claude-sonnet-4-5` — strong quality, provider independence.

## Known limitations

- Gemini and Azure OpenAI adapters are not live-validated (adapter coverage only).
- Buying-committee calls are sequential and can be slow.
- No global cross-venture Usage Intelligence dashboard yet.
- No external durable job queue; in-flight jobs may not survive process interruption.
- Signed-in production validation is human-gated (Google OAuth cannot be headlessly automated).
