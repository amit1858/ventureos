# Agent Swarms in VentureOS

VentureOS is built as a **multi-agent venture operating system**. It is not a single chatbot — it is a coordinated set of specialized agents that share a Venture context and produce versioned artifacts.

This document explains the agent groups, what each one does, and how they hand off.

## TL;DR

```
Agent Swarm
   → Shared Venture Context
   → Versioned Artifacts (typed contracts)
   → GitHub-ready Output
```

Every agent group writes a typed artifact attached to the parent `Venture`. The next agent group reads only those artifacts. There is no free-form prompt chaining at lab boundaries.

## The six agent groups

### 1. Persona Agents — `PersonaLab`
- Generate synthetic SMB owners, sales reps, finance leads, operators and customers from the venture brief and target market.
- Each persona has goals, constraints, decision-making style, jobs-to-be-done and objections.
- Produces a `PersonaSet` artifact plus simulated interviews and focus-group transcripts.
- **Naming:** TinyTroupe-style persona simulation; a Python TinyTroupe adapter is scaffolded for future runtime integration. Canonical runtime today is the TypeScript implementation in `packages/personalab`.

### 2. Buying Committee Agents — `PersonaLab → Committee`
- Multiple personas deliberate, challenge one another, change positions and converge on a decision (`support`, `pilot`, `defer`, or `reject`).
- Produces a `CommitteeTranscript` artifact with initial positions, challenge/response turns, opinion changes, final consensus and "why pilot not buy" rationale.
- Signal: objection density, opinion-change rate and decision confidence.

### 3. Research Graph Agents — `@ventureos/research-graph`
- Convert research inputs (links, notes, summaries, the venture brief) into a typed graph of problems, customers, competitors, risks, assumptions, contradictions and opportunities.
- Surfaces **god-nodes** (highest centrality) and **contradictions** (mutually inconsistent evidence) explicitly so they get reviewed.
- Produces a `ResearchGraph` artifact.
- **Naming:** Graphify-inspired workflows; Graphify adapters are scaffolded in `packages/adapters/graphify-*/` for future runtime integration.

### 4. Venture Validation Agents — `VentureLab`
- Score problem strength, urgency, willingness-to-pay, differentiation, adoption friction, execution risk and confidence.
- Reconcile signals from the committee transcript and research graph.
- Produces a `VentureRecommendation` artifact: `Proceed` / `Pivot` / `Kill` plus a confidence score and `nextSteps`.

### 5. BuildSquad Agents — `@ventureos/buildsquad`
- Planning swarm with role-typed agents: PM, UX, architecture, engineering, QA, GTM.
- Each role agent critiques the others; the orchestrator produces a coherent build plan.
- Produces a `BuildSquadPack`: vision, PRD, architecture brief, 4-week roadmap, user stories, RICE-prioritized requirements and agent critiques.
- Renders to a 14-file GitHub-ready scaffold via `renderRepoScaffold`.

### 6. Evaluation Agent — `EvaluationReport`
- Reads every upstream artifact and writes a single provenance-aware report.
- Includes readiness, recommendation, confidence, persona/research/risk coverage, key assumptions, open questions, validation roadmap, source artifact versions and model/provider metadata per generated section.
- Output is `EVALUATION_REPORT.md`, exported to GitHub alongside the BuildSquad pack.

### 7. Execution Handoff Agent — `GitHub Export`
- Bundles renderer output into a GitHub commit. Creates a new repository under the BYOK GitHub user, classifies errors (`repo_exists`, `invalid_token`, `insufficient_scope`, `rate_limited`, `network`), attaches a `github_repo` artifact and emits a timeline event with the repo URL and short commit SHA.

## Shared Venture Context

All agents read and write through the **Venture** domain object. A Venture owns:

- a `brief`
- a list of `artifacts` (typed JSON, versioned)
- a list of `VentureJob` execution records (status, progress, provider · model · cost, errors)
- a `timeline` of events

The Venture context is the only thing agents share. Each artifact is JSON-Schema-typed in `@ventureos/contracts`, so any agent or renderer can read it without seeing upstream prompts.

## VentureJob — async-first execution

Every long-running step is a **VentureJob**. Jobs are durable, observable, retryable. The UI shows:

- status (`queued`, `running`, `succeeded`, `failed`)
- per-step progress
- provider and model where available
- estimated cost
- elapsed time
- structured failure block with actionable guidance on error

This is the alpha-grade equivalent of an external queue — sufficient for a 15-minute focus-group simulation without standing up extra infrastructure.

## Why this is "Agent Swarms"

- **Specialization:** each agent group does one thing and does it well.
- **Deliberation:** the buying committee is genuinely multi-agent — agents argue, change positions and converge.
- **Provenance:** every artifact knows which agent and which model produced it.
- **Composition over chat:** agents communicate by writing typed artifacts, not by stuffing each other's prompts.
- **Hand-off to humans:** the swarm's output is a GitHub repository the engineering team can actually start working from.

## See also

- [`architecture-overview.md`](architecture-overview.md) — execution planes and package layout
- [`demo-mode.md`](demo-mode.md) — see the swarm in action with zero keys
- [`hackathon-submission.md`](hackathon-submission.md) — Microsoft Build Agent Swarms framing
