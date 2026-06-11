# Faceless CRM — reference scenario

A schema-valid fixture used to exercise the full VentureOS pipeline end-to-end
once implementations land. See [docs/faceless-crm-reference-scenario.md](../../docs/faceless-crm-reference-scenario.md) for the narrative.

Files
-----
- `brief.json` — `IdeaBrief` input. Validates against `packages/contracts/schema/idea-brief.json`.
- `expected-personas.json` — sample `PersonaSet` output of PersonaLab. Validates against `persona-set.json`.
- `expected-recommendation.json` — sample `Recommendation` output of VentureLab. Validates against `recommendation.json`.

Once the M1 implementations land, the e2e test will:
1. Load `brief.json`.
2. Generate a `PersonaSet` via `TinyTroupeAdapter` — fuzzy-match against `expected-personas.json`.
3. Build a `ResearchGraph` via `GraphifyAdapter`.
4. Produce a `Recommendation` — fuzzy-match against `expected-recommendation.json`.
5. Hand off to `BuildSquadAdapter` for scaffolding.

In Sprint 0, only schema validation runs.
