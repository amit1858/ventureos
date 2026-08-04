# Foundry — Evaluation Framework

> Sprint −1 deliverable. How we measure whether the labs are producing useful output.

## 1. Why this matters

An LLM-native product that does not measure its own output quality has no defensible answer to the question **"Is your AI actually helping?"** Foundry produces artifacts that drive business decisions; we owe ourselves and our users a continuous evaluation harness.

Evaluation is also our regression net: when we bump TinyTroupe, change a prompt, swap a provider, or rewrite a lab, we need objective signal that quality didn't fall.

## 2. What we evaluate

Five artifact classes, each with its own scoring rubric:

| Artifact | Lab | What "good" looks like |
| --- | --- | --- |
| **PersonaSet** | PersonaLab | Personas are realistic, internally consistent, demographically appropriate for the brief, and behaviourally diverse. |
| **ResearchGraph** | VentureLab | The graph covers the relevant market entities, cites real sources, edges have appropriate confidence, no hallucinated entities. |
| **OpportunityScore + Recommendation** | VentureLab | Score is well-calibrated; rationale cites evidence; risks are real; the recommendation predicts the eventual real-world outcome. |
| **ValidationArtifacts** (interviews, focus groups, objection maps) | PersonaLab | Transcripts are coherent, on-topic, surface non-obvious objections; resemble real interview transcripts in blind A/B. |
| **BuildSquad artifacts** (PRD, architecture, stories, scaffold) | BuildSquad | PRD is implementable; architecture is internally consistent; stories are well-formed; scaffold compiles/lints. |

## 3. Three layers of evaluation

```
Layer 1: Intrinsic checks      — deterministic, every artifact, every run
Layer 2: LLM-as-judge          — sampled, every artifact kind, on every PR + nightly
Layer 3: Outcome calibration   — longitudinal, against real-world follow-ups
```

### Layer 1 — Intrinsic checks (cheap, fast, always on)

Per artifact kind, a battery of deterministic checks:

- **Schema validity** — passes JSON Schema. Score: pass/fail (1.0 / 0.0).
- **Structural completeness** — required fields are non-empty, lengths within bounds.
- **Citation coverage** — every quantitative claim in a Recommendation cites at least one ResearchGraph node; every objection in a focus-group summary references a transcript line.
- **Internal consistency** — persona attributes don't contradict (e.g., age 25 with "30 years experience"); architecture references modules that the PRD names.
- **Cost & latency** — within budget; flagged if anomalously high vs the artifact's class median.
- **Confidence-weighted graph claims** — Recommendation claims that lean on `INFERRED` or `AMBIGUOUS` edges are flagged with reduced confidence.

These checks are part of the artifact-write path. An artifact never enters `LIVE` state without them.

### Layer 2 — LLM-as-judge (sampled)

For each artifact kind, a separate **evaluator agent** (different model from the producer, ideally a different provider) scores the artifact on a published rubric.

Rubric pattern (consistent across kinds):

```
1. relevance       0–5  — does it answer the brief?
2. specificity     0–5  — concrete vs hand-wavy?
3. realism         0–5  — would an expert in the domain find this credible?
4. coverage        0–5  — completeness against the rubric's checklist
5. evidence_use    0–5  — does it cite the underlying evidence correctly?
6. risk_awareness  0–5  — does it surface what could go wrong?
Composite quality_score = weighted mean, normalised to 0..1.
```

Each artifact stores: rubric version, judge model, raw sub-scores, justification text. Reproducible.

**Cross-provider judging.** A producer running on Provider A is judged by Provider B (and rotated nightly). This catches in-family bias and surfaces provider drift.

**Self-consistency probes.** For PersonaSet and Recommendation, we additionally generate the artifact N times (N=3) with `seed`/temperature variation and measure inter-run agreement. High variance → low confidence.

### Layer 3 — Outcome calibration (the only one that really matters)

The platform asks users (with permission) to record outcomes:

- For ventures marked **Proceed**: did the MVP launch? Did it find PMF? Did any of the predicted risks fire?
- For **Pivot**: did the pivot land?
- For **Kill**: post-mortem — did they later confirm we were right?

Outcomes are joined with the original `Recommendation` artifact's predictions. Over time we report:

- **Calibration curve** — confidence vs realised outcome rate.
- **Risk hit rate** — % of called-out risks that materialised.
- **Persona accuracy** — opt-in users can replay synthetic interviews against real customer interviews on the same topic; we measure the overlap of objections surfaced.

This loop is slow (months of wall time), but it's the loop that determines whether Foundry is real.

## 4. Per-artifact scoring detail

### 4.1 PersonaSet quality

Intrinsic:
- All required demographic fields present.
- Distribution across personas matches the brief's demography (≤ 1 std-dev divergence on Profiler output).
- No two personas with identical attribute hashes.

Judge rubric:
- Realism (would a domain expert recognise these people?).
- Differentiation (are they meaningfully distinct?).
- Brief alignment (do they match the venture's target market?).
- Behavioural coherence (do their traits, goals, and beliefs hang together?).

Self-consistency:
- TinyTroupe's `TinyPersonValidator` score, normalised, included as one input.

### 4.2 ResearchGraph quality

Intrinsic:
- Node count and edge count within expected envelope.
- Confidence breakdown reported (target ≥ 60% `EXTRACTED` for quick mode, ≥ 40% for deep mode).
- Every cited URL was actually fetched (no hallucinated sources).
- God-node distribution is not pathological (no single hub > 30% of edges).

Judge rubric:
- Coverage of the obvious market entities for the brief.
- Plausibility of competitive relations (the judge is asked "name 3 missing competitors / technologies / regulations" — these become improvement issues).
- Absence of obviously hallucinated entities.

### 4.3 Recommendation quality

Intrinsic:
- Cites ≥ 5 graph nodes.
- References ≥ 3 transcript excerpts.
- Risk register has ≥ 3 distinct risks with severity/likelihood.
- Outputs Proceed/Pivot/Kill with a numeric confidence and explicit go-conditions.

Judge rubric:
- Are the cited evidence pieces actually relevant to the conclusion?
- Is the recommendation falsifiable (are the go-conditions measurable)?
- Are alternative interpretations considered?

Outcome calibration: the only true measure (Layer 3).

### 4.4 BuildSquad artifacts quality

Intrinsic:
- PRD has all required sections (problem, users, success metrics, scope, non-goals, risks).
- Architecture references ADRs for non-obvious decisions.
- User stories follow `As a … I want … so that …`; have acceptance criteria.
- Scaffold passes `lint` and `typecheck` in the target language.
- Repo provisioning succeeded; initial issues created from stories.

Judge rubric:
- PRD ↔ recommendation alignment.
- Architecture ↔ PRD alignment.
- Stories ↔ PRD alignment.

Build-and-run check (M2): the scaffold is automatically cloned, `npm install` / `pip install -e .` run, and a smoke test executed in a sandbox.

## 5. The evaluation harness (engineering view)

```
packages/eval/
  src/
    rubrics/            # one per artifact kind
    judges/             # llm-as-judge wrappers
    intrinsic/          # deterministic checks
    calibration/        # outcome join + reporting
    datasets/           # golden inputs + expected score envelopes
  tests/
```

- The harness is invocable as `pnpm eval --kind persona_set --artifact <id>` or via CI on every PR that touches a lab or a prompt.
- A nightly job evaluates a sampled slice of the past 24h of production artifacts. Results go to the eval dashboard.
- The harness has its own provider config (often pointing at the most capable available model regardless of cost — a separate budget line).

## 6. Datasets

| Dataset | Use |
| --- | --- |
| **Synthetic briefs** | 20 hand-curated `IdeaBrief`s spanning domains (B2B SaaS, consumer mobile, deep tech, services). Run end-to-end nightly. |
| **Golden personas** | 50 personas hand-validated by humans, used as references for persona judging. |
| **Real-interview corpus** | Opt-in user-supplied transcripts; used for blind A/B against synthetic transcripts. |
| **Recommendation outcomes** | Opt-in user-supplied outcomes 30/60/180 days after a venture decision. |
| **Public scaffold corpus** | Repos labelled by domain; used to compare BuildSquad scaffolds against typical real scaffolds in that domain. |

## 7. CI gates

- **Block merge** if any artifact kind's mean `quality_score` on the golden brief set drops more than 0.05 from baseline.
- **Block merge** if any intrinsic check newly fails on a previously passing artifact.
- **Warn** if cost-per-artifact rises more than 25% vs baseline.
- **Warn** if cross-provider judge disagreement exceeds threshold (signals over-fitting to one provider).

## 8. Anti-cheating

LLM-as-judge can be gamed. We mitigate:

- **Judge ≠ producer** — different model, ideally different provider.
- **Rotation** — the judging model is rotated nightly across the configured pool.
- **Hold-out** — 10% of judging happens with a model that the producer's prompt has never seen during development.
- **Human spot checks** — weekly, a random 1% sample is human-rated; correlation with judge scores tracked.

## 9. Persona-realism A/B (specific protocol)

For consenting users:

1. They supply a real interview transcript on a topic.
2. We generate a synthetic transcript with PersonaLab on the same topic, with a persona matched to the real interviewee's profile.
3. Both are de-identified and shown to a panel of evaluators (LLM judges + occasional humans) who score on a rubric.
4. We report the **realism gap** — average score delta — per domain over time.

This is the single most powerful signal of whether PersonaLab is improving.

## 10. Recommendation calibration plot

The flagship public metric. On the eval dashboard:

```
Y-axis: realised outcome rate (e.g., % of "Proceed" that reached PMF)
X-axis: predicted confidence band (0.5–0.6, 0.6–0.7, ...)
A perfect platform sits on the y=x line.
```

We publish this quarterly to design partners and (after M2) on a public trust page. Honest calibration is the moat.

## 11. Costs

Evaluation isn't free. Defaults:

- Intrinsic: zero LLM cost.
- LLM-judge sampling: 10% of artifacts at M1, 25% at M2, on PR + nightly. All artifacts at M3 for high-value classes (Recommendation, PRD).
- Self-consistency probes: only on Recommendation (high stakes), only on user opt-in or for golden dataset.

Eval budget is its own line item in the cost meter, tagged `tenant_id=PLATFORM` so it doesn't hit user budgets.

## 12. What we explicitly do **not** measure (yet)

- "User happiness" via thumbs up/down — too noisy at our scale; revisit at M3.
- Aesthetic quality of generated documents — subjective; rely on user feedback.
- Bias in personas at scale — committed to as a dedicated workstream at M2; not in the v1 harness.

## 13. Headline metrics we report internally each week

1. PersonaSet `quality_score` (median, p10) by domain.
2. ResearchGraph `EXTRACTED` confidence ratio by mode.
3. Recommendation calibration error vs golden outcomes.
4. PRD↔Recommendation alignment score.
5. Cost-per-end-to-end-venture (median, p90).
6. Provider failover rate.
7. Eval CI block rate (signals churn).
