# Foundry — Vision

> Sprint −1 deliverable. Discovery, not implementation.

## 1. One-line vision

**Foundry turns a raw business idea into a validated, designed, and scaffolded venture — through three AI-native labs that simulate customers, stress-test the opportunity, and produce a buildable artifact.**

## 2. Problem statement

Founders, intrapreneurs, and product teams routinely commit months of engineering effort to ventures that were never going to work. The bottleneck is not engineering speed — it is the **discovery, validation, and translation-to-build** loop:

- Customer discovery is slow, biased, and rarely run against an honest objection set.
- Opportunity sizing is anecdote-driven; "go / pivot / kill" decisions are made on vibes.
- The gap between "validated insight" and "buildable PRD + architecture + scaffold" is huge and usually re-done from scratch.
- LLM tools today accelerate **execution** (Copilot, Cursor) but not **the decision to build the right thing**.

Foundry attacks the discovery-to-build gap with a structured, auditable, multi-agent workflow.

## 3. Product surface (three labs)

| Lab | Mission | Primary engine |
| --- | --- | --- |
| **PersonaLab** | Generate, simulate, and interview synthetic customers, stakeholders, and buying committees. | TinyTroupe (adapted) |
| **VentureLab** | Build a research graph, score the opportunity, surface risks/assumptions, and issue a Proceed / Pivot / Kill recommendation. | Graphify (adapted) + custom scoring agents |
| **BuildSquad** | Convert a validated venture into PRD → architecture → user stories → prototype → GitHub repository. | Squad-OSS (adapted) |

> **Naming risk flagged early.** The third Foundry module shares a name with Brady Gaster's `bradygaster/squad` repository. To avoid permanent namespace collision in code, packages, prompts, and docs, the internal module is renamed **BuildSquad** throughout this design. The external dependency is referred to as **Squad-OSS**.

## 4. End-to-end product flow

```
Idea
  → Research Graph                 (VentureLab / Graphify)
  → Persona Simulation             (PersonaLab / TinyTroupe)
  → Synthetic Customer Validation  (PersonaLab)
  → Venture Validation             (VentureLab)
  → Go / Pivot / Kill              (VentureLab)
  → BuildSquad                     (Squad-OSS)
  → PRD
  → Architecture
  → Prototype
  → GitHub Repository
```

Each transition is an **artifact handoff** — typed, versioned, auditable — not a free-form prompt chain. This is what differentiates Foundry from a "chain of GPT calls."

## 5. Design principles

1. **Decisions, not chats.** Every lab produces a structured artifact (JSON + Markdown), scored, with cited evidence.
2. **Synthetic first, human-in-the-loop always.** Synthetic personas accelerate; humans approve every gate (proceed/pivot/kill, PRD sign-off, repo creation).
3. **BYOK is non-negotiable.** No provider lock-in. The platform has no "default" model key.
4. **Adapters, not forks.** External engines (TinyTroupe, Graphify, Squad-OSS) are wrapped through stable internal contracts. We never edit upstream in-place.
5. **Evaluatable by construction.** Every artifact carries a quality score; the platform evaluates *itself* (see [evaluation-framework.md](evaluation-framework.md)).
6. **Repo-native output.** The final artifact is a GitHub repository, not a slide deck.
7. **Cost is a first-class signal.** Token spend, per tenant, per lab, per artifact, is observable and budget-bounded.

## 6. Non-goals (explicit)

- Foundry is **not** a no-code app builder. The prototype is a starting point, not a finished product.
- It does **not** replace real customer interviews — it sharpens, prioritises, and de-risks them.
- It is **not** an internal Microsoft-only tool. BYOK and tenant isolation are required from day one.
- It is **not** a hackathon demo. The hackathon is milestone 0; the architecture must survive milestone 12.

## 7. Target users (initial)

| Persona | Job-to-be-done |
| --- | --- |
| Solo founder | "Should I quit my job for this idea?" |
| Corporate intrapreneur | "Convince a steering committee this is worth funding." |
| Product manager (zero-to-one) | "Compress 6 weeks of discovery into a defensible 1-week artifact." |
| Venture studio / accelerator | "Triage 200 ideas/month down to 10 worth a partner's time." |
| Engineering leader | "Hand my team a PRD + architecture + scaffold, not a Notion page." |

## 8. Differentiators

- **Three labs, one spine.** Most agent frameworks ship one capability; Foundry ships a full pipeline with typed artifacts between phases.
- **Synthetic buying-committee simulation.** Not just personas — multi-stakeholder objection modelling (champion, blocker, economic buyer, end user).
- **Auditable Go/Pivot/Kill.** Every recommendation cites the research graph node IDs and persona transcript IDs that justify it.
- **Repo as the artifact.** BuildSquad produces a real GitHub repo with PRD, ADRs, scaffold, and issues — ready for a human team.
- **Provider-agnostic.** OpenAI, Azure OpenAI, Anthropic, Gemini today; Foundry, Ollama, GitHub Models tomorrow — without subsystem changes.

## 9. Milestones (rough horizon)

| Milestone | Scope | Audience |
| --- | --- | --- |
| **M0 — Hackathon submission** | Vertical slice: idea → personas → graph → Go/Pivot/Kill → PRD draft. Single tenant, single provider, in-memory state. | Judges |
| **M1 — Private alpha** | BYOK working end-to-end. Persistence. Cost telemetry. 3 design partners. | Friendly founders |
| **M2 — Public beta** | Multi-tenant. GitHub repo generation. Squad-OSS-driven prototype. Evaluation dashboard. | Open waitlist |
| **M3 — GA** | SSO, audit logs, additional providers (Foundry, Ollama, GitHub Models), marketplace of personas/templates. | Paying customers |

## 10. Success metrics

| Metric | Why it matters |
| --- | --- |
| **Time-from-idea-to-PRD** | Core value proposition. Target: < 2 hours of wall time, < $5 of LLM spend at M1. |
| **Recommendation calibration** | Of ideas marked "Kill," how many died for the predicted reason? Of "Proceed," how many reached MVP launch? |
| **Persona realism score** | Blind A/B vs real interview transcripts (see [evaluation-framework.md](evaluation-framework.md)). |
| **Artifact reuse rate** | % of generated PRDs / scaffolds that survive into the human-built product without rewrite. |
| **Provider portability** | Time to add a new provider should be < 1 engineer-day at M2. |

## 11. Risks to the vision (top 5)

1. **Synthetic personas can produce confident nonsense.** Mitigation: empirical validation harness, calibration against real interviews, confidence tagging on every output.
2. **External dependencies (TinyTroupe, Graphify, Squad-OSS) are pre-1.0 and may break.** Mitigation: adapter layer, pinned versions, contract tests, fork-and-vendor escape hatch.
3. **BYOK security failures are existential.** Mitigation: encryption at rest, KMS-backed envelope encryption, never log keys, masked UI, see [security.md](security.md).
4. **Cost runaway.** A single misconfigured persona loop can burn $100s. Mitigation: per-run budget caps, circuit breakers, cost telemetry per artifact.
5. **"Demo-quality" trap.** The temptation to ship hackathon-shaped code into production. Mitigation: this Sprint −1 exists precisely to prevent that.

## 12. Related documents

- [architecture.md](architecture.md) — system architecture
- [security.md](security.md) — security architecture
- [provider-abstraction.md](provider-abstraction.md) — BYOK design
- [adapter-strategy.md](adapter-strategy.md) — external integrations
- [evaluation-framework.md](evaluation-framework.md) — quality scoring
- [product-roadmap.md](product-roadmap.md) — milestone detail
- [repository-structure.md](repository-structure.md) — monorepo layout
- [faceless-crm-reference-scenario.md](faceless-crm-reference-scenario.md) — worked example
