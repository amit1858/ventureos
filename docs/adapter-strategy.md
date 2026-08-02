# Foundry — Adapter Strategy

> Sprint −1 deliverable. The contract between Foundry and any external engine.

## 1. Why adapters

External engines (TinyTroupe, Graphify, Squad-OSS) are:

- Pre-1.0.
- Single- or small-maintainer.
- Built with assumptions that don't match ours (single-tenant, OpenAI-default, in-process state).

We must not let their evolution dictate ours. An **adapter** is a stable internal contract that lets us swap, vendor, patch, or fall back to a hand-rolled implementation behind it.

## 2. Adapter principles

1. **One adapter package per engine.** `packages/adapters/tinytroupe/`, `packages/adapters/graphify/`, `packages/adapters/squad/`, `packages/adapters/github/`.
2. **The adapter is the only code allowed to import the engine.** Enforced by an architecture-test (import-linter) in CI.
3. **Inputs and outputs are typed Foundry contracts**, not engine-native types.
4. **The adapter owns translation** between our schema and the engine's schema.
5. **The adapter never accesses provider SDKs.** It receives a `ProviderClient` from the lab and a `BudgetGuard`.
6. **The adapter is sandbox-aware.** It receives a workdir, never touches `$HOME` or shared state.
7. **The adapter is stateless across calls.** Per-call construction; no module-level mutable state.
8. **Every adapter has a hand-rolled fallback or a clear "no fallback — flag-gated" decision recorded as an ADR.**

## 3. Adapter responsibilities

| Responsibility | Owner |
| --- | --- |
| Schema translation (ours ↔ theirs) | Adapter |
| Provider injection | Adapter |
| Budget enforcement passthrough | Adapter |
| Sandbox / workdir management | Adapter |
| Subprocess spawn + lifecycle | Adapter |
| stdout/stderr capture + structured logging | Adapter |
| Error normalisation to typed Foundry errors | Adapter |
| Retry + backoff for transient engine errors | Adapter |
| Telemetry span emission | Adapter |
| Output validation against our JSON schemas | Adapter |
| Version-pinning + compatibility check | Adapter |
| Persona / graph / repo persistence | **Lab** (not the adapter) |
| Audit log writes | **Orchestrator** (not the adapter) |
| User auth / tenant resolution | **API / Orchestrator** (not the adapter) |

## 4. Standard adapter interface (conceptual)

Every adapter implements roughly:

```ts
interface Adapter<Input, Output> {
  readonly engineName: string;
  readonly engineVersion: string;          // pinned upstream version
  readonly contractVersion: string;        // our adapter contract version

  init(ctx: AdapterContext): Promise<void>; // workdir, provider, budget, tenant
  invoke(input: Input): Promise<Output>;    // single typed call
  health(): Promise<HealthStatus>;          // probe upstream availability
  dispose(): Promise<void>;                 // tear down workdir, kill subprocesses
}

interface AdapterContext {
  tenantId: string;
  ventureId: string;
  traceId: string;
  workdir: string;          // ephemeral, per-call
  provider: ProviderClient; // BYOK provider abstraction
  budget: BudgetGuard;
  logger: StructuredLogger;
  telemetry: SpanFactory;
  redactor: Redactor;       // applied to all logged strings
}
```

A Python equivalent exists for the TinyTroupe and Graphify adapters (Python labs). Contract schemas live in `packages/contracts/` and generate language-specific types for both worlds.

## 5. Per-engine summary

### 5.1 TinyTroupeAdapter (Python)

- **Maps to**: PersonaLab persona generation, focus groups, interviews, buying committee.
- **Inputs**: `IdeaBrief`, `Demography?`, `PersonaSet?`, `SimulationScript`.
- **Outputs**: `PersonaSet`, `Transcript[]`, `FocusGroupResult`, `BuyingCommitteeResult`, `ValidationScore`.
- **Process model**: in-process Python (subprocess per venture worker, not per call).
- **Provider injection**: monkeypatch (M0) → upstream PR for injection hook (M1+).
- **Fallback**: minimal hand-rolled persona simulator built on the provider layer, for unit tests and when TinyTroupe is unavailable. Not feature-equivalent.
- **Bridge (Sprint 1D)**: the TypeScript host (`apps/web/src/lib/tinytroupe-bridge.ts`) spawns the `python -m foundry_tinytroupe.cli` subprocess only when:
  1. `VENTUREOS_TINYTROUPE_PYTHON` is set in the host environment, AND
  2. the request carries `engine: 'tinytroupe'`, AND
  3. the action is one of `generatePersonas | runInterview | runFocusGroup | runBuyingCommittee` (`extractInsights` and `validatePersonaSet` always stay in-process).

  The decrypted BYOK secret is passed to the subprocess **only** through the curated env map (`OPENAI_API_KEY` or `AZURE_OPENAI_API_KEY`). It is never:
  - placed on argv,
  - serialised into the stdin JSON payload,
  - copied into any log line, span attribute, or returned to the browser.

  The subprocess inherits `PATH` and `PYTHONUNBUFFERED=1` and nothing else (no Supabase keys, no encryption keys, no other BYOK secrets in process memory). A 60-second wall-clock cap kills runaway processes. The stdout/stderr capture passes through `sanitize()` to strip any leaked secret pattern before being surfaced as an error.
- **Failure modes & strategy**:
  - LLM 429 / 5xx → provider-layer retry + failover; adapter surfaces only terminal failures.
  - TinyTroupe internal exception → caught, normalised to `AdapterEngineError`, traced.
  - Episode loop / runaway → budget guard aborts at next provider call boundary.
  - Validator score below threshold → adapter returns the artifact but marks `quality_score`; orchestrator decides whether to retry.

### 5.2 GraphifyAdapter (Python)

- **Maps to**: VentureLab research-graph build, queries, path/explain/affected analyses.
- **Inputs**: `IdeaBrief`, `seed_urls`, `mode ∈ {quick, deep}`, optional `update` on an existing graph.
- **Outputs**: `ResearchGraph` (with nodes, edges, communities, confidence), `QueryResult`, `Path?`, `Node[]`.
- **Process model**: in-process Python; per-call workdir destroyed after upload.
- **Provider injection**: replace `graphify.llm` dispatch with our `ProviderClient` shim.
- **Fallback**: simple retrieval-only research summariser (LLM + URL fetch) producing a degraded `ResearchGraph` with `confidence='AMBIGUOUS'` on every edge. Used only if Graphify can't load.
- **Failure modes & strategy**:
  - URL fetch failure → adapter retries with backoff; logs the URL; continues with remaining sources.
  - Tree-sitter / native parse crash → caught; the offending file is skipped, recorded in the artifact metadata.
  - LLM extraction failure on a chunk → that chunk is retried once, then skipped with a logged warning.
  - Graph exceeds size cap → adapter aborts and returns a typed `GraphTooLargeError` with current size; orchestrator escalates.

### 5.3 SquadAdapter (Node, subprocess to `squad` CLI)

- **Maps to**: BuildSquad — PRD, architecture, ADRs, user stories, prototype plan, repo provisioning.
- **Inputs**: `Recommendation` (Proceed), `PersonaSet`, `ResearchGraph` (subset).
- **Outputs**: `PRDArtifact`, `ArchitectureArtifact`, `UserStoryArtifact[]`, `PrototypePlanArtifact`, `RepoLinkArtifact`.
- **Process model**: per-job sandboxed temp directory; CLI subprocess; torn down after artifact upload.
- **Provider integration**: open decision (see [dependency-analysis-squad.md](dependency-analysis-squad.md) §8). M0 uses the **hand-rolled** implementation behind the same `SquadAdapter` interface — Squad-OSS is not on the M0 critical path.
- **Fallback**: `HandRolledBuildSquadAdapter` is the **default** through M1 and remains as fallback through M3. Same interface.
- **Failure modes & strategy**:
  - Subprocess timeout (wall clock > N min) → kill, capture partial output, mark artifact `PARTIAL`.
  - Sandbox escape attempt detected → kill immediately, raise security alert.
  - GitHub API error during repo provisioning → retry with backoff; if 4xx, surface to user (likely a token-scope problem).
  - Squad-OSS internal crash → fall back to `HandRolledBuildSquadAdapter` if feature flag allows.

### 5.4 GitHubAdapter

- **Maps to**: repo creation, push, PRs, issues, project boards.
- **Inputs**: encrypted user GitHub token, scaffold tarball, repo metadata.
- **Outputs**: `RepoLinkArtifact` (URL, default branch, initial issues created).
- **Implementation**: `octokit/rest` (Node) or `PyGithub` (Python) — wrapped so subsystems never import the SDK directly.
- **Failure modes**: 401/403 → user-actionable (token scope); 5xx → retry; rate limit → respect Retry-After.

## 6. Data contracts (where they live)

- `packages/contracts/schema/` — JSON Schema source of truth for every adapter input and output.
- `packages/contracts/python/` — generated Pydantic models (via `datamodel-code-generator`).
- `packages/contracts/ts/` — generated TypeScript types (via `json-schema-to-typescript`).
- CI fails if `python/` or `ts/` are out of sync with `schema/`.
- Every adapter call validates input and output against the schema; validation failure is a typed `AdapterContractError`.

## 7. Versioning

- **Engine version** is pinned exactly (e.g., `tinytroupe==0.7.0`, `graphifyy==0.8.25`, `@bradygaster/squad-cli@0.9.4`).
- **Contract version** (`packages/contracts/`) follows semver; major bumps require a migration ADR.
- **Adapter version** declares which `(engineVersion, contractVersion)` pair it supports.
- A nightly **compatibility CI job** runs each adapter's contract tests against the latest upstream release; failure files an issue but does not auto-bump.

## 8. Failure handling matrix

| Class of failure | Detection | Handler | User visibility |
| --- | --- | --- | --- |
| Provider 4xx (auth) | Provider layer | Surface immediately; do not retry | User-actionable error toast |
| Provider 429 / 5xx | Provider layer | Exponential backoff + failover to next provider in chain | Silent unless persistent |
| Engine subprocess crash | Adapter stderr / non-zero exit | Capture, retry once, then mark artifact `FAILED` | Surface with trace ID |
| Engine contract violation (output fails schema) | Adapter output validator | No retry; mark `FAILED` with diff | Surface; likely engine bug |
| Budget exceeded | Provider layer / BudgetGuard | Abort at next call boundary, persist partial artifact | Surface with cost summary |
| Timeout (wall clock) | Adapter watchdog | Kill subprocess, mark `PARTIAL` | Surface; offer extend |
| Sandbox violation | OS / hook | Kill, security alert, suspend tenant pending review | Surface as security incident |
| Network egress denied | Egress proxy | Adapter sees connection refused; skip the resource | Logged warning |

## 9. Retry strategy (defaults)

- Transient: exponential backoff, `base=500ms`, `factor=2`, `max=30s`, `attempts=5`, jittered.
- Idempotency keys on artifact writes (deterministic from `venture_id + step + input_hash`); duplicate writes are no-ops.
- Adapters expose their own retries only for engine-internal transient failures (e.g., a flaky tree-sitter parse on a large file).
- The orchestrator's job runner retries the **whole step** at most once on adapter `RetryableError`.

## 10. Testing requirements (every adapter)

1. **Contract tests** — sample inputs → expected output shape (schema), run against the real pinned engine version.
2. **Provider injection test** — assert no direct provider SDK import is reachable from the adapter via import-linter.
3. **Sandbox test** — adapter cannot write outside its workdir; cannot read `/etc/passwd`-equivalents; cannot reach the platform's database.
4. **Budget test** — a forced over-budget run aborts at the right point and leaves a valid partial artifact.
5. **Telemetry test** — every invoke emits an OTel span with the required attributes.
6. **Redaction test** — fuzzed inputs containing secret-like strings never appear in logs.
7. **Upgrade test** — adapter is run against the latest upstream release nightly; failures file issues.

## 11. Observability per adapter

Every `invoke()` emits a span with attributes:

```
adapter.name           = "tinytroupe" | "graphify" | "squad" | "github"
adapter.contract       = "1.2.0"
adapter.engine.version = "0.7.0"
tenant.id              = "..."
venture.id             = "..."
artifact.id            = "..."
duration_ms            = ...
tokens.in / tokens.out = ...
cost.usd               = ...
outcome                = "ok" | "retried" | "failed" | "partial"
```

## 12. Anti-patterns we explicitly forbid

- ❌ Importing `tinytroupe`, `graphify`, `@bradygaster/squad-sdk` from any package other than the corresponding adapter.
- ❌ Returning engine-native objects across the adapter boundary.
- ❌ Reading provider keys from environment inside the adapter.
- ❌ Long-lived adapter instances holding open sockets, file handles, or subprocesses across requests.
- ❌ Adapter writes to Postgres directly. Adapters return artifacts; the orchestrator persists them.
- ❌ Silent fallback to hand-rolled implementations. Fallback **always** records the reason in the artifact metadata and audit log.
