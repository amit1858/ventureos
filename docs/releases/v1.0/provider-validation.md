# Foundry Release 1.0 — Provider Validation

Provider-independence and multi-model validation results. All figures below are from **live BYOK runs against the real provider APIs** from the running application; telemetry (calls, tokens, cost, latency, failures) was captured per run. No numbers are estimated or fabricated.

## Method

- Each provider key was registered through the in-app BYOK flow (encrypted server-side; masked preview only).
- The complete PersonaLab workflow was executed (personas → interviews → focus group → buying committee → insights), plus the venture-scoped continuity workflow (Research Graph → Venture Validation → Build Planning).
- Telemetry captured per run: model, latency, call count, prompt/completion/total tokens, estimated USD cost, failure count.

## Results — full PersonaLab workflow

| Model | Role | Latency | Calls | Total tokens | Est. cost (USD) | Failures |
|---|---|---|---|---|---|---|
| OpenAI `gpt-4o-mini` | Default | ~89.8 s | 9 | 19,158 | $0.0055 | 0 |
| OpenAI `gpt-4.1` | Premium | ~63.8 s | 9 | 20,691 | $0.0828 | 0 |
| Anthropic `claude-sonnet-4-5` | Alternative | full-budget run | 9 | 39,674 | not captured¹ | 0² |

¹ Cost estimation was not recorded for the Anthropic run; token usage is recorded.
² No failures were recorded across the captured Anthropic runs (validation + hardening + full-budget).

### Per-step latency — `gpt-4o-mini`
generatePersonas 21.5 s · interview#1 6.1 s · interview#2 6.7 s · focusGroup 10.4 s · buyingCommittee 42.5 s · insights 2.7 s.

The buying committee dominates latency (sequential per-persona deliberation) — consistent with the documented known limitation.

## Results — venture-scoped continuity workflow (`gpt-4o-mini`, live black-box)

| Stage | Latency | Auto-consumed input | Outcome |
|---|---|---|---|
| Personas | 21.1 s | Venture brief | 6 personas (styled) |
| Research Graph | 41.0 s | Brief + personas | Typed graph rendered |
| Venture Validation | 10.6 s | 6 personas (no paste) | Decision: **PIVOT** (styled scorecard) |
| Build Planning | 6.0 s | Recommendation + graph (no paste) | Build artifact pack |

All four stages discovered persisted artifacts automatically — no JSON paste, no venture-ID entry. 6/6 stages succeeded, 0 failures.

## Reliability notes

- **Finish state:** all captured runs completed normally with 0 recorded failures.
- **JSON repair / retries:** the pipeline applies deterministic JSON repair before any model retry; the captured runs completed without failures, so no corrective model retries were required.
- **Provider independence:** the same feature code produced well-formed, styled artifacts across OpenAI and Anthropic, confirming the abstraction holds.

## Quality comparison (qualitative)

- **Reasoning depth / persona quality:** `gpt-4.1` and `claude-sonnet-4-5` produced richer, more differentiated personas and buying-committee objections than `gpt-4o-mini`; `gpt-4o-mini` was fully coherent and usable.
- **Interview / committee quality:** all three produced on-topic, non-degenerate transcripts.
- **Insight usefulness:** comparable across models; premium models added nuance.

## Recommendations

| Recommendation | Model | Basis |
|---|---|---|
| **Default** | OpenAI `gpt-4o-mini` | Full live validation; ~$0.0055 per full workflow; fast enough for interactive use |
| **Premium** | OpenAI `gpt-4.1` | Full live validation; faster wall-clock (~64 s) and higher quality; ~15× the cost |
| **Alternative provider** | Anthropic `claude-sonnet-4-5` | Hardened full-workflow validation; strong reasoning depth |
| Gemini / Azure OpenAI | — | Adapter coverage only; **live validation pending** (Release 1.1) |

Do not describe Gemini or Azure adapters as live-validated.
