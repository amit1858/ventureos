# Foundry — Product Roadmap

> Sprint −1 deliverable. Milestone definition, scope boundaries, exit criteria.

## Roadmap shape

```
Sprint -1  → Discovery, architecture, planning            (this sprint)
M0         → Hackathon submission                         (vertical slice)
M1         → Private alpha                                (BYOK + persistence)
M2         → Public beta                                  (multi-tenant + repo gen)
M3         → GA                                           (SSO, audit, providers)
M4+        → Marketplace, regulated industries            (TBD)
```

The hackathon is **M0**, not the destination. The architecture is sized for M3.

---

## Sprint −1 (this sprint) — Discovery & architecture

**Scope**

- 12 deliverable documents (this set).
- ADR template, contract package skeleton, repository structure decision.
- No production code.

**Exit criteria**

- All 12 docs reviewed and approved.
- Open questions captured as ADRs.
- Repository scaffold checked in.

---

## M0 — Hackathon submission

**Goal:** end-to-end vertical slice on the **Faceless CRM for SMB** scenario (see [faceless-crm-reference-scenario.md](faceless-crm-reference-scenario.md)), demonstrable in under 10 minutes.

**In scope**

- Single tenant (the demo account), single user.
- Single provider (Azure OpenAI **or** OpenAI — judge's choice via env var), but routed through the provider abstraction layer.
- PersonaLab: generate 5 personas, run one focus group, one 1:1 interview. TinyTroupe wrapped through `TinyTroupeAdapter`.
- VentureLab: build a small research graph from 10 seeded URLs via Graphify, produce opportunity score + Go/Pivot/Kill with cited evidence.
- BuildSquad: generate a PRD and a scaffold (no Squad-OSS yet — hand-rolled agents calling the provider layer; Squad-OSS is M1).
- GitHub: create a repo from a template and push the scaffold.
- Web UI: minimal Next.js app with the venture timeline and artifact viewer.
- In-memory + SQLite persistence. No KMS, no multi-tenant.
- Cost telemetry to console.

**Out of scope (explicitly)**

- BYOK UI (env var only).
- Multi-tenant. Multi-user.
- Squad-OSS adapter.
- Evaluation dashboard (scores logged only).
- Audit log persistence.
- Real authentication (token in header).

**Exit criteria**

- Faceless CRM scenario runs end-to-end in < 10 minutes wall time, < $3 spend on Azure OpenAI gpt-4.1-mini equivalent.
- Recommendation artifact cites at least 5 graph nodes and 3 transcript excerpts.
- Generated repo compiles / lints.
- Demo video recorded.

---

## M1 — Private alpha

**Goal:** 3 design partners can run their own ideas end-to-end, with their own provider keys, on persistent storage.

**In scope**

- BYOK: OpenAI, Azure OpenAI, Anthropic, Gemini. Full key lifecycle (validate, encrypt, store, rotate, delete). KMS-backed envelope encryption.
- Postgres + object store + Redis. Tenant isolation via RLS.
- Real auth (OAuth/OIDC; one IdP).
- Audit log persisted.
- Budget caps (per-tenant, per-venture) enforced in the provider layer.
- Cost dashboard per tenant.
- Squad-OSS adapter behind a feature flag; hand-rolled BuildSquad agents remain the default.
- Evaluation harness: persona realism, recommendation calibration tracked but not yet customer-facing.
- Documentation site (Docusaurus or Astro).

**Out of scope**

- Public self-serve signup (invite-only).
- Marketplace.
- Mobile.
- Foundry / Ollama / GitHub Models providers (deferred to M3).

**Exit criteria**

- Three design partners independently complete an end-to-end venture using their own keys.
- Zero security incidents in 30-day window.
- p95 lab-job latency: PersonaLab < 5 min, VentureLab < 3 min, BuildSquad < 8 min.
- Provider failover demonstrated (kill primary, traffic shifts).
- Cost per end-to-end venture median < $5.

---

## M2 — Public beta

**Goal:** open waitlist; multi-tenant in production; GitHub repo generation is first-class; Squad-OSS becomes default for BuildSquad.

**In scope**

- Self-serve signup with email verification.
- Multi-tenant production with monitored isolation.
- Squad-OSS adapter promoted to default; hand-rolled fallback kept.
- Full BuildSquad output: PRD, ADRs, user stories, prototype scaffold, GitHub repo with issues and project board.
- Evaluation dashboard (artifact quality, recommendation calibration over time) customer-visible.
- Persona library (reusable templates).
- Sharing a venture read-only via signed URL.
- Data residency US (EU at M3).
- SOC 2 Type I controls implemented.

**Out of scope**

- SSO for enterprises (M3).
- On-prem.
- Fine-tuning.

**Exit criteria**

- 100 ventures completed by external users.
- NPS ≥ 40.
- < 0.1% of jobs leak across tenants in pen test (target: 0).
- Documented runbook for incident response.

---

## M3 — GA

**Goal:** enterprise-ready, provider-diverse, audit-clean.

**In scope**

- Enterprise SSO (SAML, OIDC providers beyond the M1 IdP).
- Additional providers: GitHub Models, Ollama (self-hosted), Azure AI Foundry.
- Data residency EU.
- SOC 2 Type II audit completed.
- GDPR data export and right-to-be-forgotten flows.
- Role-based access control (Owner / Admin / Builder / Viewer).
- Webhook outbound events (venture state transitions).
- Public API with documented rate limits.

**Exit criteria**

- First paying enterprise customer onboarded.
- Provider-add time < 1 engineer-day (proven by adding Ollama in one day).
- SOC 2 Type II report delivered.

---

## M4+ (sketch)

- Persona / template / scaffold **marketplace**.
- **Industry packs** (FinTech, HealthTech, B2B SaaS) with curated personas and risk libraries.
- **Continuous discovery** — long-running ventures that re-validate against new market data.
- **Team collaboration** — multi-cursor on artifacts, comments, suggestions.
- **Regulated industry** support (HIPAA, FedRAMP).

---

## Cross-cutting workstreams (run in parallel across milestones)

| Workstream | Owner | Continuous through |
| --- | --- | --- |
| **Evaluation harness** — calibrate persona realism, recommendation outcomes against real founder follow-ups | AI Eng | M1 → ongoing |
| **Cost governance** — tighten budget defaults, model selection guidance | Platform | M1 → ongoing |
| **Adapter hygiene** — track upstream releases of TinyTroupe / Graphify / Squad-OSS; run contract tests on every release | Platform | M0 → ongoing |
| **Security** — quarterly pen test, key handling drills | Security | M1 → ongoing |
| **Docs & DevRel** — every public feature ships with docs + example | DevRel | M2 → ongoing |

## Dependencies between milestones

```
Sprint -1 ─► M0 ─► M1 ─► M2 ─► M3
              │      │
              │      └── Squad-OSS adapter (flag) ─► default in M2
              │
              └── Hand-rolled BuildSquad ─► fallback in M2 ─► retained in M3
```

## Roadmap risks

1. **Squad-OSS doesn't stabilise by M2.** Mitigation: hand-rolled BuildSquad is permanent fallback.
2. **TinyTroupe API break between M0 and M1.** Mitigation: pin version, contract tests, adapter shim.
3. **Multi-tenant Postgres RLS bugs.** Mitigation: dedicated security sprint pre-M2 with external pen test.
4. **Cost-per-venture creeps above target.** Mitigation: model-selection guidance per lab, cheaper-by-default routing, caching of research graphs.
5. **Provider-add time balloons.** Mitigation: the provider abstraction is tested by a `MockProvider` and a `ConformanceTest` suite that every new provider must pass.
