# Dependency Analysis — Squad-OSS (Brady Gaster's `squad`)

> Source: https://github.com/bradygaster/squad · License: MIT · Latest analysed: v0.9.4 (alpha) · Language: TypeScript / Node ≥ 20 · npm: `@bradygaster/squad-cli`, `@bradygaster/squad-sdk`

> **Naming note.** Brady Gaster's project is named `squad`. The third Foundry module is also conceptually a "squad." To prevent permanent collision across packages, prompts, dashboards, and docs, the Foundry module is renamed **BuildSquad** throughout the platform. The dependency is referred to as **Squad-OSS** here and elsewhere.

## 1. Purpose

Squad-OSS is a **human-directed, specialist-agent orchestration framework** built around GitHub Copilot CLI / VS Code agent. It provides:

- Deterministic, rules-based routing of work to named specialist agents (not LLM-guessed dispatch).
- Persistent team state in `.squad/` (committed to git): each agent has a charter and a history of what it has learned about your codebase.
- A coordinator that fans out tasks to multiple agents in parallel.
- Pre/post tool-call hooks for governance (file guards, secret redaction, shell allowlists, reviewer lockouts).
- Platform adapters for GitHub and Azure DevOps (PR creation, issue triage, work items).
- A "Ralph" watch mode that polls repos for labelled issues and auto-dispatches.

For Foundry, Squad-OSS is the **execution engine** behind BuildSquad — turning a validated venture into PRD → architecture → user stories → prototype → real GitHub repo.

## 2. Core concepts

| Concept | Detail |
| --- | --- |
| **Agent** | Markdown charter + identity + preferred model + tool list + history. Discoverable from local `.squad/agents/`, a remote GitHub repo, or a marketplace. |
| **Team manifest** | `team.md` lists roster; `routing.md` lists pattern → agent rules. |
| **Casting engine** | Assigns persistent named personas from themed universes (Matrix, Firefly, etc.) for continuity. |
| **Coordinator** | Matches tasks to agents deterministically, spawns parallel sessions, aggregates results. |
| **Response tiers** | `direct` (<2s), `lightweight` (<10s), `standard` (<5m), `full` (unbounded). |
| **Hooks** | Pre-tool (block/modify/allow) and post-tool (redact/scrub). Built-in: file guards, shell allowlist, rate limits. |
| **Skills** | Markdown knowledge packets (`SKILL.md`) agents reference dynamically. |
| **Platform adapter** | GitHub or Azure DevOps (or hybrid); abstracts file ops, PRs, issues, auth. |
| **Watch mode (Ralph)** | Long-running issue-triage poller with circuit breaker on rate limits. |

## 3. Internal architecture

- **Runtime**: Node 20+, ESM-only, TypeScript strict.
- **Packages**: `@bradygaster/squad-sdk` (library) + `@bradygaster/squad-cli` (binary).
- **LLM access**: routes through GitHub Copilot CLI as the agent host; the Copilot SDK abstracts the actual model call. Five-layer model resolution: runtime override → charter preference → task-aware tier selection → config default → fallback (Claude Haiku).
- **Storage**: pluggable; default `FSStorageProvider`, optional Azure Blob; state files in `.squad/` (charters, histories, decisions, ceremonies, casting registry, skills, identity).
- **Tooling**: `ToolRegistry` + `defineTool()` for custom tools; `HookPipeline` for governance.
- **Observability**: OpenTelemetry baked in; Aspire dashboard integration.
- **MCP**: supports MCP servers (GitHub, Trello, Azure, etc.) via `.copilot/mcp-config.json`.

## 4. APIs

**CLI** (selection):
`squad init`, `squad upgrade`, `squad status`, `squad doctor`, `squad watch [--execute]`, `squad triage`, `squad copilot`, `squad link <path>`, `squad externalize` / `internalize`, `squad export` / `import`, `squad plugin marketplace ...`, `squad upstream ...`, `squad nap`.

Invocation: `copilot --agent squad --yolo` (CLI) or selecting "Squad" in VS Code Copilot Chat.

**SDK (programmatic)**:

```ts
import {
  defineSquad, defineTeam, defineAgent, defineRouting,
  loadConfig, onboardAgent, CharterCompiler,
  CastingEngine, selectResponseTier, getTier,
  ToolRegistry, defineTool,
  HookPipeline, defineHooks,
  SessionPool, SquadClient
} from '@bradygaster/squad-sdk';

const pool   = new SessionPool('.squad', { storage });
const client = new SquadClient('.squad');
const result = await client.dispatch({ task: 'Build login page', agents: ['trinity'] });
```

`SessionPool.spawn(agentName, ctx)` is the lowest-level handle: returns a session that emits `message` events and can be awaited via `complete()`.

## 5. Extension points

- Custom agents (TypeScript `defineAgent()` or markdown charter).
- Custom tools (`defineTool()` + `ToolRegistry`).
- Pre/post-tool hooks (`HookPipeline`, `defineHooks()`).
- Storage providers (implement `StorageProvider`; samples include Azure Blob).
- Platform adapters (interfaces exist; new platforms are non-trivial).
- Skills (`SKILL.md` knowledge files).
- Agent marketplaces (pull rosters from remote GitHub repos).
- MCP servers (any compliant server).

## 6. Limitations & risks

| Concern | Detail | Impact on Foundry |
| --- | --- | --- |
| **Alpha status (v0.9.x)** | README explicitly flags experimental APIs and CLI changes. | Hand-rolled BuildSquad fallback is required; Squad-OSS adoption is feature-flagged. |
| **Tight coupling to GitHub Copilot CLI** | Model access is routed through Copilot, not arbitrary providers. | Conflicts with our BYOK mandate. Either we use Copilot-as-provider (one of our supported providers), wrap Squad-OSS so that *only* its file/PR/orchestration capabilities are used and we substitute our own session runtime, or accept a per-tenant Copilot dependency for the BuildSquad lab only. **Recommendation: option 2 + feature-flag.** |
| **Node/TypeScript** | Foundry PersonaLab and VentureLab are Python. | Polyglot worker pool: Node workers for BuildSquad; shared JSON-schema contracts. |
| **No vault integration** | Secrets via environment only. | We never put decrypted user secrets in subprocess env. Use temp file with `chmod 600` or stdin pipe; sandbox the subprocess. |
| **Subprocess writes files in cwd** | Agents edit files in working tree. | Per-job ephemeral chroot/temp directory; output extracted, then directory torn down. |
| **Watch mode is long-running** | Ralph polls repos. | We do **not** run Ralph in our platform. We invoke Squad-OSS as a one-shot per-venture build. |
| **Single primary maintainer** | Brady Gaster + 40 contributors. | Bus factor; pin version; vendor option. |
| **API instability (SDK)** | Pre-1.0; releases frequent. | Wrap behind a minimal adapter surface; contract tests on every bump. |
| **Charter / state lives in git** | Designed to commit `.squad/` to the user's repo. | Fits our model (we generate the repo) but we must initialise `.squad/` cleanly per venture and never share it across tenants. |

## 7. License & maintenance

- **MIT**.
- Brady Gaster (Microsoft) + ~40 contributors; active commits.
- Last release v0.9.4 (April 2026). Documented changelog. Independent versioning per package via changesets.

## 8. Recommended Foundry integration strategy

**Role:** BuildSquad lab — generate PRD, architecture doc, ADRs, user stories, prototype scaffold; create a GitHub repository populated with all of the above; open initial issues; set up project board.

**Phasing:**

- **M0 (hackathon):** **Do not use Squad-OSS.** Hand-rolled BuildSquad agents that call the provider layer directly. This avoids Node-in-the-stack on day one and avoids alpha-API risk during the demo.
- **M1:** Squad-OSS adapter behind a feature flag, off by default. Internal dogfooding only.
- **M2:** Squad-OSS adapter on by default for BuildSquad; hand-rolled remains as fallback.
- **M3:** Hand-rolled fallback retained but only invoked on Squad-OSS failure or feature-flag override.

**Integration shape (M1+):**

1. **CLI subprocess, not in-process embedding.** A Node worker shells out to `squad` CLI commands in a per-job sandboxed directory. We do not link `@bradygaster/squad-sdk` into a long-running shared process (alpha + ESM + global state risk).
2. **Per-job ephemeral `.squad/`.** The worker initialises a fresh `.squad/` from a Foundry template before each build; the directory is destroyed after the artifacts are uploaded.
3. **Provider injection via adapter shim.** Because Squad-OSS routes model calls through Copilot, we have three options:
   - (a) Treat **GitHub Copilot itself as one of our BYOK providers** for the BuildSquad lab (the user supplies a Copilot-eligible GitHub token).
   - (b) Add a small Squad-OSS SDK extension that lets us substitute a custom session runtime that calls our provider layer. (Upstream contribution.)
   - (c) Bypass Squad-OSS's runtime entirely and use it only for its **state model, routing, hooks, charters, and GitHub adapter**, plugging in our own session execution.
   We carry **(a)** and **(c)** as parallel paths through M1; pick the winner at M2 based on what landed upstream.
4. **GitHub integration goes through Squad-OSS's platform adapter** (it already handles PRs, issues, project boards). User's BYO GitHub token is passed via a per-call temp file, not env.
5. **Hooks enforce Foundry governance.** We register a pre-tool hook that blocks `.env`, blocks shell commands outside an allowlist, and blocks network egress to non-allowlisted hosts.
6. **Telemetry bridge.** Squad-OSS emits OTel; we plumb it into our central collector with `tenant_id`, `venture_id`, `artifact_id` labels.
7. **Templated charters per role.** BuildSquad ships a fixed roster: `architect`, `pm`, `frontend`, `backend`, `qa`. Each has a templated charter parameterised by the venture's PRD / recommendation artifacts.
8. **Output extraction.** When the build run completes, the adapter scrapes the per-job directory for: `PRD.md`, `ARCHITECTURE.md`, `adr/*.md`, `stories/*.md`, `scaffold/`. These are uploaded as artifacts and the directory is deleted.

**Concrete adapter surface (sketch):**

```ts
// packages/adapters/squad/src/index.ts
export class SquadAdapter {
  constructor(opts: {
    provider: ProviderClient,
    budget: BudgetGuard,
    tenantId: string,
    githubToken: EncryptedToken,
    workdir: string,
  });

  async draftPRD(input: BuildInput): Promise<PRDArtifact>;
  async draftArchitecture(input: BuildInput, prd: PRDArtifact): Promise<ArchitectureArtifact>;
  async draftUserStories(prd: PRDArtifact, arch: ArchitectureArtifact): Promise<UserStoryArtifact[]>;
  async planPrototype(prd: PRDArtifact, arch: ArchitectureArtifact): Promise<PrototypePlanArtifact>;
  async provisionRepo(plan: PrototypePlanArtifact, owner: string, name: string): Promise<RepoLinkArtifact>;
}
```

A symmetric `HandRolledBuildSquadAdapter` exposes the same surface. The lab depends on the interface, not on the implementation. Feature flag selects implementation per tenant.

**What we will NOT use from Squad-OSS:**

- Watch mode / Ralph (we are not a polling service).
- Casting engine themed-universe naming (cute, but adds variance to artifact metadata; we use deterministic role names).
- Squad-OSS's plugin marketplace (we maintain our own roster).
- Azure DevOps adapter (M0–M2 GitHub only; ADR if a tenant requests).

**Fork-and-vendor triggers:**

- A breaking SDK change without migration path lands.
- Upstream stalls for 60+ days with bugs we can't work around.
- Required hooks API to satisfy our governance is rejected.

## 9. Risks specific to Foundry embedding (ranked)

1. **Provider-routing mismatch.** Squad-OSS's Copilot-centric model resolution conflicts with our BYOK mandate. **This is the integration decision.** Mitigation: keep paths (a) and (c) above alive through M1; choose at M2.
2. **Alpha API churn.** Wrap behind adapter; contract tests; pinned versions; CLI-not-SDK for safety.
3. **Subprocess governance.** Squad-OSS agents edit files. Strict sandboxing + hooks are non-negotiable.
4. **Polyglot operational overhead.** Adds Node to a Python-dominant stack. Mitigation: small Node footprint (workers only), shared JSON-schema contracts, shared OTel.
5. **GitHub token blast radius.** Adapter must never echo the token; per-call temp file with strict perms; rotate on each use if scope allows.
6. **Single primary maintainer.** Vendor-fork plan documented.

## 10. Decision summary

- **Adopt** Squad-OSS as BuildSquad's execution engine **from M1, behind a feature flag, default off until M2**.
- **M0** uses hand-rolled BuildSquad.
- **Subprocess CLI** integration, not SDK embed.
- **Per-job sandbox** with our hooks enforcing governance.
- **Provider integration** is the open decision; carry parallel options through M1.
- **Pin** exact version; contract tests; vendor slot ready.
- **Rename** the Foundry module to **BuildSquad** to avoid permanent namespace collision.
