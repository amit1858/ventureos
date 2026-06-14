# Hackathon Submission — VentureOS

> **Track:** Microsoft Build AI / HackerEarth — **Agent Swarms**
> **Project:** VentureOS — an AI-native multi-agent venture operating system
> **Repo:** https://github.com/amit1858/ventureos
> **Live app:** https://ventureos-dun.vercel.app
> **Primary judging path (zero-key):** https://ventureos-dun.vercel.app/demo/faceless-crm
>
> 📦 **Submission pack** (deck PDF, 3-min demo script, submission-form copy, screenshots): see **[`docs/hackathon/`](./hackathon/README.md)**.
> This document is the long-form write-up; the submission pack is the short-form, judge-facing version.

## Recommended judge path

Live app: <https://ventureos-dun.vercel.app/>

Direct demo: <https://ventureos-dun.vercel.app/demo/faceless-crm>

Use the zero-key demo first. Real Mode is optional for deeper testing
through Google sign-in / Alpha Workspace plus BYOK provider keys.

## Problem

Most product teams burn weeks (and engineering time) building things that should have been killed at the brief stage. The few tools that help are either:

- **Single-shot generators** ("write me a PRD") with no evidence and no provenance, or
- **Generic chatbots** that can talk about product strategy but can't actually pressure-test an idea.

Founders, product teams and venture studios need a way to **simulate the decision** they'd want to make — surface objections from real-looking buyers, map evidence into a structured graph, score the venture honestly, and only *then* produce build-ready artifacts.

## Solution

**VentureOS** is a multi-agent venture operating system that turns a single brief into a validated, build-ready venture in one pipeline:

```
Idea → PersonaLab → Buying Committee → Research Graph
     → VentureLab → BuildSquad → Evaluation → GitHub Export
```

Each step is run by a specialized agent (or agent group) and produces a versioned, typed artifact. The next step reads only those artifacts — there is no prompt-stuffing across labs.

The output is a **GitHub-ready repository** (14 files: README, VISION, PRD, ARCHITECTURE, ROADMAP, USER_STORIES, RISKS, EVALUATION_REPORT, DEMO_SCRIPT, .gitignore and docs for personas / research / validation / build-plan) with an `EVALUATION_REPORT.md` that names the model and provider behind every section.

## How it works (architecture)

Five planes:

1. **Experience** — Next.js workspace, Demo Mode, BYOK settings.
2. **Orchestration** — `VentureJob` runner, artifact registry, Venture state.
3. **Lab** — PersonaLab, Research Graph, VentureLab, BuildSquad, Evaluation.
4. **Provider** — OpenAI, Anthropic, Gemini, Azure OpenAI, GitHub. Isolated behind named adapter packages, enforced by `lint:arch`.
5. **Persistence** — Supabase, encrypted credential store.

See [`agent-swarms.md`](agent-swarms.md) and [`architecture-overview.md`](architecture-overview.md).

## The AI agents

| Agent group | What it does | Artifact |
|---|---|---|
| **Persona Agents** | Generate synthetic SMB owners, sales, finance, operators, customers. | `PersonaSet` |
| **Buying Committee Agents** | Multi-persona deliberation: positions, challenges, opinion changes, consensus. | `CommitteeTranscript` |
| **Research Graph Agents** | Typed graph of problems, customers, competitors, risks, contradictions, god-nodes. | `ResearchGraph` |
| **Venture Validation Agents** | Score the venture; produce Proceed / Pivot / Kill + confidence. | `VentureRecommendation` |
| **BuildSquad Agents** | PM, UX, Architecture, Engineering, QA, GTM agents producing the build plan. | `BuildSquadPack` |
| **Evaluation Agent** | Provenance-aware readiness report with coverage, risks, assumptions. | `EVALUATION_REPORT.md` |
| **GitHub Handoff Agent** | Repo creation, single-commit push, error classification. | `github_repo` |

Agents communicate **only** through typed artifacts in the shared Venture context. The buying committee is genuinely multi-agent — personas argue, change positions and converge.

## Microsoft relevance

- Built natively for **GitHub** as the execution target. Every venture ends as a real GitHub repo via the BYOK PAT path.
- Multi-provider by design including **Azure OpenAI** as a first-class provider in `packages/providers/azure-openai`.
- Built with **GitHub Copilot** as a pair-programmer throughout — the development trace itself demonstrates Copilot-assisted product engineering at hackathon pace.
- Submitted to the **Agent Swarms** track because the product *is* an agent swarm. The deliberation, evidence mapping, validation and planning are all done by distinct, specialized agents collaborating through shared context.

## Demo flow

We ship two paths:

### Demo Mode (zero keys)
- `/demo/faceless-crm` — a fully seeded venture taken end-to-end.
- Personas, buying-committee transcript, research graph, recommendation, BuildSquad pack, evaluation report, simulated GitHub export.
- **Reviewer can experience the full product in 60 seconds with no setup.**

### Real Mode (BYOK)
- `/settings/byok` — add an LLM credential and a GitHub PAT.
- `/ventures/new` — give it a brief.
- Workspace shows the full pipeline; each lab is one click.
- GitHub export creates a real repo under your account with a real commit SHA.

See [`demo-script.md`](demo-script.md) for 3 / 5 / 7-minute walkthroughs and fallback plans.

## Setup

```powershell
git clone https://github.com/amit1858/ventureos.git
cd ventureos
corepack pnpm install
corepack pnpm --filter "@ventureos/web" dev
# open http://localhost:3000/demo/faceless-crm   ← no setup needed
```

For Real Mode setup (Supabase + encryption key + BYOK), see [`setup-local.md`](setup-local.md).

## Repository

- **Source:** https://github.com/amit1858/ventureos
- **License:** TBD (research / hackathon project)
- **Built by:** Amit Pandey (`@amit1858`) with GitHub Copilot

## What's already shipped

- Demo Mode with seeded "Faceless CRM for SMB" venture
- Real Mode Venture Workspace (Overview / Personas / Research / Validation / Build Plan / Evaluation / Timeline / Artifacts)
- BYOK: OpenAI, Anthropic, Gemini, Azure OpenAI, GitHub PAT — all encrypted, validated, server-side
- VentureJob primitive with status, progress, provider · model · cost, structured failure blocks
- GitHub Export with preview modal, classified errors (`repo_exists`, `invalid_token`, `insufficient_scope`, `rate_limited`), short commit SHA in-app, secret-leakage tests
- Evaluation Report as a first-class, exportable, provenance-aware artifact
- Multi-agent branded homepage with pipeline table and architecture sections
- 14-file GitHub-ready scaffold via `renderRepoScaffold`
- `lint:arch` import-boundary checks; quality gates green

## Future roadmap

- Wire the scaffolded TinyTroupe Python adapter into the live runtime
- Wire the scaffolded Graphify Python adapter for research-graph construction
- External durable queue (Temporal / Sidekiq) for very long runs
- Streaming token-by-token UI for the Workspace
- Persona library and venture sharing links
- Multi-tenant admin
- Squad-OSS integration for richer planning critiques

## Known limitations

See [`known-limitations.md`](known-limitations.md). Brief summary:

- TinyTroupe and Graphify Python adapters are **scaffolded but not wired into runtime**. The canonical runtime is the TypeScript implementation. The TS work is real and produces real artifacts; we do not claim full Python parity.
- No external queue — `VentureJob` is durable but in-process.
- Single-tenant by default.
- No streaming UI for in-flight lab runs (jobs surface as polled status).
