# VentureOS

> AI-native multi-agent venture operating system. **Turn raw ideas into validated, build-ready ventures with agent swarms.**

VentureOS orchestrates synthetic customers, buying committees, research graph agents, venture validation agents, BuildSquad planners and evaluation agents to help teams decide what to build — *before* they write code.

- 🎬 **Try the demo (zero keys):** [`/demo/faceless-crm`](apps/web/src/app/demo) — a fully seeded "Faceless CRM for SMB" venture taken from idea to GitHub-ready artifacts.
- 🛠️ **Run it on your own idea (BYOK):** Configure your own OpenAI / Anthropic / Gemini / Azure OpenAI key + a GitHub PAT, create a venture, and let the swarm produce a real evaluation and a real GitHub repo.

---

## Why this exists

Most "AI for product" tools generate documents. VentureOS instead **simulates the decision** you'd want to make before building:

- Synthetic SMB buyers, ops, finance leads and economic buyers form a buying committee and actually **deliberate** about your offer.
- Research is converted into a typed graph of problems, customers, competitors, risks and contradictions — not a wall of bullet points.
- A venture validation engine produces a **Proceed / Pivot / Kill** recommendation with an explicit confidence score and provenance.
- BuildSquad agents (PM, UX, architecture, engineering, QA, GTM) turn validated ventures into PRDs, roadmaps, user stories and a 14-file GitHub-ready repository.
- Every venture comes with an `EVALUATION_REPORT.md` that names the model and provider behind each artifact.

This is the architecture pattern people mean by **agent swarms**: many specialized agents collaborating through a shared Venture context and versioned artifacts, not a single chatbot.

---

## How it works

```
Idea Intake  →  PersonaLab  →  Buying Committee  →  Research Graph
            →  VentureLab   →  BuildSquad        →  Evaluation
            →  GitHub Export
```

Each step is a **VentureJob** that produces a typed, versioned artifact attached to the parent Venture. The next step reads only those artifacts — never raw prompts.

| Step | Agent role | Artifact | Signal |
|---|---|---|---|
| Idea Intake | Brief capture | Venture record | Scope captured |
| PersonaLab | Synthetic customer simulation | Persona set + interviews | Persona coverage |
| Buying Committee | Multi-persona deliberation | Committee transcript + consensus | Objections · opinion changes · confidence |
| Research Graph | Evidence mapping | Problem / customer / competitor graph | Contradictions and god-nodes |
| VentureLab | Venture decision engine | Proceed / Pivot / Kill recommendation | Confidence score |
| BuildSquad | Planning swarm (PM/UX/Arch/Eng/QA/GTM) | PRD · architecture · roadmap · stories | Build readiness |
| Evaluation | Quality & provenance agent | `EVALUATION_REPORT.md` | Readiness + risk coverage |
| GitHub Export | Execution handoff agent | GitHub repo (14 files) | Repo URL + short commit SHA |

See **[`docs/agent-swarms.md`](docs/agent-swarms.md)** for what each agent group does in detail, and **[`docs/architecture-overview.md`](docs/architecture-overview.md)** for the contracts and execution model.

---

## Demo Mode (no keys)

VentureOS ships a fully seeded **Demo Mode** so judges, reviewers and teammates can experience the full pipeline without any API keys, Supabase, GitHub PAT, or network calls to providers.

- **URL:** `/demo/faceless-crm`
- **Scenario:** "Faceless CRM for SMB" — opinionated SMB sales-ops product
- **What's seeded:** Venture, personas, buying-committee deliberation, research graph, VentureLab recommendation, BuildSquad pack, evaluation report, simulated GitHub export, timeline.
- **Banner:** Every demo page is labelled `Demo Mode — seeded data, no API keys used` so it can never be confused with Real Mode.

Demo Mode reuses the **same renderers** as Real Mode — what you see is what your Real-Mode venture would look like.

See **[`docs/demo-mode.md`](docs/demo-mode.md)** and **[`docs/demo-script.md`](docs/demo-script.md)** for guided walkthroughs (3 / 5 / 7 minute versions).

---

## Real Mode (BYOK)

Bring your own keys to run the swarm on your own idea.

1. `/settings/byok` — add an LLM credential (OpenAI · Anthropic · Gemini · Azure OpenAI) and a GitHub PAT.
2. `/ventures/new` — create a Venture from a brief.
3. From the Venture Workspace, run the labs in order: PersonaLab → Buying Committee → Research Graph → VentureLab → BuildSquad.
4. Generate the Evaluation Report.
5. **Preview** the GitHub export (no token required) and then push to a new repo on your account.

The Workspace Overview always shows:

- Readiness ring + per-dimension coverage
- Latest recommendation, confidence and active jobs
- Next-best-action with deep-links to the right lab
- GitHub export status with the short commit SHA and a "Copy URL" / "Open repo" pair
- Structured, actionable failure blocks when a job errors (e.g. `repo_exists`, `invalid_token`, `insufficient_scope`, `rate_limited`)

See **[`docs/security-byok.md`](docs/security-byok.md)** for the BYOK model and credential storage.

---

## Architecture (one paragraph)

VentureOS is a **TypeScript-first monorepo** (pnpm + turbo) with a strict five-plane layout — Experience, Orchestration, Lab, Provider, Persistence. Every lab is a pure package (`@ventureos/personalab`, `@ventureos/venturelab`, `@ventureos/buildsquad`, `@ventureos/research-graph`) that consumes and produces JSON contracts from `@ventureos/contracts`. Long-running work runs as a `VentureJob` so the UI always sees status / progress / provider · model · cost / elapsed / failure guidance. Provider SDKs (OpenAI, Anthropic, Gemini, Azure OpenAI, Octokit) live only in their named adapter packages, enforced by a custom `lint:arch` check.

VentureOS is **designed around real multi-agent and graph-based patterns**, including **TinyTroupe-style persona simulation** and **Graphify-inspired research graph workflows**. The TypeScript implementation is the canonical runtime; Python adapters are scaffolded for future deep integration but the TS path is what the live product uses today.

For the full architecture, see [`docs/architecture-overview.md`](docs/architecture-overview.md). For the internal Sprint −1 design doc, see [`docs/architecture.md`](docs/architecture.md).

---

## Quick start

Prerequisites:

- Node.js `>=20` (project tested on Node 24)
- pnpm `>=9` (via `corepack enable`)

```powershell
corepack pnpm install
corepack pnpm --filter "@ventureos/web" dev
```

Web app runs at `http://localhost:3000` (or `3100` if 3000 is busy).

You can hit `/demo/faceless-crm` immediately with no other setup — Demo Mode requires no environment variables.

For Real Mode setup (Supabase, encryption key, BYOK), see **[`docs/setup-local.md`](docs/setup-local.md)**.

---

## Quality gates

```powershell
corepack pnpm run lint
corepack pnpm run lint:arch
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run build
```

Or run them all:

```powershell
corepack pnpm run ci
```

Current state on `main`:

- ✅ `lint`
- ✅ `lint:arch` (no provider-SDK or cross-boundary violations)
- ✅ `typecheck` — all packages
- ✅ `test` — web + buildsquad + contracts + adapters
- ✅ `build` — all 16 packages including the Next.js app

---

## AI tools and integrations

- **Multi-provider LLM routing** through adapter packages in `packages/providers/*` (OpenAI · Anthropic · Gemini · Azure OpenAI). All BYOK.
- **TinyTroupe-style persona simulation.** PersonaLab generates and runs a buying committee that deliberates and changes positions; a Python TinyTroupe adapter is scaffolded in `packages/adapters/tinytroupe-py/` for future runtime integration.
- **Graphify-inspired research graph workflows.** `@ventureos/research-graph` produces typed graphs of problems, segments, competitors and risks with contradictions and god-nodes surfaced; Graphify adapters are scaffolded in `packages/adapters/graphify-*/` for future runtime integration.
- **BuildSquad planning swarm** in `packages/buildsquad` — PM, UX, architecture, engineering, QA, GTM agents producing a 14-file GitHub-ready scaffold via the deterministic `renderRepoScaffold`.
- **GitHub export** via `packages/adapters/github-ts/` (Octokit, isolated by the `lint:arch` check).

> **Naming note:** the canonical runtime today is TypeScript. We do not claim full Python TinyTroupe / Graphify parity at runtime — the adapters exist as integration seams for the deferred Python path.

---

## Security & public-repo safety

- BYOK secrets are server-side only and never exposed to the browser.
- Secrets are encrypted at rest with `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY` and surfaced in UI only as masked values.
- GitHub exports never include `.env`, tokens, or credentials. There is a dedicated test asserting no `ghp_…` shapes ever appear in exported file contents.
- `.env*` is git-ignored. No environment files, API keys, Supabase keys, GitHub PATs or runtime logs are committed.
- Import boundaries (`lint:arch`) prevent app and lab code from importing provider SDKs directly.

See **[`docs/security-byok.md`](docs/security-byok.md)** and **[`docs/security.md`](docs/security.md)**.

---

## Documentation

Public-facing:

- [Agent Swarms](docs/agent-swarms.md) — the multi-agent design
- [Architecture overview](docs/architecture-overview.md)
- [BYOK & security](docs/security-byok.md)
- [Demo Mode](docs/demo-mode.md)
- [Demo script (3 / 5 / 7 min)](docs/demo-script.md)
- [Deployment](docs/deployment.md)
- [Hackathon submission](docs/hackathon-submission.md)
- [Local setup](docs/setup-local.md)
- [Known limitations](docs/known-limitations.md)
- [E2E test plan](docs/e2e-test-plan.md)

Internal design docs (kept for context):

- [Vision](docs/vision.md) · [Product roadmap](docs/product-roadmap.md) · [Repository structure](docs/repository-structure.md)
- [Original Sprint −1 architecture](docs/architecture.md) · [Provider abstraction](docs/provider-abstraction.md)
- [Faceless CRM reference scenario](docs/faceless-crm-reference-scenario.md) · [Evaluation framework](docs/evaluation-framework.md)
- [Adapter strategy](docs/adapter-strategy.md)

---

## Hackathon submission

VentureOS is being submitted to the **Microsoft Build AI — Agent Swarms** track. See [`docs/hackathon-submission.md`](docs/hackathon-submission.md) for the full submission write-up.

---

## Team

- Built by **Amit Pandey** (`@amit1858`), with GitHub Copilot as a pair-programming partner.

---

## License

This is a research / hackathon project. License TBD. Do not redistribute production credentials or seeded customer data without permission.
