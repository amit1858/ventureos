# Faceless CRM for SMB — Reference Scenario

> Sprint −1 deliverable. A worked end-to-end example demonstrating how an `IdeaBrief` flows through PersonaLab, VentureLab, and BuildSquad, with every artifact handoff named.

---

## 1. The idea (input)

```json
{
  "kind": "IdeaBrief",
  "title": "Faceless CRM for SMB",
  "summary": "A CRM for small and mid-sized businesses that runs without a sales team — relationship hygiene, follow-ups, deal-stage advancement, and pipeline reporting all driven by AI agents. The user reviews and approves; the CRM does the work.",
  "target_market": "SMB owners and 1–5-person revenue teams in services and prosumer software",
  "wedge": "Replace 'CRM hygiene' (the part nobody does) with autonomous agents that keep records clean and proactively act on the pipeline",
  "business_model_hypothesis": "$49–$199/seat/month SaaS",
  "founder_assumptions": [
    "SMBs want to spend zero time on CRM hygiene",
    "SMBs trust AI to draft follow-up emails if they can approve before send",
    "Incumbents (HubSpot, Pipedrive, Salesforce SMB) are too heavy and too manual",
    "There is a non-trivial 'CRM grave' market — businesses that bought CRM and abandoned it"
  ],
  "tags": ["B2B SaaS", "SMB", "CRM", "agentic"]
}
```

This is the only thing the user types. Everything below is generated, gated, and audited.

---

## 2. Venture state-machine walkthrough

```
DRAFT
  → RESEARCHING             (VentureLab / GraphifyAdapter)
  → PERSONA_DESIGN          (PersonaLab / TinyTroupeAdapter — persona generation)
  → SIMULATING              (PersonaLab — focus group + interviews + buying committee)
  → VALIDATING              (VentureLab — opportunity, risks, recommendation)
  → DECISION_PENDING        ⛳ HUMAN GATE
    → PROCEEDING
        → PRD_DRAFTING      (BuildSquad)
        → ARCH_DRAFTING
        → STORY_DRAFTING
        → PROTOTYPE_PLANNING
        → REPO_PROVISIONING (GitHubAdapter)
        → LIVE
```

Each transition produces exactly the artifacts named below.

---

## 3. Step-by-step

### Step 1 — RESEARCHING (VentureLab → GraphifyAdapter)

**Input:** the `IdeaBrief`.

**What happens:**
1. A small "research scout" agent expands the brief into ~25 seed queries spanning competitors, market sizing, regulations (GDPR/CAN-SPAM for outbound), SMB software adoption studies, "CRM grave" reports, AI-CRM news, and review-site sentiment on incumbents.
2. The scout shortlists ~30 URLs (G2, Capterra, SaaS analytics reports, founder essays, Reddit r/smallbusiness, Crunchbase pages for HubSpot/Pipedrive/Folk/Attio/Salesflare/Streak).
3. `GraphifyAdapter.build_research_graph(brief, seed_urls, mode='quick')` runs.
4. Tree-sitter does nothing (no code). Semantic extraction (LLM, via provider layer) builds nodes/edges from the 30 sources.
5. Leiden clustering finds communities. God-nodes surface.
6. The graph is persisted as `ResearchGraph` artifact.

**Output:** `ResearchGraph` (illustrative shape, not real numbers)

```json
{
  "kind": "ResearchGraph",
  "venture_id": "v_01HX...",
  "stats": { "nodes": 412, "edges": 1136, "communities": 14,
             "confidence": { "EXTRACTED": 0.62, "INFERRED": 0.36, "AMBIGUOUS": 0.02 } },
  "god_nodes": [
    {"label": "HubSpot Free Tier", "degree": 41, "community": 2},
    {"label": "Salesforce SMB Essentials", "degree": 33, "community": 2},
    {"label": "Pipedrive", "degree": 31, "community": 2},
    {"label": "GDPR consent for outbound email", "degree": 24, "community": 7},
    {"label": "Attio (modern CRM)", "degree": 22, "community": 4},
    {"label": "Folk", "degree": 19, "community": 4},
    {"label": "Salesflare", "degree": 17, "community": 4},
    {"label": "CRM abandonment rate", "degree": 16, "community": 9}
  ],
  "surprising_connections": [
    "Streak ↔ Gmail-power-user crowd ↔ 'why we abandoned HubSpot'",
    "Attio ↔ YC founders ↔ 'CRM as data app' framing",
    "GDPR consent ↔ AI-drafted outreach ↔ class-action risk"
  ],
  "evidence_uri": "s3://.../tenants/t1/ventures/v_01HX/research/graph.json"
}
```

The user sees a graph viewer with confidence-coloured edges and a one-page summary. They can flag-and-remove any node ("this competitor doesn't exist anymore").

---

### Step 2 — PERSONA_DESIGN (PersonaLab → TinyTroupeAdapter)

**Input:** `IdeaBrief` + `ResearchGraph` (used to ground the persona context).

**What happens:**
1. `TinyTroupeAdapter.generate_personas(brief, n=8, demography=...)` runs.
2. The demography is derived from the brief's `target_market` + research-graph community on "SMB owner archetypes."
3. TinyTroupe's `TinyPersonFactory` produces 8 personas (with `parallelize=True`), inside the per-venture subprocess.
4. `TinyPersonValidator.validate_person()` runs on each; scores are recorded.

**Output:** `PersonaSet` — illustrative excerpt:

```json
{
  "kind": "PersonaSet",
  "personas": [
    {
      "id": "p1",
      "name": "Dana, 38, owner of a 6-person creative agency (Austin TX)",
      "role": "Founder + de-facto head of sales",
      "tools_today": ["HubSpot Free", "Google Workspace", "Notion"],
      "pain": "Forgets to follow up; closes lose-able deals; 'CRM is where leads go to die'",
      "buying_power": "Decides solo for tools <$500/mo",
      "ai_trust": "High for drafting, low for sending without review",
      "validator_score": 0.86
    },
    {
      "id": "p2",
      "name": "Marcus, 45, owner of a regional HVAC service company (Atlanta)",
      "role": "Owner + dispatcher",
      "tools_today": ["ServiceTitan", "Spreadsheets", "Phone"],
      "pain": "Quote follow-ups slip; repeat-customer recall is manual",
      "buying_power": "Decides with his ops manager",
      "ai_trust": "Medium; needs phone, not just email",
      "validator_score": 0.81
    },
    "... 6 more ..."
  ],
  "buying_committee_composition": [
    {"role": "Champion (owner-operator)", "personas": ["p1", "p2", "p5"]},
    {"role": "Blocker (ops manager / EA)", "personas": ["p3"]},
    {"role": "Economic buyer", "personas": ["p1", "p2", "p5", "p6"]},
    {"role": "End user (rep / coordinator)", "personas": ["p4", "p7", "p8"]}
  ]
}
```

The user sees a persona card UI. They can edit attributes or regenerate; every edit creates a new `PersonaSet` artifact.

---

### Step 3 — SIMULATING (PersonaLab — focus group + interviews + buying committee)

**Input:** `PersonaSet` + `SimulationScript` (templated from the brief — "show me a hypothetical product; surface objections; explore willingness to pay").

**What happens:**

#### 3a. Focus group
- 5 personas + a moderator persona in a `TinySocialNetwork`.
- Scripted prompt: a one-paragraph product pitch + a screenshot description.
- Run 4 rounds. Extract objections, surprises, feature requests, and willingness-to-pay statements.

#### 3b. 1:1 interviews
- 3 personas (the highest-divergence ones) receive a structured interview script.
- Focus: current workflow, last 5 deals lost, trust threshold for AI-sent emails, deal-killer concerns.

#### 3c. Buying-committee simulation
- The Champion (Dana) tries to convince the Blocker (ops manager Priya) to buy.
- We score the simulation: does the Champion's pitch survive the Blocker's objections?

**Outputs:** `Transcript[]`, `ObjectionMap`, `FeedbackSynthesis`, `BuyingCommitteeResult`.

**Illustrative `ObjectionMap` excerpt:**

```json
[
  {
    "objection": "If the AI sends an email under my name and gets it wrong, my reputation is gone.",
    "severity": "high",
    "frequency": 0.75,
    "supporting_personas": ["p1", "p3", "p5"],
    "evidence": ["t_03_lines_44-58", "t_07_lines_12-19"],
    "mitigation_hypothesis": "Human-approve every outbound until trust ladder is climbed; show diffs."
  },
  {
    "objection": "I already pay for a CRM I don't use. I'm not paying for another.",
    "severity": "high",
    "frequency": 0.62,
    "supporting_personas": ["p1", "p2"],
    "evidence": ["t_03_lines_71-82"],
    "mitigation_hypothesis": "Migrate-and-replace flow with a 'kill HubSpot' button; first 30 days free."
  },
  {
    "objection": "I want to talk to it. Email is not how I sell.",
    "severity": "medium",
    "frequency": 0.50,
    "supporting_personas": ["p2", "p4"],
    "evidence": ["t_05_lines_22-35"],
    "mitigation_hypothesis": "Voice / SMS lane in v2; v1 focused on email + LinkedIn."
  }
]
```

**Illustrative `BuyingCommitteeResult`:** Champion partially convinces Blocker; Blocker's persistent concern is "auditability" (we have a log of every AI action). This becomes a v1 requirement.

---

### Step 4 — VALIDATING (VentureLab — opportunity, risks, recommendation)

**Input:** `ResearchGraph` + `Transcript[]` + `ObjectionMap` + `FeedbackSynthesis`.

**What happens:**
1. An **opportunity-scoring agent** weighs: market size (graph), differentiation vs incumbents (graph + transcripts), willingness-to-pay (transcripts), execution risk (assumptions vs evidence).
2. An **assumption-testing agent** maps each `founder_assumption` to evidence in graph + transcripts and assigns: `SUPPORTED`, `WEAK`, `CONTRADICTED`.
3. A **risk-register agent** produces risks with severity/likelihood/category, citing evidence.
4. A **recommendation agent** integrates all of the above into Proceed/Pivot/Kill with explicit go-conditions.
5. Each output is **judged** by the eval harness (Layer 2). The composite `quality_score` is attached.

**Output:** `Recommendation` — illustrative shape:

```json
{
  "kind": "Recommendation",
  "decision": "PROCEED_WITH_PIVOT_NOTES",
  "confidence": 0.66,
  "rationale": [
    "Real, repeated pain: 'CRM hygiene' is universally undone (objection frequency 0.85 across personas).",
    "Differentiated wedge: existing AI-CRM efforts (graph community 4) focus on data-app framing, not autonomous follow-up.",
    "Significant willingness-to-pay among owner-operators; less so among service businesses where voice is the channel.",
    "GDPR/CAN-SPAM and impersonation risk are material; v1 must hard-gate human approval."
  ],
  "assumption_audit": [
    {"assumption": "SMBs want zero time on CRM hygiene", "status": "SUPPORTED", "evidence": ["t_03_44", "t_07_12", "node:CRM-abandonment-rate"]},
    {"assumption": "SMBs trust AI to draft follow-ups if they approve before send", "status": "SUPPORTED", "evidence": ["t_05_50"]},
    {"assumption": "Incumbents are too heavy and too manual", "status": "SUPPORTED", "evidence": ["node:HubSpot-Free", "node:Pipedrive", "t_03_71"]},
    {"assumption": "Non-trivial CRM-grave market", "status": "WEAK", "evidence": ["node:CRM-abandonment-rate is INFERRED-confidence; need primary data"]}
  ],
  "risk_register": [
    {"risk": "Sender-reputation incident from AI-generated outreach", "severity": "high", "likelihood": "medium",
     "mitigation": "Human-approve every send; per-domain warm-up; opt-out hygiene"},
    {"risk": "Incumbent (HubSpot) adds equivalent agent for free", "severity": "high", "likelihood": "high",
     "mitigation": "Wedge on migration + ICP + 'no-dashboard' UX, not on the agent itself"},
    {"risk": "SMBs won't migrate from existing CRMs", "severity": "high", "likelihood": "medium",
     "mitigation": "One-click migration; first-30-days-free; explicit 'kill HubSpot' wizard"},
    {"risk": "Service-business segment (HVAC etc.) wants voice; will churn", "severity": "medium", "likelihood": "high",
     "mitigation": "Narrow ICP to creative agencies, consultancies, prosumer SaaS in v1; defer service segment to v2"}
  ],
  "pivot_notes": [
    "Narrow ICP from 'all SMB' to 'owner-operated service/consulting firms 1–10 people'.",
    "Position as 'CRM replacement', not 'CRM add-on'. The wedge is replacing HubSpot, not improving it."
  ],
  "go_conditions": [
    "5 design partners signed within 30 days of build start",
    "≥ 60% of design partners migrate from an existing CRM",
    "AI-drafted outbound approval rate ≥ 70% in first 2 weeks"
  ],
  "evidence_refs": ["..."],
  "quality_score": 0.78
}
```

**Cost-to-here** (illustrative target on Azure OpenAI gpt-4.1-mini equivalent): **≈ $2.40**, wall time **≈ 6 minutes**.

---

### Step 5 — DECISION_PENDING ⛳ HUMAN GATE

The user sees the recommendation with full evidence. They choose:

- **Proceed** — moves to PROCEEDING.
- **Pivot** — annotates pivot notes, the state machine loops back to DRAFT with a new `IdeaBrief`.
- **Kill** — terminal; the venture is archived; metadata feeds the calibration dataset.

In our walkthrough, the user picks **Proceed**, with the pivot notes accepted as scope changes.

---

### Step 6 — PRD_DRAFTING (BuildSquad)

**Input:** `Recommendation` (Proceed) + `PersonaSet` + `ResearchGraph`.

**What happens:** the `pm` role drafts a PRD with sections: problem, target users (ICP narrowed per pivot notes), success metrics, in-scope, out-of-scope, risks (mirrored from risk register), open questions, go-conditions.

**Output (excerpt):** `PRDArtifact`

```markdown
# Faceless CRM for SMB — PRD (v0.1, generated)

## Problem
Owner-operators of small service/consulting firms (1–10 people) sell with the
support of a CRM they bought, abandoned, and now pay for monthly. The work the
CRM was supposed to do — follow-ups, hygiene, pipeline reporting — falls back
on the owner, who is the worst person to do it because they're also doing
delivery.

## Target users (ICP)
- Owner-operator
- 1–10 people, services or consulting or prosumer SaaS
- Currently pays for HubSpot Free/Starter, Pipedrive, or Folk and doesn't use it weekly
- $0–$3M ARR, growth via referral + outbound

## Out of scope (v1)
- Voice and SMS channels (v2)
- Mid-market and enterprise
- Custom workflow builders
- Mobile-first usage (web-first; mobile read-only)

## Success metrics
- 70%+ approval rate on AI-drafted outbound after week 2
- 60%+ of design partners migrate from an existing CRM
- 25%+ week-4 reduction in deal-stage decay

## Risks (mirror of recommendation risk register)
... [4 risks copied with mitigations] ...

## Open questions
- Pricing: per-seat vs per-contact?
- Migration from HubSpot Free — list-only or pipeline+activity?
- Sender warm-up domain ownership: ours or theirs?
```

---

### Step 7 — ARCH_DRAFTING (BuildSquad)

**Output:** `ArchitectureArtifact` (excerpt):

```markdown
# Faceless CRM — Architecture (v0.1, generated)

## Style
- Modular monolith (Node + TypeScript) for v1; carve services later.
- Postgres for OLTP; Redis for queues + cache; object store for attachments.
- React + Next.js front-end; tRPC between web and API.
- Provider abstraction for LLM + email + calendar.

## Modules
- contacts/                 ingestion + canonicalisation
- pipeline/                 deals, stages, scoring
- agents/                   follow-up agent, hygiene agent, summariser agent
- inbox/                    approval queue for AI-drafted outbound
- migrations/               importers (HubSpot, Pipedrive, CSV)
- integrations/             gmail, outlook, google-cal, linkedin
- providers/                BYOK pattern (model + email)
- audit/                    every AI action logged + replayable

## Critical ADRs (drafted)
- ADR-001: Human-in-the-loop for every outbound send (mitigates risk #1)
- ADR-002: Provider-agnostic LLM layer
- ADR-003: Per-customer email-sending domain with explicit warm-up
- ADR-004: Server-side migration runners (not browser-based)
```

---

### Step 8 — STORY_DRAFTING (BuildSquad)

**Output:** `UserStoryArtifact[]` (15–25 stories grouped by epic). Excerpt:

```
Epic: Approval inbox
- As an owner-operator, I want to see every AI-drafted email queued
  for my approval so that nothing goes out under my name without me seeing it.
  Acceptance: list view; preview; one-click approve/edit/reject; per-thread context.

Epic: HubSpot migration
- As a HubSpot Free user, I want to connect my HubSpot account and have my
  contacts, companies, and deals imported within 5 minutes so I can switch.
  Acceptance: OAuth flow; dry-run report; one-click commit; rollback within 7 days.

Epic: Pipeline hygiene agent
- As an owner, I want a daily summary of "deals that are decaying" so I can
  decide which to push, defer, or kill.
  Acceptance: morning digest email; in-app feed; one-click triage per deal.
```

---

### Step 9 — PROTOTYPE_PLANNING (BuildSquad)

**Output:** `PrototypePlanArtifact` — chooses a scaffold (Next.js + Fastify + Postgres + Prisma), lists initial dependencies, lays out the directory structure, plans the smoke-test, and identifies which 3 stories will be implemented in the prototype (typically: connect Gmail, see contacts, draft one follow-up that goes through the approval inbox).

---

### Step 10 — REPO_PROVISIONING (BuildSquad → GitHubAdapter)

**What happens:**
1. The user supplies their personal GitHub token (BYO; encrypted; per-call use only).
2. `GitHubAdapter.createRepo(...)` creates `username/faceless-crm` private.
3. The scaffold is pushed.
4. Each user story becomes a GitHub issue with labels and the relevant ADR linked.
5. A GitHub Project board is created with columns Backlog / In Progress / Review / Done.
6. The repo's README references back to the VentureOS PRD and recommendation by ID.

**Output:** `RepoLinkArtifact`

```json
{
  "kind": "RepoLink",
  "url": "https://github.com/username/faceless-crm",
  "default_branch": "main",
  "issues_created": 21,
  "project_url": "https://github.com/users/username/projects/14"
}
```

---

## 4. Cost & latency envelope (illustrative target)

| Lab | Cost | Wall time |
| --- | --- | --- |
| VentureLab — research | $0.80 | 90 s |
| PersonaLab — personas | $0.50 | 60 s |
| PersonaLab — simulation (focus group + interviews + buying committee) | $1.20 | 180 s |
| VentureLab — validation + recommendation | $0.40 | 60 s |
| BuildSquad — PRD + arch + stories + plan | $1.40 | 240 s |
| BuildSquad — repo provisioning | $0.05 | 30 s |
| Eval harness sampling (10% sampled artifacts) | $0.20 | parallel |
| **Total** | **≈ $4.55** | **≈ 11 minutes** |

This is the M1 target on a `standard`-tier model and informs the per-venture default budget cap of **$5**.

---

## 5. What this scenario demonstrates

1. **Typed artifacts at every boundary** — no free-form prompt chaining; every transition is an audited handoff.
2. **Citations grounded in real evidence** — the recommendation references graph node IDs and transcript line ranges, not "studies show".
3. **Honest pivot notes** — Proceed comes with scope narrowing, not blind validation.
4. **Synthetic, not speculative** — buying-committee dynamics are simulated, not invented.
5. **BYOK respected end-to-end** — the user's provider key and GitHub token never leave the provider layer / GitHub adapter.
6. **Human gates at the only places they matter** — Proceed/Pivot/Kill, and outbound approval in the product itself.
7. **The repo is the artifact** — a human team can clone and start working tomorrow.

This scenario doubles as:

- The M0 hackathon demo script.
- The CI end-to-end test (with `MockProvider` then `ReplayProvider`).
- The first golden brief in the eval harness.
- The onboarding example in `examples/faceless-crm/`.
