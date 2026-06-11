# VentureOS — 5-Minute Demo Script (Faceless CRM)

This is the recommended walkthrough for showing VentureOS end-to-end **without any API
keys**. It maps 1:1 to the Demo Mode page at **`/demo/faceless-crm`**.

> Demo Mode is read-only and seeded. It never calls a provider, Supabase or GitHub.
> Real Mode runs the identical pipeline on a user's own idea with their BYOK keys.

---

## Before you start

- Run the app locally (`pnpm dev` in `apps/web`) or open the deployed URL.
- No `.env`, no provider key, no GitHub token is required for the demo.
- Open the homepage `/` so you can start from the top of the funnel.

---

## The script (~5 minutes)

### 0:00 — Homepage (15s)
> "VentureOS turns a raw idea into a validated, build-ready venture. It uses an agent
> swarm — synthetic personas, a buying committee, a research graph, a validation engine
> and a build squad — to decide *what to build before you build it*. It's BYOK-first:
> your keys, encrypted, server-side."

Click **Try the demo →**, then open **Faceless CRM for SMB**.

### 0:15 — Overview & readiness (30s)
Point at the **Demo Mode** banner and the **readiness ring (97/100)**.
> "This venture has already been driven through every lab. Readiness, decision (PROCEED),
> confidence (82%) and the artifact count are all derived from the underlying artifacts —
> nothing here is hand-typed. The pipeline strip shows coverage rising stage by stage."

### 0:45 — The idea (20s)
> "In Real Mode this brief is the *only* thing a founder writes. A Gmail-native, agent-run
> CRM for owner-operators who bought a CRM and abandoned it. Everything below is generated."

### 1:05 — Personas (45s)
Scroll to **PersonaLab**.
> "Five synthetic personas — rendered as cards, not raw JSON. A champion (Maya), two
> economic buyers, a compliance blocker (Nadia) and a privacy skeptic (Priya). Each has
> goals, pains, objections, a quote and a confidence score."

### 1:50 — Buying committee (60s)
Scroll to **Buying Committee** — this is the centerpiece.
> "This is where it gets agentic. The personas take initial positions, then *challenge each
> other*. Nadia challenges Maya on accountability; the team answers with a human-approval
> inbox and a replayable audit log. Watch the opinion change: Nadia moves from **Reject** to
> **Pilot first**. The committee converges on a gated pilot — moderate consensus, 82% confidence."

### 2:50 — Research graph (35s)
Scroll to **Research Graph**.
> "Sources are extracted into a typed graph — 13 nodes, 15 edges. The god-nodes table shows
> the highest-leverage concepts (‘replace, don't augment, the abandoned CRM'), and
> contradictions are surfaced rather than hidden — e.g. AI inbox autonomy vs. the trust barrier."

### 3:25 — Validation (45s)
Scroll to **Validation & recommendation**.
> "VentureLab scores eight dimensions with a deterministic rule engine, then computes
> PROCEED / PIVOT / KILL. Score 74 → **PROCEED**. Note the scorecard, the supporting evidence
> *and* counter-signals, the risk table, and a prioritized validation roadmap with the two
> decision-blocking steps flagged."

### 4:10 — Build plan (30s)
Scroll to **BuildSquad**.
> "Because it's PROCEED, BuildSquad emits a full pack — product vision, MVP scope with explicit
> cuts, seven user stories, an architecture brief and a four-week roadmap. Even the agent
> critiques are shown, including a QA blocker demanding a ‘never auto-send' test."

### 4:40 — Evaluation report & export (20s)
Scroll to **Evaluation report**, then **GitHub export**.
> "The evaluation report is a first-class, provenance-tracked artifact — you can copy the
> markdown. And here's the GitHub export: the exact files a real export would push —
> README, VISION, PRD, ARCHITECTURE, ROADMAP, USER_STORIES and the EVALUATION_REPORT.
> In Demo Mode nothing is pushed; in Real Mode this uses your BYOK GitHub PAT."

### 5:00 — Close (10s)
> "Every step you saw is an agent in a swarm, every artifact is traceable to the job and model
> that produced it, and none of it required an API key to demonstrate. That's VentureOS."

---

## Why this fits "Agent Swarms"

| Agent | Role in the swarm |
| --- | --- |
| Persona agents | Generate the synthetic buyer set from the idea brief |
| Buying-committee agents | Take positions, challenge, respond, and converge on a decision |
| Research-graph agents | Extract sources into a typed evidence graph |
| Venture-validation agent | Score dimensions and compute PROCEED / PIVOT / KILL |
| BuildSquad agents | Produce the PRD, MVP, stories, architecture and roadmap, then critique each other |
| Evaluation agent | Synthesize a provenance-tracked readiness report |
| GitHub-export agent | Render artifacts into repo-ready files |

---

## Talking points if asked

- **"Is this real or mocked?"** Demo Mode is seeded for a key-free walkthrough. The artifacts
  conform to the *same* `@ventureos/contracts` types the live labs emit, and the evaluation
  report and export files are produced by the *same* renderers Real Mode uses.
- **"How do you handle secrets?"** BYOK keys are encrypted, used only server-side, never sent to
  the browser or logged, and never included in a GitHub export. See `docs/security.md`.
- **"What's the primary object?"** The Venture. Every lab run is a `VentureJob` against a Venture,
  and every output is a versioned `VentureArtifact`.
