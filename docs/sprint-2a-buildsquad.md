# Sprint 2A — BuildSquad (Planning Artifacts)

> Status: complete. No code generation, no GitHub export, no Squad-OSS yet.

## 1. Goal

Turn a validated `VentureRecommendation` (+ optional personas, research graph,
brief) into a build-ready **planning** artifact pack. PersonaLab understands
the user, VentureLab decides whether to build, Graphify structures the
evidence — BuildSquad now decides **what** to build.

## 2. Branching

```
VentureRecommendation.decision
        │
        ├─ PROCEED → drafting LLM call + critique LLM call → full artifact pack
        ├─ PIVOT   → single pivot LLM call → pivot brief only
        └─ KILL    → 0 LLM calls; deterministic kill output only
```

At most **two** LLM calls per PROCEED run, **one** per PIVOT, **zero** per
KILL. Every LLM failure has a deterministic fallback so the UI never shows a
blank pack.

## 3. Agents

| Role | Owns during drafting | Reviews during critique |
|---|---|---|
| PM | product_vision, prd.goals/non-goals, mvp_scope tradeoffs | mvp_scope, roadmap, user_stories |
| UX | prd.userJourneys, prototype_brief.flows | user_stories, prototype_brief |
| Architect | architecture_brief.components/data_flow/storage | mvp_scope, architecture_brief |
| Backend | non-functional requirements, integrations | architecture_brief, prd |
| Frontend | prototype_brief.pages, ui_components | prototype_brief, user_stories |
| QA | acceptance-criteria specificity, edge cases | user_stories |
| GTM | product_vision.differentiation/successMetrics | product_vision, roadmap |

Each charter ships with a stable **checklist** that the deterministic
critique pass runs against the draft — these critiques are merged with the
LLM critiques so the review never returns empty.

## 4. Contract additions (`packages/contracts`)

New types in [packages/contracts/src/types.ts](packages/contracts/src/types.ts):

- `BuildSquadArtifactPack` (top-level) with mode-dependent optional sections.
- `BuildSquadProductVision`, `BuildSquadPRD` (+ `Requirement`, `Journey`),
  `BuildSquadMVPScope`, `BuildSquadUserStory`, `BuildSquadArchitectureBrief`,
  `BuildSquadRoadmap` (+ `Week`), `BuildSquadPrototypeBrief`.
- `BuildSquadAgentCritique`, `BuildSquadKillOutput`, `BuildSquadPivotOutput`,
  `BuildSquadInputReferences`.
- `BuildSquadArtifactEvaluation` (five axes + warnings + overallScore).

## 5. Package (`@foundry/buildsquad`)

Location: `packages/buildsquad/`.

Public surface:

```ts
class BuildSquad {
  constructor(chat: ChatFn, opts: { model: string; ctx: CallContext; ... });
  run(input: BuildSquadInput): Promise<BuildSquadArtifactPack>;
}
```

Sibling exports:

- `BUILDSQUAD_AGENTS`, `BUILDSQUAD_AGENT_BY_ROLE`.
- `normalizeDraft` / per-section normalisers.
- `runDeterministicCritiqueChecks`, `mergeCritiques`, `normalizeCritiques`.
- `buildKillOutput`, `buildKillVisionStub`, `normalizePivot`,
  `deterministicPivotBrief`, `buildPivotVisionStub`.
- `evaluateArtifactPack`.

`BuildSquadError` is thrown when the drafting LLM call fails on the PROCEED
path (everything else falls back deterministically).

## 6. Evaluation

`evaluateArtifactPack(pack)` returns five normalised subscores plus warnings:

| Axis | Weight | Definition |
|---|---|---|
| Completeness | 0.30 | Required sections populated for the active mode |
| Story quality | 0.20 | Must-priority stories have ≥2 acceptance criteria |
| Scope discipline | 0.20 | must / should / later + explicit cuts present |
| Architecture coverage | 0.15 | Security + storage + integrations populated |
| Critique quality | 0.15 | Critiques reference real sections with severities |

## 7. Web layer

- [apps/web/src/lib/buildsquad.ts](apps/web/src/lib/buildsquad.ts) — BYOK
  runner. Mirrors VentureLab/Graphify. The decrypted secret stays inside
  `withDecryptedSecret`.
- [apps/web/src/app/api/buildsquad/route.ts](apps/web/src/app/api/buildsquad/route.ts)
  — `runtime='nodejs'`, `dynamic='force-dynamic'`. Sanitises `sk-***` /
  `Bearer ***` in any returned error, caps at 500 chars.
- [apps/web/src/app/labs/buildsquad/page.tsx](apps/web/src/app/labs/buildsquad/page.tsx)
  — provider picker, JSON inputs for `VentureRecommendation` and (optional)
  `ResearchGraph`, full artifact pack view, agent critique table colour-coded
  by severity, JSON export, markdown copy.

## 8. Faceless CRM fixture

[examples/faceless-crm/expected-buildsquad-pack.json](examples/faceless-crm/expected-buildsquad-pack.json)
— a reference PROCEED artifact pack (5 must-stories, 5 architecture
components, 4-week roadmap, 7 critiques, 3 explicit cuts). Used as
documentation, not a snapshot test — LLM outputs are not byte-stable.

## 9. Security invariants (verified)

- Tests assert serialised `BuildSquadArtifactPack` contains no `sk-` or
  `Bearer ` substrings.
- Web route sanitises any error string before returning.
- The decrypted secret never leaves `withDecryptedSecret`.
- KILL path proves **zero** LLM calls (`expect(chat).not.toHaveBeenCalled()`).
- Import boundaries clean: BuildSquad does not depend on any provider SDK
  directly; the chat function is injected by the web runner.

## 10. Exit criteria

- [x] BuildSquad generates artifact packs.
- [x] Agent charters exist (7 roles, each with checklist + review sections).
- [x] Cross-agent critique exists (LLM + deterministic, merged).
- [x] PROCEED / PIVOT / KILL paths handled distinctly.
- [x] BuildSquad UI exists at `/labs/buildsquad`.
- [x] Faceless CRM artifact pack fixture exists.
- [x] 12/12 buildsquad tests pass; 26/26 venturelab; 16/16 graphify-ts.
- [x] `tsc -p apps/web --noEmit` clean.
- [x] `node scripts/check-import-boundaries.mjs` OK.

## 11. Non-goals (preserved)

- No GitHub repo creation.
- No application code generation.
- No Squad-OSS integration.
- No visual prototyping canvas.
- BYOK never bypassed.

## 12. Known follow-ups

- A Python BuildSquad adapter is not in scope; the active stack is TS.
- The web page accepts pasted JSON for the `VentureRecommendation`; a future
  sprint should let the user pick a stored recommendation from a list.
- `BUILDSQUAD_AGENTS` could grow per-tenant overrides in a future sprint
  (e.g. swap GTM-Agent for an Enterprise-Sales-Agent in B2B tenants).
