# Foundry 1.0

**An AI-native Venture Operating System that helps teams decide what deserves to be built
before engineering begins.**

Foundry helps product teams transform raw ideas into validated, execution-ready ventures
using collaborative AI agents — a deliberation layer in front of the IDE, not a single
chatbot. Try it with no sign-in and no keys: **[Guided demo](https://ventureos-dun.vercel.app/demo/faceless-crm)**.

## Highlights

- **Full idea-to-build pipeline** — Personas → Interviews → Focus Groups → Buying Committee
  → Insights → Research Graph → Venture Validation (Proceed / Pivot / Kill) → Build Planning
  → GitHub export.
- **Venture-scoped artifact continuity** — each lab automatically discovers the active
  venture's artifacts. No pasting JSON, no copying IDs, prerequisite-gated actions.
- **Bring your own keys (BYOK)** — OpenAI, Anthropic, and more via a provider-agnostic
  capability registry with deterministic JSON repair and adaptive token budgeting. Keys are
  encrypted server-side (AES-256-GCM) and never exposed to the browser.
- **Open access** — sign in with any Google account; the guided demo stays public and key-free.
- **Cost telemetry** — per-run token usage and estimated cost.

## Validated in 1.0

- **Providers (live):** OpenAI `gpt-4o-mini` (default), OpenAI `gpt-4.1` (premium),
  Anthropic `claude-sonnet-4-5` (alternative) — full PersonaLab workflow, 0 failures.
- **Quality gate:** 436 tests passing, typecheck across 16 packages, architecture lint
  clean, production build green.
- **Production:** deployed and serving at
  [ventureos-dun.vercel.app](https://ventureos-dun.vercel.app); public/structural
  validation across 5 viewports passing.

## Recommended providers

| Role | Model |
|---|---|
| Default | OpenAI `gpt-4o-mini` |
| Premium | OpenAI `gpt-4.1` |
| Alternative | Anthropic `claude-sonnet-4-5` |

## Known limitations

- Gemini and Azure OpenAI adapters ship but are not yet live-validated.
- Buying-committee calls run sequentially and can be slow.
- No global cross-venture usage dashboard yet; no external durable job queue.
- Signed-in production validation (Google OAuth, two-user isolation) is verified manually.

## Getting started

- **Guided demo (no keys):** https://ventureos-dun.vercel.app/demo/faceless-crm
- **Real Mode (BYOK):** sign in with Google → add a provider key at
  [`/settings/byok`](https://ventureos-dun.vercel.app/settings/byok) → create a venture.
- **Run locally:** see the [README](../../../README.md).

## License

MIT — see [LICENSE](../../../LICENSE).
