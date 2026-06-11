# VentureOS — System Architecture

> Sprint −1 deliverable. Architectural intent and contracts. Not an implementation spec.

## 1. Architectural goals

1. **Loose coupling to external engines.** TinyTroupe, Graphify, and Squad-OSS are pre-1.0 projects. The architecture must let us swap, fork, or vendor any of them without rewriting labs.
2. **BYOK from day zero.** No subsystem ever imports a provider SDK directly.
3. **Typed artifacts between phases.** Every lab consumes and produces JSON Schemas. Free-form prompt chaining is forbidden at lab boundaries.
4. **Single-tenant by default, multi-tenant by design.** Tenant ID is a first-class column in every persistence layer and every audit event.
5. **Observability as code.** Every LLM call carries a `trace_id`, `tenant_id`, `lab`, `agent`, `artifact_id`. Cost and latency are queryable from day one.
6. **Async-first.** Long-running labs (a focus group can take 15 minutes) run as durable jobs, not request/response.

## 2. Logical view — five planes

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. EXPERIENCE PLANE                                                    │
│     Web app (Next.js) · CLI · API (REST/GraphQL) · Webhooks            │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│  2. ORCHESTRATION PLANE                                                 │
│     Venture state machine · Job runner · Artifact registry · Gates     │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│  3. LAB PLANE                                                           │
│     PersonaLab │ VentureLab │ BuildSquad                                │
│     Each lab = agents + tools + contracts + evaluators                  │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│  4. ADAPTER PLANE                                                       │
│     TinyTroupeAdapter · GraphifyAdapter · SquadAdapter · GitHubAdapter │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│  5. PLATFORM PLANE                                                      │
│     Provider Abstraction (BYOK) · Secrets/KMS · Persistence · Telemetry │
│     Cost Meter · Rate Limiter · Audit Log · Eval Harness                │
└─────────────────────────────────────────────────────────────────────────┘
```

The strict rule: **a layer may only call the layer immediately beneath it.** Labs never reach into provider SDKs; adapters never reach into the orchestration plane; the experience plane never reaches into adapters.

## 3. Core domain model

```ts
// packages/contracts/src/domain.ts (illustrative)

Venture {
  id: string
  tenant_id: string
  owner_id: string
  idea: IdeaBrief                  // raw input
  state: VentureState              // see §4
  artifacts: ArtifactRef[]         // immutable, append-only
  created_at, updated_at
}

Artifact {
  id: string
  venture_id: string
  kind: ArtifactKind               // 'research_graph' | 'persona_set' |
                                   // 'focus_group_transcript' | 'objection_map' |
                                   // 'opportunity_score' | 'risk_register' |
                                   // 'recommendation' | 'prd' | 'architecture' |
                                   // 'user_stories' | 'prototype_plan' | 'repo_link'
  schema_version: string
  payload: object                  // validated against the kind's JSON schema
  evidence: EvidenceRef[]          // back-pointers to graph nodes, transcripts, etc.
  quality_score: number            // 0..1 from the eval framework
  cost: CostBreakdown
  trace_id: string
  created_at
}

ProviderKey {
  id, tenant_id
  provider: 'openai' | 'azure_openai' | 'anthropic' | 'gemini' | ...
  encrypted_secret: bytes          // envelope-encrypted via KMS
  alias, scope, budget, created_at
}
```

Artifacts are **immutable**. A "revised PRD" is a new artifact with a `parent_id`, not an edit.

## 4. Venture state machine

```
DRAFT
  → RESEARCHING            (VentureLab builds research graph)
  → PERSONA_DESIGN         (PersonaLab generates personas)
  → SIMULATING             (PersonaLab runs interviews / focus groups)
  → VALIDATING             (VentureLab scores opportunity / risks)
  → DECISION_PENDING       (human gate: Proceed / Pivot / Kill)
    ├── KILLED             (terminal)
    ├── PIVOTED            (loops back to DRAFT with new IdeaBrief)
    └── PROCEEDING
          → PRD_DRAFTING       (BuildSquad)
          → ARCH_DRAFTING      (BuildSquad)
          → STORY_DRAFTING     (BuildSquad)
          → PROTOTYPE_PLANNING (BuildSquad)
          → REPO_PROVISIONING  (BuildSquad + GitHub adapter)
          → LIVE               (terminal — handed off to humans)
```

State transitions are the **only** way artifacts get produced. Each transition is recorded in the audit log with `actor` (user or agent), `from_state`, `to_state`, `artifact_ids`, `trace_id`.

## 5. Lab contracts (input/output schemas)

| Lab | Inputs | Outputs |
| --- | --- | --- |
| **VentureLab — Research** | `IdeaBrief`, optional `Corpus` (URLs/files) | `ResearchGraph` (Graphify-derived JSON; nodes, edges, communities, confidence) |
| **PersonaLab — Personas** | `IdeaBrief`, `ResearchGraph` | `PersonaSet` (TinyTroupe-style persona JSON, demographics, archetypes, sampling plan) |
| **PersonaLab — Simulation** | `PersonaSet`, `SimulationScript` (interview / focus group / buying committee) | `Transcript[]`, `ObjectionMap`, `FeedbackSynthesis` |
| **VentureLab — Validation** | `ResearchGraph`, `Transcript[]`, `ObjectionMap` | `OpportunityScore`, `RiskRegister`, `AssumptionTest[]`, `Recommendation` (Proceed/Pivot/Kill + rationale + cited evidence) |
| **BuildSquad** | `Recommendation` (Proceed only), `PersonaSet`, `ResearchGraph` | `PRD`, `ArchitectureDoc`, `UserStory[]`, `PrototypePlan`, `RepoLink` |

All inputs and outputs are JSON Schema'd in `packages/contracts/`. CI fails on schema drift.

## 6. Process / runtime view

```
┌───────────────────────────────────────────────────────────────┐
│ Web App  ──HTTPS──►  API Gateway  ──►  Orchestrator API      │
│                                          │                    │
│                                          ▼                    │
│                                   ┌──────────────┐            │
│                                   │ Job Queue    │            │
│                                   │ (durable)    │            │
│                                   └──────┬───────┘            │
│                                          │                    │
│   ┌──────────────────────────────────────┼──────────────┐    │
│   │                                      ▼              │    │
│   │  Lab Workers (horizontal scale)                     │    │
│   │   ┌──────────┐  ┌──────────┐  ┌─────────────┐      │    │
│   │   │PersonaLab│  │VentureLab│  │ BuildSquad  │      │    │
│   │   └────┬─────┘  └────┬─────┘  └──────┬──────┘      │    │
│   │        │             │               │              │    │
│   │        ▼             ▼               ▼              │    │
│   │   ┌─────────────────────────────────────────┐      │    │
│   │   │ Adapter Plane                           │      │    │
│   │   │  TinyTroupe · Graphify · Squad · GitHub │      │    │
│   │   └────────────────┬────────────────────────┘      │    │
│   │                    ▼                                │    │
│   │   ┌─────────────────────────────────────────┐      │    │
│   │   │ Platform Plane                          │      │    │
│   │   │  Provider Layer · KMS · Postgres · S3   │      │    │
│   │   │  Vector DB · Telemetry · Cost Meter     │      │    │
│   │   └─────────────────────────────────────────┘      │    │
│   └─────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

- **API Gateway** terminates TLS, enforces tenant auth.
- **Orchestrator** is a stateless API in front of a durable job queue (start with PostgreSQL-backed queue; graduate to a managed bus if scale demands).
- **Lab workers** are stateless Python processes (TinyTroupe and Graphify are Python; Squad-OSS is Node — see §10). Each worker pulls jobs, executes a lab transition, writes artifacts, emits telemetry.
- **Adapters** are libraries linked into workers, not separate services. Service split is premature.

## 7. Persistence

| Store | Purpose | Notes |
| --- | --- | --- |
| **Postgres** | Ventures, artifacts (metadata + small payloads), users, tenants, provider keys (encrypted), audit log, jobs | Single source of truth. Row-level tenant isolation. |
| **Object store (S3 / Azure Blob)** | Large artifact payloads (transcripts, full research graphs, generated PRDs), exported repos | Versioned bucket. Server-side encryption. Tenant-scoped key prefixes. |
| **Vector index** | Persona semantic memory, research graph embeddings, retrieval for RAG | Start with pgvector; graduate to a dedicated store if recall demands. |
| **Cache** | LLM response cache, idempotency cache | Redis. Tenant-scoped keys. |

**Artifacts < 256 KB live in Postgres JSONB. Larger payloads go to object store with a pointer in Postgres.**

## 8. Provider abstraction (summary — full design in [provider-abstraction.md](provider-abstraction.md))

Every LLM call goes through:

```ts
provider.chat({ model, messages, tools, temperature, tenant_id, trace_id, budget })
```

The platform resolves `model` → concrete provider via tenant configuration. No lab, adapter, or agent imports `openai`, `anthropic`, etc. directly. This is enforced by an architecture-test (an import-linter rule in CI).

## 9. Multi-tenancy and isolation

- **Tenant ID is required** on every request, every job, every artifact, every audit row.
- **Encryption keys are per-tenant** (envelope encryption: tenant DEK encrypted by a platform KEK in KMS).
- **Process isolation** is logical (row-level), not physical, at M1; physical isolation (separate worker pools) added at M3 for regulated customers.
- **No cross-tenant LLM cache reads.** Cache keys include `tenant_id`.

## 10. Polyglot reality

The three external engines are not all Python:

- **TinyTroupe** — Python 3.10+
- **Graphify** — Python 3.10+ (CLI + library, optional MCP stdio server)
- **Squad-OSS** — Node 20+ (TypeScript)

We do **not** rewrite them. The architecture accepts polyglot lab workers:

- PersonaLab and VentureLab workers run in **Python** (FastAPI + Celery/Arq).
- BuildSquad workers run in **Node** (Fastify + BullMQ) and shell out to the Squad-OSS CLI / SDK.
- A small Python ↔ Node contract is shared via JSON Schema → generated types on both sides (`packages/contracts/` with `datamodel-code-generator` for Python and `json-schema-to-typescript` for TS).

## 11. GitHub integration

- BYO personal GitHub token (encrypted, per-user, never per-tenant assumed).
- Token scopes requested: `repo`, `workflow`, `read:org` (optional).
- The `GitHubAdapter` exposes: `createRepo`, `pushScaffold`, `openPR`, `createIssue`, `createProject`.
- No enterprise GitHub credentials are ever assumed. Token presence is checked at the gate before `REPO_PROVISIONING` runs.

## 12. Observability

- **Tracing** — OpenTelemetry. Every API request and every LLM call is a span. Spans carry `tenant_id`, `venture_id`, `artifact_id`, `lab`, `provider`, `model`, `tokens_in`, `tokens_out`, `cost_usd`.
- **Metrics** — Prometheus. Per-tenant token usage, cost, lab throughput, gate hold times, error rates by provider.
- **Logs** — structured JSON, with strict PII/secret redaction (see [security.md](security.md)).
- **Eval dashboard** — quality scores per artifact kind, calibration of recommendations over time.

## 13. Failure model

| Failure | Strategy |
| --- | --- |
| Provider 429 / 5xx | Retry with exponential backoff; failover to next configured provider in tenant's provider chain. |
| TinyTroupe / Graphify / Squad-OSS crash | Adapter captures stderr, marks artifact as `FAILED`, raises a typed error, surfaces to the user with the trace ID. |
| Job worker dies mid-run | Durable queue redelivers; idempotency keys on artifact writes prevent duplicates. |
| Budget exceeded | Lab job aborts at the next provider call boundary, persists a partial artifact, marks venture as `BUDGET_HALTED`. |
| Schema drift between contract version and adapter output | Contract validation rejects the artifact; venture stays in current state; alert raised. |

## 14. What is explicitly out of scope for M0–M1

- Real-time collaboration on a venture (multi-cursor editing).
- Fine-tuning provider models.
- A persona marketplace.
- Mobile clients.
- On-prem deployment (cloud only through M2).

## 15. Open architectural questions

1. **Vector store choice at scale.** pgvector is sufficient for M1; benchmark at M2 against a dedicated store.
2. **Long-running simulation parallelism.** TinyTroupe is single-process. Do we shard across personas (parallel single-agent runs) and aggregate, or invest in a multi-process patch upstream?
3. **Squad-OSS reliance.** Squad-OSS is in alpha. Do we treat it as the build engine or as an *optional* accelerator with a hand-rolled fallback? Recommendation: hand-rolled fallback for M0, Squad-OSS adapter for M1+ behind a feature flag.
4. **Research graph backend.** Graphify uses in-memory NetworkX. For multi-user, multi-venture, we will need a persistent backend (Neo4j or pgvector + tables). Graphify's `--neo4j-push` is the cleanest path.

These are tracked as ADRs in `docs/adr/`.
