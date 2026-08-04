# Foundry — Release 1.0 Candidate Manifest

| Field | Value |
|---|---|
| **Release name** | Foundry 1.0 |
| **Version** | v1.0.0 |
| **Date** | 2026-08-04 |
| **Source branch** | `amit1858-fictional-succotash` |
| **Pre-release HEAD** | `03c5dd8` (rebrand + polish + providers + persistence + auth + screenshots already committed) |
| **Release owner** | Amit Pandey ([@amit1858](https://github.com/amit1858)) |
| **Repository (target)** | `amit1858/foundry-venture-os` |
| **Production URL** | https://ventureos-dun.vercel.app |
| **License** | MIT |

## Product positioning

- **Tagline:** *Where ideas become execution-ready ventures.*
- **Category:** An AI-native Venture Operating System.
- **One line:** Foundry helps product teams transform raw ideas into validated, execution-ready ventures using collaborative AI agents — a deliberation layer in front of the IDE, not a single chatbot.

## Scope included in Release 1.0

Delivered across the branch history plus the final continuity + documentation commits:

- VentureOS → Foundry product rebrand (UI, packages `@foundry/*`, Python `foundry_*` modules, internal globals `__foundry_`)
- Release 1.0 UI / positioning polish (landing, navigation, My Ventures, trust pages)
- Mobile navigation fix (hamburger, responsive dropdowns)
- Provider capability registry (provider-agnostic multi-model support)
- Adaptive token budgeting
- Provider-independent structured-output pipeline with deterministic JSON repair before retry
- Telemetry and usage-cost fixes
- Supabase store configuration alignment (`SUPABASE_URL ?? NEXT_PUBLIC_SUPABASE_URL`)
- Sign-in copy correction (allowlist message shown only when an allowlist is configured)
- **Venture-context UX repair** — venture-scoped artifact continuity across Research Graph, Venture Validation, and Build Planning (no manual JSON hand-offs; automatic artifact discovery; prerequisite gating; safe redirects)
- Graphify route repair
- Tests (venture-context, graphify/build route, sign-in UI) and documentation

## Models validated

| Provider / model | Role | Validation |
|---|---|---|
| OpenAI `gpt-4o-mini` | Default | Full live BYOK workflow (localhost, real key) |
| OpenAI `gpt-4.1` | Premium | Full live BYOK workflow |
| Anthropic `claude-sonnet-4-5` | Alternative provider | Hardened live validation |
| Google Gemini | Supported adapter | Adapter coverage only — **not** live-validated |
| Azure OpenAI | Supported adapter | Adapter coverage only — **not** live-validated |

## Capabilities validated

BYOK · Venture creation · Personas · Interviews · Focus groups · Buying committee · Insights · Research Graph · Venture Validation (Proceed / Pivot / Kill) · Build Planning · Persistence · Run history · Cost telemetry · **Venture-scoped artifact continuity** (auto-discovery, no JSON paste).

## Security controls validated

- Google OAuth sign-in (open posture); guided demo public with no sign-in.
- BYOK provider keys encrypted server-side; browser and APIs expose masked previews only; log/redaction guards for key shapes.
- Supabase Row Level Security enforcing per-user ownership (audited); service-role key confined to server-side code.
- Route protection on authenticated surfaces; demo/Real-Mode separation.

> Signed-in production validation (two-user Google sign-in, cross-user isolation, signed-in persistence, BYOK-in-prod) is **human-gated** — see `security-validation.md` and `production-smoke-test.md` for the manual test plans.

## Authentication posture

- Public landing: **open**
- Guided demo: **open**, no sign-in, no keys
- Google sign-in: **open** to valid Google accounts
- `VENTUREOS_ALLOWED_EMAILS`: **empty / unset** in production
- `VENTUREOS_ALPHA_ACCESS`: **false / unset** in production
- Real Mode: authenticated user + own BYOK provider key; no shared owner API key for public users

## Persistence architecture

- Supabase (Postgres) with Row Level Security as the durable store.
- Server resolves the Supabase URL as `SUPABASE_URL ?? NEXT_PUBLIC_SUPABASE_URL` across `credentials.ts`, `ventures.ts`, and `jobs.ts` (internally consistent).
- Local development uses an in-memory store; production uses Supabase.

## Known limitations (Release 1.0)

- No global cross-venture Usage Intelligence dashboard.
- Buying committee calls are sequential and can be slow.
- Gemini and Azure OpenAI are not live-validated (adapter coverage only).
- Advanced implementation workspaces retain some utilitarian styling.
- No external durable job queue; in-flight jobs may not survive process interruption.
- Vercel / project URL rename is separate from this release (production stays `ventureos-dun.vercel.app`).
- Historical VentureOS submission artifacts remain archived intentionally.

## Deferred to Release 1.1

- Global cross-venture Usage Intelligence dashboard.
- Parallelized buying-committee execution.
- Live validation of Gemini and Azure OpenAI adapters.
- External durable job queue for long-running jobs.
- Visual polish pass on advanced implementation workspaces.

## Deployment checklist

1. Quality gate green (typecheck · arch lint · tests · production build).
2. Working tree free of secrets and temporary artifacts.
3. LICENSE present; README badge + license section reflect MIT.
4. Repository renamed to `foundry-venture-os`; old slug redirects; in-app links resolve.
5. Vercel production env vars confirmed (names only; no values printed).
6. Previous production deployment recorded (rollback reference).
7. `vercel --prod` deploy; new deployment ID recorded.
8. Production resolves; Foundry branding visible; legacy JSON-box lab UI gone.
9. Automatable production black-box (public/structural, multi-viewport) passes.
10. Human-gated validation (Google sign-in, two-user isolation, signed-in persistence, BYOK) executed via the provided manual plans.
11. Canonical screenshots captured from production; README finalized.
12. Annotated tag `v1.0.0`; GitHub Release published once links + license valid and validation passes.

## Rollback plan

- Record the previous production deployment ID before deploying; if the new deployment regresses, promote the previous deployment in Vercel (instant rollback of the alias).
- The repository rename is reversible; GitHub keeps redirects from the old slug either direction.
- Release commits are additive on a feature branch; `git revert` or resetting the branch restores the prior tree without losing history.
- See `rollback-plan.md` for step-by-step commands.

## Final acceptance status

**Engineering complete; automatable release steps in progress.** Acceptance for public release is pending the human-gated production validation (Google sign-in, cross-user isolation, signed-in persistence, BYOK-in-production) and canonical signed-in screenshots. All automatable engineering, quality-gate, deployment, and public/structural validation are owned by this release execution.
