# Architecture Overview

A public-facing summary of how Foundry is put together. For the internal Sprint −1 architectural-intent document, see [`architecture.md`](architecture.md).

## Goals

1. **Loose coupling to external engines.** TinyTroupe-style persona work and Graphify-inspired graph work can each be swapped or vendored without rewriting labs.
2. **BYOK from day zero.** No subsystem imports a provider SDK directly. All vendor SDKs live behind adapter packages enforced by `lint:arch`.
3. **Typed artifacts between phases.** Every lab consumes and produces JSON-Schema contracts from `@foundry/contracts`. No free-form prompt chaining at lab boundaries.
4. **Async-first.** Long-running labs run as durable `VentureJob`s, not request/response.
5. **Observability as code.** Every LLM call carries `trace_id`, `lab`, `agent`, `artifact_id`; cost and latency are recorded.
6. **Single-tenant by default, multi-tenant by design.** Tenant ID is a first-class column where persistence exists.

## Five planes

```
┌──────────────────────────────────────────────────────────┐
│  1. EXPERIENCE PLANE                                     │
│     Web (Next.js) · Workspace · Demo Mode · BYOK UI      │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  2. ORCHESTRATION PLANE                                  │
│     Venture state · VentureJob runner · Artifact registry│
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  3. LAB PLANE                                            │
│     PersonaLab │ Research Graph │ VentureLab │ BuildSquad│
│     Each lab = agents + tools + contracts + evaluators   │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  4. PROVIDER PLANE                                       │
│     OpenAI · Anthropic · Gemini · Azure OpenAI · GitHub  │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  5. PERSISTENCE PLANE                                    │
│     Supabase · encrypted credential store · file blobs   │
└──────────────────────────────────────────────────────────┘
```

## Package layout

```
apps/web                              # Next.js app, workspace, demo, BYOK UI

packages/
  contracts/                          # JSON Schemas + generated types (the seams)
  personalab/                         # Persona generation + buying-committee orchestrator
  research-graph/                     # Typed graph builder + god-node / contradiction surfacing
  venturelab/                         # Recommendation engine (Proceed / Pivot / Kill)
  buildsquad/                         # Planning swarm + renderRepoScaffold (14 files)
  evaluation/                         # EvaluationReport generation + provenance
  providers/
    openai/  anthropic/  gemini/  azure-openai/    # the ONLY packages allowed to import vendor SDKs
  adapters/
    github-ts/                        # Octokit isolated here; export adapter + error classifier
    tinytroupe-py/                    # scaffolded for future Python integration
    graphify-py/ graphify-ts/         # scaffolded for future Python/TS Graphify integration
  credentials/                        # encrypted BYOK store
  jobs/                               # VentureJob primitive
```

`pnpm run lint:arch` enforces:

- `@octokit/*` imports only from `packages/adapters/github-ts/**`
- vendor LLM SDKs only from their respective `packages/providers/**`
- `apps/**` may import only `@foundry/*` packages, never raw vendor SDKs
- labs may not import other labs directly — they communicate through artifacts

## Contracts-first

Every lab boundary is a JSON Schema in `@foundry/contracts`. The current major artifact types:

- `Brief`, `PersonaSet`, `CommitteeTranscript`
- `ResearchGraph` (`nodes`, `edges`, `godNodes`, `contradictions`, `stats`)
- `VentureRecommendation` (decision, scorecard, evidence, counterSignals, assumptions, risks, nextSteps)
- `BuildSquadPack` (vision, PRD, architecture, roadmap, userStories, requirements, critiques)
- `EvaluationReport` (readiness, coverage, recommendation, assumptions, openQuestions, validationRoadmap, provenance)
- `GithubExportArtifact` (repo URL, full SHA, short SHA, file count, attempt log)

Artifacts are versioned per-Venture so a lab re-run can produce v2 without overwriting v1.

## VentureJob — async execution

Each lab run produces a `VentureJob`:

```ts
{
  id, ventureId, kind, status,
  progress: { step, label, pct },
  provider, model, costUsd,
  startedAt, finishedAt, elapsedMs,
  failure?: { code, title, hint, retryable, byokLinked }
}
```

Failure codes are stable (e.g. `repo_exists`, `invalid_token`, `insufficient_scope`, `rate_limited`, `network`, `json_parse`) and map to a structured BYOK-linked failure card in the Workspace.

## GitHub Export

`packages/adapters/github-ts/` owns the entire GitHub interaction:

- preview file list (no credential needed)
- repo creation under the authenticated BYOK GitHub user
- single-commit push of all 14 files
- error classifier that turns Octokit errors into stable failure codes
- secret-leakage guard tested by `reason-code` and renderer tests

After success the Venture gains a `github_repo` artifact, a timeline event with the repo URL, and the Workspace Overview shows the short commit SHA with Copy / Open actions.

## Security

- Credentials encrypted with `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY` (32-byte key, hex or base64).
- Credentials are only ever decrypted server-side. They are never serialized to React props, never written to logs.
- A test asserts no `ghp_…` shape ever appears in rendered export content.
- `.env*` files are git-ignored; the repo ships only `apps/web/.env.example`.

See [`security-byok.md`](security-byok.md).

## Demo Mode

Demo Mode is a parallel surface that ships **seeded artifacts** in `apps/web/src/lib/demo/`. It uses the same renderers as Real Mode so judges can experience the full output without keys. See [`demo-mode.md`](demo-mode.md).

## What is *not* in scope

- External queue (Sidekiq / Temporal / etc.)
- Streaming token-by-token UI
- Squad-OSS integration
- Marketplace / persona library / sharing
- Multi-tenant admin
- Billing

See [`known-limitations.md`](known-limitations.md) for the full honest list.
