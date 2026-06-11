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
  the browser or logged, and never included in a GitHub export. See `docs/security.md` and
  `docs/security-byok.md`.
- **"What's the primary object?"** The Venture. Every lab run is a `VentureJob` against a Venture,
  and every output is a versioned `VentureArtifact`.

---

## 3-minute version (tight)

For a quick reviewer pass. Skip everything optional.

| Time | URL | Talk track |
|---|---|---|
| 0:00 | `/` | "VentureOS is a multi-agent venture operating system. Persona, committee, research-graph, validation, BuildSquad and evaluation agents collaborate on a shared venture." |
| 0:30 | `/demo/faceless-crm` | "Faceless CRM for SMB — every artifact below was produced by an agent group. No keys, no network calls." |
| 1:00 | scroll to Buying Committee | "Five synthetic personas deliberated, two changed positions, the committee converged on Pilot." |
| 1:45 | scroll to Research Graph | "The graph surfaces god-nodes and contradictions explicitly." |
| 2:15 | scroll to VentureLab | "PROCEED with high confidence — here's the scorecard and the counter-signals." |
| 2:40 | scroll to GitHub Export | "These 14 files are produced by the same renderer Real Mode pushes to your GitHub account via your BYOK PAT." |
| 3:00 | end | "That's the swarm. Real Mode runs the same flow on your own idea." |

## 7-minute version (with Real Mode hand-off)

For an interactive demo where you have a BYOK key ready.

| Time | URL | Talk track |
|---|---|---|
| 0:00 | `/` | Hero + the multi-agent architecture section. |
| 1:00 | `/#pipeline` | Pipeline table: each step, agent role, artifact, signal. |
| 2:00 | `/demo/faceless-crm` | Full demo walkthrough (compress 5-minute version into ~3 minutes). |
| 5:00 | `/settings/byok` | Show validated OpenAI key + GitHub PAT. Talk about encryption at rest and the `lint:arch` import boundary. |
| 5:45 | `/ventures/new` | Create a venture from a brief (don't run labs live — they take real time). |
| 6:15 | jump back to Demo's GitHub Export section | "In Real Mode, this preview is identical, and the export creates a real repo under your account with a real commit SHA. We've shipped error classification for `repo_exists`, `invalid_token`, `insufficient_scope`, `rate_limited`." |
| 7:00 | end | Open `docs/agent-swarms.md` briefly to land the architecture point. |

---

## Fallback plans

### Fallback A — API key fails mid-demo

1. Don't panic. Don't fix it on-screen.
2. Switch to `/demo/faceless-crm` and continue the walkthrough from Demo Mode.
3. Talking point: "This is exactly why Demo Mode exists — every reviewer can experience the full output regardless of provider health." Then point at the structured failure card if the failure happened during a live Real Mode run: "Notice the failure code is stable (`invalid_token`) with retry guidance. This is the BYOK-linked failure UX we ship across every lab."

### Fallback B — GitHub export fails mid-demo

1. Most common cause is `repo_exists`. The failure card explicitly says so.
2. Demo the **error UX itself** as a feature: stable error codes (`repo_exists`, `invalid_token`, `insufficient_scope`, `rate_limited`, `network`), actionable hints, retry buttons that re-issue the call without the user re-entering the credential.
3. Then switch to `/demo/faceless-crm` and show the simulated GitHub Export section to make the "what the success path looks like" point.

### Fallback C — Local server stops responding

1. The dev server has logs at `apps/web` console. Don't show them on stream.
2. Switch to the deployed/static demo if available, otherwise share the GitHub repo link directly.
3. Walk through `docs/agent-swarms.md` and `docs/architecture-overview.md` to deliver the architecture story without the live UI.

### Fallback D — Network is flaky

1. Demo Mode is fully static and works offline once loaded.
2. Open `/demo/faceless-crm` ahead of time; if network drops mid-demo, continue scrolling through Demo Mode — no further network calls are needed.
