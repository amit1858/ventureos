# Sprint 1F — Graphify (Research & Knowledge Graph)

> Status: complete (TS path). Python adapter intentionally not implemented this
> sprint — see [Known follow-ups](#known-follow-ups).

## 1. Goal

Integrate Graphify as the research and knowledge graph layer for Foundry so
that ideas, evidence and counter-signals form a structured, queryable graph
the rest of the platform can ground itself on. VentureLab consumes this graph
**optionally** to adjust assumption confidence, competitive risk, market
clarity, differentiation, and to surface counter-signals — without making a
graph mandatory.

## 2. Architecture

```
Brief + notes + sources + personas + assumptions + risks
                 |
                 v
   GraphifyAdapter.buildResearchGraph
                 |
       ┌─────────┴─────────┐
       v                   v
  ONE LLM call         deterministic post-processing
  (graph extraction)   (merge, centrality, communities,
                       contradictions, provenance, stats)
                 |
                 v
         ResearchGraph (contract)
                 |
                 v
   VentureLab.analyze (optional)
   - applyResearchGraphAdjustments
   - applyScoreDeltas
   - extra evidence / counter-signals
```

Exactly **one** LLM call per `buildResearchGraph`. `addSource`, `queryGraph`,
`shortestPath`, `godNodes`, `view`, `evaluate` and `exportNeo4j` are pure
deterministic operations — they never call out. `exportNeo4j` returns the
Cypher string only; no network connection is opened.

## 3. Contract additions (`packages/contracts`)

`ResearchGraph` now includes (all back-compat with existing `stats` /
`godNodes`):

- `graphId`, `createdAt`
- `nodes: ResearchGraphNode[]` — types: `problem | persona | segment | competitor | feature | alternative | risk | assumption | market_signal | opportunity`
- `edges: ResearchGraphEdge[]` — types: `experiences | needs | competes_with | substitutes | blocks | enables | validates | contradicts | influences | depends_on`
- `sources: ResearchGraphSource[]` — kinds: `note | interview | web | file | persona_set | venture_assumption | venture_risk | brief`
- `contradictions: string[]`
- `ResearchGraphView` = `problem | customer | competitor | market | opportunity`
- `ResearchGraphQueryResult`, `ResearchGraphPath`, `ResearchGraphEvaluation`

Every node and edge carries `provenance: { sourceId, quote? }[]` so any UI
claim can be traced back to a verbatim source excerpt.

## 4. TS adapter (`@foundry/adapter-graphify`)

Location: `packages/adapters/graphify-ts/`.

Public surface:

```ts
class GraphifyAdapter {
  constructor(chat: ChatFn, opts: { model: string; ctx: CallContext; maxSourceChars?: number });
  buildResearchGraph(input: GraphifyInput): Promise<ResearchGraph>;
  addSource(graph: ResearchGraph, source: ResearchGraphSource & { text?: string }): ResearchGraph;
  queryGraph(graph: ResearchGraph, q: string, topK?: number): ResearchGraphQueryResult;
  shortestPath(graph: ResearchGraph, from: string, to: string): ResearchGraphPath | null;
  godNodes(graph: ResearchGraph, topK?: number): ResearchGraph['godNodes'];
  view(graph: ResearchGraph, view: ResearchGraphView): ResearchGraph;
  evaluate(graph: ResearchGraph): ResearchGraphEvaluation;
  exportNeo4j(graph: ResearchGraph): string; // pure Cypher, no I/O
}
```

`GraphifyInput` accepts `ventureId`, optional `brief`, free-text `notes`,
typed `sources`, plus `personas`, `assumptions` and `risks` — those last three
are projected into derived nodes with prefixed ids (`persona:`, `assumption:`,
`risk:`) so VentureLab can cross-reference them later.

The extractor prompt forbids `decision / score / recommendation` outputs to
keep Graphify a research layer, not a decision layer.

## 5. Evaluation axes

`evaluate` returns six normalised subscores plus warnings:

| Axis | Weight | Definition |
|---|---|---|
| Node relevance | 0.20 | Share of nodes with a non-empty label and known type |
| Edge usefulness | 0.20 | Share of edges with valid endpoints and a known type |
| Evidence coverage | 0.20 | Share of nodes with at least one evidence quote |
| Provenance coverage | 0.15 | Share of nodes and edges with at least one provenance entry |
| Contradiction detection | 0.10 | 1 if contradictions are detected when contradictory edge-pairs exist; 1 if no opportunity to detect |
| Density sanity | 0.15 | Edges-per-node within `[0.1, 4]` |

## 6. VentureLab integration

`packages/venturelab/src/research-graph.ts` — `applyResearchGraphAdjustments`
runs only when `input.researchGraph?.nodes?.length > 0`. Deterministic
heuristics (all bounded):

| Axis | Heuristic | Cap |
|---|---|---|
| differentiation | `- 2 × (competitor + alternative count)` | -8 |
| marketClarity | `+ 4 × (segment count)` when ≥1 market_signal node exists | +10 |
| executionRisk | `+ 4 × (contradiction count)` | +10 |

Assumption mapping (by canonical id `assumption:<id>` or label substring /
≥50% token overlap):

- Connected via `validates` edge → confidence steps up + risk steps down.
- Connected via `contradicts` edge → confidence steps down + risk steps up.

Up to 6 highest-confidence graph nodes appended to `evidence`. Up to 4
contradictions become `counterSignals` with `source: 'graph:contradiction:<i>'`.

Adjustments are **bounded** — Sprint 1F test 5 verifies a graph alone cannot
flip a `KILL` recommendation into `PROCEED`.

## 7. Web layer

- `apps/web/src/lib/graphify.ts` — BYOK runner. Mirrors `venturelab.ts`. The
  decrypted secret stays inside `withDecryptedSecret`; the route returns
  `{ok, data: ResearchGraph} | {ok, reason}`.
- `apps/web/src/app/api/graphify/build/route.ts` — POST endpoint.
  `runtime='nodejs'`, `dynamic='force-dynamic'`. Sanitises `sk-***` and
  `Bearer ***` from any error string and caps it at 500 chars.
- `apps/web/src/app/labs/research-graph/page.tsx` — pre-loaded with the
  Faceless CRM brief and notes; provider/model picker; nodes, edges, sources,
  god-nodes and contradictions panels; keyword query box (uses adapter
  `queryGraph` client-side over the returned graph); JSON export.

## 8. Faceless CRM fixtures

- `examples/faceless-crm/research-input.json` — the request payload (brief,
  notes, personas, assumptions, risks).
- `examples/faceless-crm/expected-research-graph.json` — the expected
  `ResearchGraph` shape (14 nodes, 15 edges, 12 sources, one detected
  contradiction). Used as a documentation reference, not a snapshot test —
  LLM outputs are not byte-stable.

## 9. Security invariants (verified)

- Tests assert serialised `ResearchGraph` contains no `sk-` or `Bearer `
  substrings.
- Web route sanitises any error string before returning.
- `exportNeo4j` returns a string; no network connection is opened anywhere
  in the adapter.
- No package outside `packages/adapters/graphify-py/` imports the Python
  `graphify` / `graphifyy` SDK; the TS adapter has no SDK dependency. Verified
  via `node scripts/check-import-boundaries.mjs`.

## 10. Exit criteria

- [x] `ResearchGraph` contract extended with nodes/edges/provenance and
  `ResearchGraphView` (5 views).
- [x] TS adapter implements `buildResearchGraph`, `addSource`, `queryGraph`,
  `shortestPath`, `godNodes`, `view`, `evaluate`, `exportNeo4j`.
- [x] 6-axis graph evaluation.
- [x] VentureLab optionally consumes a graph for assumption confidence,
  differentiation, marketClarity, executionRisk and counter-signals.
- [x] Web BYOK runner + API route + UI page.
- [x] Faceless CRM fixture pair.
- [x] No secrets leak to browser, logs, audit, or the serialised graph.
- [x] 16/16 graphify-ts tests pass; 26/26 venturelab tests pass.
- [x] `tsc -p apps/web/tsconfig.json --noEmit` clean.
- [x] `node scripts/check-import-boundaries.mjs` OK.

## 11. Known follow-ups

- **Python adapter (`packages/adapters/graphify-py`) remains stubbed.** The
  active web + VentureLab stack is TypeScript; the Python adapter shell is
  preserved for the future evaluation-runner path but its methods still raise
  `NotImplementedError`. Bringing it to parity is a dedicated sprint because
  it also needs a Python `ChatFn` abstraction.
- `pnpm` is not on PATH in the dev environment; workspace symlinks are
  emulated via Windows junctions. Running `pnpm install` will canonicalise
  them.
- Visual graph rendering (D3 / Cytoscape) is intentionally out-of-scope; the
  current page uses structured tables.
