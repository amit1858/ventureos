# Foundry — Repository Structure

> Sprint −1 deliverable. Monorepo layout, package responsibilities, ownership boundaries.

## 1. Why a monorepo

- **Cross-cutting contracts.** Lab inputs and outputs are JSON schemas consumed by Python and TypeScript code. A monorepo keeps schema and generated types atomically in sync.
- **Polyglot reality.** PersonaLab/VentureLab are Python; BuildSquad and the web app are TypeScript. Coordinating versioned releases across multiple repos for every contract change would be painful.
- **One CI pipeline** to enforce the architectural rules (provider import linter, schema sync, contract tests).
- **Shared eval harness** that touches every lab.

## 2. Top-level layout

```
foundry/
├── apps/                          # Deployable application surfaces
│   ├── web/                       # Next.js front-end
│   ├── api/                       # API gateway / orchestrator (TypeScript, Fastify)
│   ├── worker-python/             # PersonaLab + VentureLab worker (Python, Arq)
│   ├── worker-node/               # BuildSquad worker (TypeScript, BullMQ)
│   └── cli/                       # `foundry` CLI (TypeScript, oclif)
│
├── packages/                      # Reusable, versioned internal packages
│   ├── contracts/                 # JSON schemas + generated TS + Python types  ⭐ single source of truth
│   ├── providers/                 # Provider abstraction (BYOK)  ⭐ only place to import provider SDKs
│   │   ├── core-ts/
│   │   ├── core-py/
│   │   ├── openai-ts/
│   │   ├── azure-openai-ts/
│   │   ├── anthropic-ts/
│   │   ├── gemini-ts/
│   │   └── conformance/           # adapter conformance tests
│   ├── adapters/                  # External-engine adapters  ⭐ only place to import those engines
│   │   ├── tinytroupe-py/
│   │   ├── graphify-py/
│   │   ├── squad-ts/
│   │   └── github-ts/
│   ├── agents/                    # Agent definitions and prompt assets
│   │   ├── persona-lab/
│   │   ├── venture-lab/
│   │   └── build-squad/
│   ├── labs/                      # Lab business logic (orchestrates agents + adapters)
│   │   ├── persona-lab-py/
│   │   ├── venture-lab-py/
│   │   └── build-squad-ts/
│   ├── orchestrator/              # State machine, job runner, artifact registry, gate logic
│   ├── persistence/               # Repositories, migrations, vector-index wrappers
│   ├── telemetry/                 # OTel setup, structured logger, redactor, cost meter
│   ├── security/                  # KMS envelope encryption, key vault wrapper, audit log
│   ├── eval/                      # Evaluation harness (rubrics, judges, intrinsic checks)
│   ├── ui/                        # Shared React components for apps/web and future surfaces
│   └── testing/                   # MockProvider, fixtures, factories, integration harness
│
├── docs/                          # The 12 Sprint −1 docs + ADRs + user docs
│   ├── vision.md
│   ├── architecture.md
│   ├── security.md
│   ├── product-roadmap.md
│   ├── dependency-analysis-tinytroupe.md
│   ├── dependency-analysis-graphify.md
│   ├── dependency-analysis-squad.md
│   ├── adapter-strategy.md
│   ├── provider-abstraction.md
│   ├── evaluation-framework.md
│   ├── repository-structure.md
│   ├── faceless-crm-reference-scenario.md
│   └── adr/                       # numbered architectural decisions
│
├── tests/                         # Cross-package integration + end-to-end tests
│   ├── e2e/                       # Faceless CRM scenario, etc.
│   ├── contract/                  # Adapter ↔ engine contract tests against pinned versions
│   ├── load/                      # Spike + soak tests
│   └── security/                  # Tenant isolation, redactor fuzz, sandbox escape
│
├── examples/                      # Runnable sample scripts, demo briefs, sample personas
│   ├── faceless-crm/              # The reference scenario as a runnable example
│   ├── sample-briefs/
│   └── sample-providers/
│
├── vendor/                        # Slot for vendored forks (initially empty)
│   ├── tinytroupe/                # empty unless ADR triggers vendoring
│   ├── graphify/
│   └── squad-oss/
│
├── infra/                         # IaC (Terraform / Bicep), Docker, k8s manifests, GH Actions
│   ├── terraform/
│   ├── docker/
│   ├── k8s/
│   └── github-actions/
│
├── scripts/                       # Repo tooling (gen-types, lint-arch, bump-versions)
├── .github/
├── .changeset/                    # changesets for TS package versioning
├── pyproject.toml                 # workspace tool config (uv / hatch)
├── package.json                   # npm workspaces root
├── pnpm-workspace.yaml            # or npm workspaces
├── turbo.json                     # task orchestration
├── uv.lock                        # Python lockfile
├── pnpm-lock.yaml                 # TS lockfile
├── .editorconfig
├── .gitignore
└── README.md
```

## 3. Package responsibility map

| Package | Owns | Depends on | Forbidden from |
| --- | --- | --- | --- |
| `packages/contracts` | JSON schemas; generated types | — | Anything else |
| `packages/providers/*` | All LLM provider calls | `contracts`, `telemetry`, `security` | Adapters, labs, apps |
| `packages/adapters/tinytroupe-py` | TinyTroupe wrapping | `contracts`, `providers/core-py`, `telemetry` | `openai`, `anthropic`, other engines, persistence |
| `packages/adapters/graphify-py` | Graphify wrapping | same | same |
| `packages/adapters/squad-ts` | Squad-OSS CLI wrapping | `contracts`, `providers/core-ts`, `telemetry` | direct provider SDKs |
| `packages/adapters/github-ts` | GitHub API wrapping | `contracts`, `security`, `telemetry` | direct provider SDKs |
| `packages/agents/*` | Prompts, role definitions, schemas of agent outputs | `contracts`, `providers/core-*` | Adapters, persistence |
| `packages/labs/*` | Lab business logic and state transitions | `contracts`, `providers`, `adapters`, `agents`, `telemetry` | persistence directly (uses orchestrator) |
| `packages/orchestrator` | State machine, jobs, artifact registry, gates | `contracts`, `persistence`, `labs`, `security`, `telemetry` | provider SDKs |
| `packages/persistence` | Postgres, S3, vector, Redis wrappers | `contracts`, `security`, `telemetry` | labs, adapters, apps |
| `packages/telemetry` | OTel, logger, redactor, cost meter | — | provider SDKs |
| `packages/security` | KMS envelope encryption, audit log, RLS helpers | `telemetry` | labs, adapters |
| `packages/eval` | Evaluation harness | `contracts`, `providers`, `persistence` (read-only) | mutate any artifact |
| `apps/api` | HTTP API, auth | `orchestrator`, `security`, `telemetry` | adapters, labs (calls orchestrator only) |
| `apps/worker-python` | Long-running Python job worker | `labs/persona-lab-py`, `labs/venture-lab-py`, `orchestrator` (client) | apps/api |
| `apps/worker-node` | Long-running Node job worker | `labs/build-squad-ts`, `orchestrator` (client) | apps/api |
| `apps/web` | UI | `contracts`, `ui` (via API only) | direct provider/persistence |
| `apps/cli` | Developer CLI | `apps/api` HTTP client, `contracts` | direct DB/provider |

Architectural rules are enforced by:

- **TypeScript:** `eslint-plugin-import` no-restricted-paths.
- **Python:** `import-linter` contract.
- **Both:** CI job `lint:arch` blocks merge on violation.

## 4. Polyglot conventions

- **Python**: `uv` for env + lockfile; `hatch` for builds; `pytest` + `ruff` + `mypy --strict`; Python 3.11 baseline.
- **TypeScript**: `pnpm` for installs; `turbo` for task orchestration; `tsup` for builds; `vitest` for tests; TS 5.x strict; Node 20 baseline.
- **Schemas**: source of truth in `packages/contracts/schema/*.json`. CI regenerates Python (`datamodel-code-generator`) and TS (`json-schema-to-typescript`) and fails if check-in is out of date.
- **OpenAPI**: the API exposes an OpenAPI doc generated from the contracts; clients regenerate from it.
- **Logging shape** is identical across languages: JSON lines with the same set of required keys (`ts`, `level`, `trace_id`, `tenant_id`, `lab`, `msg`).

## 5. Versioning strategy

- **Internal packages** are versioned together using `changesets` (TS) and a complementary `uv-bump` script (Python). M0–M2 use a single shared version per release.
- **External engine versions** are pinned exactly in the adapter package and surfaced in the artifact metadata (`engine: tinytroupe@0.7.0`).
- **Contract versions** follow semver; major bumps require an ADR and a migration plan.
- **API** has its own semver under `/v1`, `/v2`; `/v1` is the stable contract from M2.

## 6. Branching & releases

- `main` is always green and deployable to staging.
- Release branches per minor (`release/0.4`) for hot-fixes.
- PRs require: CI green, two reviewers for `packages/security/` and `packages/providers/`, one elsewhere.
- Conventional commits. Changesets generate release notes.
- Tags trigger CI to publish images and run staged deploys.

## 7. CI pipeline (sketch)

```
on PR:
  1. install (cached)
  2. lint  (ruff, eslint, prettier)
  3. lint:arch  (import-linter, no-restricted-paths)
  4. typecheck (mypy --strict, tsc --noEmit)
  5. unit tests (pytest, vitest)
  6. contracts sync check (regenerated types match committed)
  7. eval (intrinsic checks on golden brief subset; LLM-judge on changed prompts only)
  8. security scans (pip-audit, npm audit, gitleaks, trivy on Dockerfiles)
  9. integration tests (compose up; small E2E happy path with MockProvider)

nightly:
  - full E2E with ReplayProvider
  - upstream-version compatibility job: re-run adapter contract tests against newest TinyTroupe/Graphify/Squad-OSS releases
  - redactor fuzz
  - golden brief evaluation, publish dashboards
```

## 8. Why `apps/` and `packages/` are split this way

- `apps/` are *deployable units*; they assemble packages and own configuration.
- `packages/` are *libraries*; they have no main, no config files of their own (only what's needed for tests), and no environment dependencies.
- This split lets us deploy `apps/web` independently of `apps/api`, scale `apps/worker-python` independently of `apps/worker-node`, and never accidentally bundle an app's env into a library.

## 9. Why one `adapters/` package per engine (not a single mega-package)

- Each engine has different runtime requirements (Python AST parsers, Node ESM-only, etc.) and different release cadences.
- Per-package versioning lets us bump the TinyTroupe adapter without forcing a Squad-OSS release.
- It keeps the "only this package may import the engine" rule trivially enforceable.

## 10. `vendor/` is sacred

The `vendor/` directory is empty at M0. It exists so we know exactly where to put a vendored fork the day we need one. The decision to populate `vendor/<engine>/` is always an ADR.

When a fork lands:

- It must be in `vendor/<engine>/` (not in the engine's normal dependency slot).
- The adapter switches to importing from `vendor/`.
- The ADR explains the trigger, the patches we carry, and the criteria to un-fork.

## 11. Where examples live

- `examples/faceless-crm/` is the **reference scenario** as a runnable end-to-end script that uses MockProvider by default and a real provider with `--live`.
- Used in: demos, CI smoke tests, onboarding docs, and the M0 hackathon demo.

## 12. Open questions tracked as ADRs

- ADR-001: Monorepo tooling — Turbo vs Nx (recommend Turbo at M0; revisit at M2).
- ADR-002: Python workspace tooling — `uv` vs `hatch` vs `poetry` (recommend `uv` + `hatch`).
- ADR-003: Web framework — Next.js vs Remix (recommend Next.js).
- ADR-004: Job queue — Postgres-backed (Arq for Python, BullMQ for Node) at M0–M1; revisit at M2.
- ADR-005: Vector store — pgvector at M0–M2; benchmark at M2.
- ADR-006: BuildSquad polyglot — keep Node worker vs port to Python.
