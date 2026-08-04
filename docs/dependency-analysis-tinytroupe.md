# Dependency Analysis — TinyTroupe

> Source: https://github.com/microsoft/TinyTroupe · License: MIT · Latest analysed: v0.7.0 · Language: Python 3.10+

## 1. Purpose

TinyTroupe is Microsoft Research's LLM-powered **multi-agent persona simulation framework** for business analytics. It is positioned distinctly from generative-agent "games" (entertainment) and from task-automation frameworks (AutoGen, CrewAI). Its goal is to **understand human behaviour** through programmatically defined synthetic personas placed in structured environments, then extract analyzable signal from their interactions.

Primary use cases endorsed by the project: advertisement evaluation, software testing, synthetic data generation, market research (focus groups, surveys), product feedback, brainstorming.

This maps almost perfectly onto **PersonaLab's** mandate.

## 2. Core concepts

| Concept | Class | Role |
| --- | --- | --- |
| Persona | `TinyPerson` | A simulated individual with persona spec, episodic + semantic memory, mental state, mental faculties. Receives stimuli (`listen`, `see`, `think`), produces actions (`act`). |
| Environment | `TinyWorld`, `TinySocialNetwork` | Orchestrates interactions among personas. `TinySocialNetwork` is the focus-group/interview substrate. |
| Factory | `TinyPersonFactory` | Programmatically generates personas from a demography spec; supports parallel population generation with a seeded RNG. |
| Memory | `EpisodicMemory`, `SemanticMemory`, `EpisodicConsolidator` | Two-tier memory; episodes consolidated into semantic engrams via LLM. |
| Faculty | `TinyMentalFaculty`, `TinyToolUse`, `FilesAndWebGroundingFaculty` | Pluggable cognitive abilities and tools the persona can wield. |
| Extraction | `ResultsExtractor`, `ResultsReducer`, `ResultsReporter`, `ArtifactExporter` | Structured-result extraction from agent interactions; markdown/json/docx export. |
| Experimentation | `Proposition`, `ABRandomizer`, `StatisticalTester` | LLM-graded proposition scoring; A/B; classical statistical tests. |
| Validation | `TinyPersonValidator`, `SimulationExperimentEmpiricalValidator` | Behavioural consistency and empirical (vs real data) validation. |
| Control | `tinytroupe.control` | Simulation checkpointing and global cost stats. |

## 3. Internal architecture (essentials)

- **Personas** are JSON-definable (`*.agent.json`) or built programmatically with `TinyPerson.define(...)`. Reusable **fragments** (`*.agent.fragment.json`) compose traits.
- **Action loop**: stimuli → `ActionGenerator` (LLM call) → action object (`TALK`/`THINK`/`LISTEN`/`SEE`/`DONE`) → environment routing. Quality-check passes (similarity, suitability) prevent loops.
- **Memory**: episode buffer fills up; at `MAX_EPISODE_LENGTH` (default 15) it consolidates into semantic memory via LLM. Semantic memory is engram-based with semantic retrieval.
- **Prompting**: Mustache templates (`prompts/tiny_person.v2.mustache`) compose persona + mental state + recent memory.
- **LLM client**: a single `tinytroupe.openai_utils` / `tinytroupe.clients` module — OpenAI or Azure OpenAI. Ollama is experimental.
- **Caching**: hash-based JSON cache of LLM responses (`CACHE_API_CALLS=True`), plus simulation checkpointing (`control.begin/checkpoint/end`).

## 4. APIs (representative)

Agent: `listen`, `see`, `think`, `act(until_done=True)`, `listen_and_act`, `retrieve_memories`, `consolidate_episode_memories`.
World: `TinyWorld(...).run(steps)`, `broadcast`, `encode_complete_state` / `decode_complete_state`.
Factory: `TinyPersonFactory(context)`, `create_factory_from_demography(...)`, `generate_people(n, parallelize=True)`.
Extraction: `ResultsExtractor(extraction_objective, fields).extract_results_from_world(world)`; `ResultsReporter.report_from_interactions(...)`.
Experimentation: `Proposition(...).check(target)`, `validate_simulation_experiment_empirically(...)`.
Control: `control.begin("sim.cache.json")`, `control.checkpoint()`, `control.end()`.

## 5. Extension points

- Subclass `TinyWorld` / `TinySocialNetwork` for custom environments.
- Subclass `TinyPersonFactory` to inject custom sampling or non-LLM data sources (e.g., panel data).
- Implement `TinyMentalFaculty` for new abilities (e.g., a `MarketResearchFaculty` that calls an internal data API).
- Implement `TinyTool` for tool use.
- Custom `ResultsExtractor` instances with domain-specific fields and prompts.
- Mustache template override for prompt customisation.

## 6. Configuration

`config.ini` sections: `[OpenAI]` (API_TYPE, MODEL, TEMPERATURE, MAX_TOKENS, EMBEDDING_MODEL, REASONING_MODEL), `[Azure]` (deployment, endpoint, key), `[Simulation]` (cache, consolidation toggles, episode lengths), `[Cognition]` (action-generator quality flags), `[Logging]`. Programmatic override via `config_manager.update(...)`. Environment variables: `OPENAI_API_KEY`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_ENDPOINT`.

## 7. Limitations & risks

| Concern | Detail | Impact on Foundry |
| --- | --- | --- |
| **Single-process, GIL-bound** | `TinyWorld.run` is sequential; parallelism only at factory population generation. | Scaling focus groups is hard; we will shard at the venture-job level (one worker per simulation), not within a simulation. |
| **OpenAI-default LLM client** | Provider abstraction is shallow; Anthropic and Gemini are not first-class. | We must replace its client with our provider layer (see §10 below). This is a real fork-or-monkeypatch decision. |
| **Process-global singletons** | `control.current_simulation`, `config_manager`, LLM cache are process-wide. | Multiple ventures **cannot** run in the same process safely. One TinyTroupe simulation per worker process. |
| **Token cost** | No native budget caps; long episodes are expensive. | Wrap every TinyTroupe call in our budget-enforcing provider layer; cap episode lengths aggressively. |
| **API instability** | README explicitly says "WORK IN PROGRESS." | Pin exact version; contract tests; vendor a fork if upstream stalls. |
| **No multitenancy** | Caches and config are global. | Subprocess isolation per venture is required from day one. |
| **Persona realism is LLM-dependent** | Garbage in, garbage out. | Mandatory empirical validation harness (see [evaluation-framework.md](evaluation-framework.md)). |
| **Jupyter-first design** | Many examples are notebook-shaped; some utilities print to console. | Capture stdout, route through structured logging; treat notebooks as docs, not production paths. |
| **Content filtering** | None except via Azure content filter when using Azure API. | We add output filtering at the platform layer. |

## 8. License & maintenance

- **MIT** — permissive, suitable for commercial embedding with attribution.
- Microsoft-backed; 4 active maintainers; recent releases (vision modality in v0.7.0).
- Frequent minor releases; semver not strictly observed pre-1.0.

## 9. Recommended Foundry integration strategy

**Role:** PersonaLab's persona generation, focus groups, 1:1 interviews, stakeholder simulations, buying-committee simulations, and survey-style data collection.

**Integration shape:**

1. **Wrap, do not fork (initially).** TinyTroupe is consumed via a `TinyTroupeAdapter` (Python package) sitting in `packages/adapters/tinytroupe/`. The adapter is the only code in Foundry that imports `tinytroupe.*`.
2. **Subprocess isolation per venture.** Each PersonaLab simulation runs in its own worker process. This sidesteps TinyTroupe's process-global state and lets us run many ventures concurrently across a worker pool.
3. **Replace the LLM client.** TinyTroupe's `openai_utils` is monkey-patched (or, preferably, a small upstream PR adds a client-injection hook) so that all model calls flow through our `ProviderClient`. This single change is what makes BYOK real for PersonaLab.
4. **Define our own persona schema.** Our `PersonaSet` JSON schema in `packages/contracts/` is the canonical format. The adapter converts to/from `.agent.json` at the boundary. We never let TinyTroupe's evolving persona format become our wire format.
5. **Use TinyTroupe's primitives, our orchestration.** We use `TinyPerson`, `TinyWorld`, `TinySocialNetwork`, `TinyPersonFactory`, `ResultsExtractor` — but the simulation script (which questions, in which order, with which fan-out) is Foundry code.
6. **Run validators by default.** `TinyPersonValidator` and `Proposition` are invoked on every generated persona and every focus-group transcript; the score becomes the artifact's `quality_score`.
7. **Cache responsibly.** Disable TinyTroupe's local file cache; substitute our tenant-scoped Redis cache via the provider layer (so cache hits are auditable and isolated).
8. **Per-job budget injection.** The adapter passes a `BudgetGuard` into the simulation that aborts at the next provider-call boundary if exceeded.
9. **Vendor-fork escape hatch.** A `vendor/tinytroupe/` slot exists in the repo (empty at M0). If upstream breaks us hard, we vendor and patch under a clear ADR.

**Concrete adapter surface (sketch):**

```python
# packages/adapters/tinytroupe/src/foundry_tinytroupe/adapter.py
class TinyTroupeAdapter:
    def __init__(self, provider: ProviderClient, budget: BudgetGuard, tenant_id: str): ...

    def generate_personas(self, brief: IdeaBrief, n: int,
                          demography: Demography | None = None) -> PersonaSet: ...

    def run_interview(self, persona: Persona,
                      script: InterviewScript) -> Transcript: ...

    def run_focus_group(self, personas: list[Persona],
                        script: FocusGroupScript) -> FocusGroupResult: ...

    def run_buying_committee(self, committee: list[Persona],
                             scenario: BuyingScenario) -> BuyingCommitteeResult: ...

    def extract(self, world_or_transcripts, fields: list[str]) -> dict: ...

    def validate_persona(self, persona: Persona) -> ValidationScore: ...
```

**What we will NOT use from TinyTroupe (yet):**

- The Jupyter widgets — replaced by our web UI.
- `TinyWordProcessor` and `TinyCalendar` — we have no use for simulated office tools at M0–M2.
- Built-in artifact exporters — our `ArtifactStore` handles persistence.

**Migration / fork criteria (ADR trigger):**

We fork upstream into `vendor/tinytroupe/` if **any** of the following:

- An upstream release breaks our adapter contract twice in a quarter.
- Upstream rejects (or has not responded in 60 days to) a needed client-injection PR.
- A required feature (e.g., per-call provider override, structured logging) is missing and unlikely to land.

Otherwise, we stay on the upstream PyPI / git release pinned by exact version.

## 10. Risks specific to Foundry embedding (ranked)

1. **Provider-injection brittleness.** Monkeypatching `openai_utils` is fragile across upstream refactors. Mitigate with a small upstream PR + a contract test that runs on every TinyTroupe version bump.
2. **Cost explosion in long focus groups.** Hard cap `MAX_EPISODE_LENGTH`, set per-job budget, enforce in provider layer.
3. **Persona quality drift between versions.** Validator scores and recommendation calibration over time will surface regressions; pin model+prompt-template versions in the artifact metadata.
4. **Process-global state leakage.** Strict one-simulation-per-process discipline. CI test that asserts this.
5. **Schema churn at the persona layer.** Our `PersonaSet` schema is the contract; adapter translation absorbs upstream churn.

## 11. Decision summary

- **Adopt** TinyTroupe as PersonaLab's primary engine, wrapped via adapter.
- **Pin** exact version; **contract-test** on every bump.
- **Subprocess-isolate** per venture.
- **Inject** our provider client.
- **Canonicalise** our own persona schema, not TinyTroupe's.
- **Plan** for fork-and-vendor as a documented escape hatch.
