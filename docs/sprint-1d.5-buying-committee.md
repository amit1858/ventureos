# Sprint 1D.5 — Agentic Buying Committee

## What changed

The buying committee in PersonaLab no longer ships a single LLM call followed
by keyword-based stance aggregation. It now runs a **four-phase multi-agent
deliberation** where each phase's output becomes input to the next:

1. **Initial positions** — each participant states their starting position
   (`support` | `support_with_concerns` | `pilot_first` | `reject`), enthusiasm,
   concerns, willingness to adopt, and rationale.
2. **Challenges** — participants challenge one another's positions on a
   specific topic (`assumption`, `pricing`, `onboarding`, `roi`, `workflow`,
   `trust`, `other`).
3. **Responses** — each challenged participant defends their position or
   changes their mind, flagged via `changedOpinion`.
4. **Consensus & decision** — final positions, opinion changes, unresolved
   objections, strongest supporting/opposing arguments, what would change
   minds, consensus level, confidence, decision, decision rationale, next
   steps.

The committee `decision` is now a direct consequence of the consensus phase,
not a keyword tally over loose utterances.

## Affected packages

- `@foundry/contracts` — additive new types
  (`BuyingCommitteeDeliberation`, `ParticipantOpinion`, `CommitteeChallenge`,
  `CommitteeResponse`, `OpinionChange`, `BuyingCommitteeEvaluation`).
  `BuyingCommitteeTranscript` gained an OPTIONAL `deliberation` field for
  back-compat with Sprint 1D.
- `@foundry/personalab`
  - `orchestrator.ts` — `runBuyingCommittee` now performs 4 sequential
    `ChatFn` calls; legacy `members[]` is derived from the final consensus
    positions via a structural mapping, not keyword scoring.
  - `prompts.ts` — adds `bcInitialPositionsPrompt`, `bcChallengePrompt`,
    `bcResponsePrompt`, `bcConsensusPrompt`.
  - `evaluation.ts` — adds `evaluateBuyingCommittee(deliberation)` with
    scores for diversity of viewpoints, challenge quality, objection quality,
    opinion movement, and consensus strength.
- `apps/web` — `CommitteePanel` now renders a collapsible `DeliberationPanel`
  with per-phase sections, opinion-change badges, and the
  "what would change minds" list.
- `packages/adapters/tinytroupe-py` — `run_buying_committee` was restructured
  to broadcast each phase as a discrete `world.broadcast` + `world.run(1)`
  round, then extract the structured deliberation from per-phase utterances.
  Keyword scoring is retained only as a STRUCTURAL parser to map an agent's
  free-form text to one of the four positions, not to aggregate the decision.

## Backward compatibility

- Existing callers that read `members`, `decision`, `decisionRationale`,
  `nextSteps` from `BuyingCommitteeTranscript` keep working unchanged.
- `deliberation` is optional on the transcript; pre-Sprint-1D.5 fixtures
  remain valid.
- The legacy single-shot `buyingCommitteePrompt` export is retained for
  consumers that built their own pipelines on top of it.

## Cost note

`runBuyingCommittee` now issues **four** chat calls instead of one. With
`gpt-4o-mini`-class models and a 2-participant committee, the total stays
well inside a normal experimental session's budget; for larger committees
or flagship models, host integrations should consider batching multiple
committee evaluations off the synchronous request path.

## Tests

- `packages/personalab/tests/personalab.test.ts` — 26 tests
  (10 new tests cover phased call ordering, cross-phase prompt threading,
  disagreement, opinion changes, unresolved objections, consensus level
  derivation, back-compat member derivation, and the evaluation helper).
- `packages/adapters/tinytroupe-py/tests/test_adapter.py` — 13 tests pass
  unchanged against the new phased implementation.
