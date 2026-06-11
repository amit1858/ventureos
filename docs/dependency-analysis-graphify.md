# Dependency Analysis — Graphify

> Source: https://github.com/safishamsi/graphify · License: MIT · Latest analysed: v0.8.25 · Language: Python 3.10+ · PyPI: `graphifyy`

## 1. Purpose

Graphify transforms folders of mixed-format content (code, docs, PDFs, images, video transcripts, URLs) into a **queryable knowledge graph**. Originally positioned as an IDE-assistant skill (Claude Code, Cursor, Codex), it ships as a Python library + CLI + optional MCP stdio server.

For VentureOS, Graphify is the **research engine** behind VentureLab — the thing that takes a raw idea plus a corpus of URLs/PDFs and produces a structured, citation-bearing graph of market entities, competitors, technologies, regulations, and the relationships among them. That graph is then the substrate for opportunity scoring and recommendation rationale.

## 2. Core concepts

| Concept | Detail |
| --- | --- |
| **Node** | `{id, label, source_file, source_location, file_type, community, degree}`. `file_type ∈ {code, document, paper, image, rationale}`. |
| **Edge** | `{source, target, relation, confidence}`. `relation` is open-vocabulary (`calls`, `imports`, `references`, `cites`, `relates_to`, ...). |
| **Confidence** | `EXTRACTED` (direct from source), `INFERRED` (LLM/algorithmic deduction), `AMBIGUOUS` (flagged for review). |
| **Community** | Leiden clustering assigns a `community` integer per node. |
| **God node** | Top-degree nodes — surfaced for "core abstractions" reports. |
| **Surprising connection** | Cross-community edges ranked by unexpectedness. |

Graph backend: **NetworkX in-memory** by default. Optional Neo4j push for persistence. No required server.

## 3. Internal architecture (pipeline)

```
detect(path) → extract() → build_graph() → cluster() → analyze() → report() → export()
```

- **Detect** — recursive walk, `.graphifyignore` honoured, symlink-safe (`followlinks=False`), files classified by extension.
- **Extract** — splits into:
  - *Structural* (code): tree-sitter AST (33+ languages), **no LLM calls, free**, ProcessPoolExecutor parallelised.
  - *Semantic* (docs/PDF/images/video): LLM-based extraction in 60k-token chunks; video via local faster-whisper transcription, then LLM.
- **Build** — merge into a NetworkX `MultiDiGraph`; optional LLM-based deduplication (`--dedup-llm`).
- **Cluster** — Leiden via graspologic; `--resolution`, `--exclude-hubs` flags.
- **Analyze** — god nodes, surprising connections, suggested questions, confidence breakdown.
- **Report** — `GRAPH_REPORT.md` markdown summary with audit and cost.
- **Export** — `graph.json` (node-link), `graph.html` (vis.js), SVG, GraphML, Cypher, Neo4j direct push, Obsidian vault, Markdown wiki.

LLM providers supported: Anthropic (default), Gemini, OpenAI, DeepSeek, Kimi, Ollama, AWS Bedrock, Claude Code CLI. Selected via `--backend`. Token budget controlled by `GRAPHIFY_MAX_OUTPUT_TOKENS` / `--token-budget`. Per-request timeout via `GRAPHIFY_API_TIMEOUT`.

## 4. APIs

**CLI** (≈30 commands):
- `graphify extract <path> [--backend X] [--mode deep] [--update] [--no-viz]`
- `graphify query "<question>" [--dfs] [--budget N]`
- `graphify path "X" "Y"`
- `graphify explain "NodeLabel"`
- `graphify affected "X"`
- `graphify export {html|svg|graphml|neo4j|obsidian|wiki} [--push bolt://...]`
- `graphify add <url>` — fetch and merge a URL into the graph
- `graphify serve <graph.json>` — start MCP stdio server

**Python library**:

```python
from graphify.detect import collect_files
from graphify.extract import extract
from graphify.build  import build_from_json
from graphify.cluster import cluster
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.export import to_json, to_html, push_to_neo4j
```

**MCP stdio server** (10 tools): `query_graph`, `get_node`, `get_neighbors`, `shortest_path`, `god_nodes`, `graph_stats`, `get_community`, plus PR-triage helpers. Resources: `graphify://report`, `graphify://stats`, `graphify://god-nodes`, `graphify://surprises`, `graphify://audit`, `graphify://questions`.

## 5. Extension points

- New language support: add an `extract_<lang>()` function + register tree-sitter package.
- New export format: add `to_<format>()` in `export.py`.
- New analysis algorithm: add to `analyze.py`.
- Prompt tuning: edit skill files (`SKILL.md`); no formal plugin API.
- LLM backend: pluggable via `--backend`; new providers require code change in `graphify/llm.py`.

## 6. Limitations & risks

| Concern | Detail | Impact on VentureOS |
| --- | --- | --- |
| **In-memory NetworkX** | Default backend; 100k node hard cap; HTML viz skipped above 5k. | Sufficient per-venture; we use `--neo4j-push` (or `graph.json` in object store) for persistence across sessions. |
| **No native multi-tenancy** | Single-user per graph; no auth on MCP server. | We never expose the MCP server externally. We invoke Graphify per-venture in a sandboxed worker, then persist `graph.json` to the tenant's object-store prefix. |
| **LLM lock-in is loose but real** | Switching providers re-runs extraction at cost. | We pick a provider per venture (the tenant's default) and re-use cached extractions for incremental updates. |
| **Prompt-injection surface in research ingest** | Untrusted URLs feed an LLM with extraction prompts. | Egress allowlist at M2; fence untrusted text; never auto-execute model output. |
| **Single primary author** | Bus factor ≈ 1, despite 70 contributors. | Pin version; treat fork-and-vendor as a near-term contingency, not a theoretical one. |
| **Pre-1.0 churn** | ~1 release/day; 120+ releases; semver-ish. | Pin exact PyPI version (`graphifyy==0.8.25`); contract tests on every bump. |
| **No formal plugin API** | Customisation = fork or wrap. | Wrap via adapter; never edit upstream in place. |
| **Static graphs** | No temporal queries, no versioning beyond git. | We model versioning at the artifact layer: every research-graph rebuild is a new `Artifact` with `parent_id`. |
| **Cost on semantic extraction** | LLM-charged per chunk. | Budget-guard via provider layer; default ingest depth capped; `--mode deep` requires explicit opt-in. |
| **Tree-sitter native code** | Many native parsers in the dependency tree. | Run extraction in a sandboxed worker; never on untrusted code in shared memory with platform secrets. |
| **Path-traversal in MCP server** | Mitigated upstream by `validate_graph_path`. | We don't expose MCP server; consume only the library. |

## 7. License & maintenance

- **MIT**.
- Created ~April 2026; ~120 releases by report date; very active.
- Y Combinator S26 company (Penpax is the commercial product).
- ⚠️ Single primary author; commercial parent could pivot/sunset the open-source tier. MIT means we can fork.

## 8. Recommended VentureOS integration strategy

**Role:** VentureLab's research-graph builder and the citation substrate for every opportunity score and Go/Pivot/Kill rationale.

**Integration shape:**

1. **Library only — never the server, never the CLI in production.** We import `graphify.*` from a Python adapter `packages/adapters/graphify/`.
2. **Inject our provider client.** Graphify's `graphify/llm.py` dispatcher is replaced (via a thin shim or upstream PR) with a function that delegates to our `ProviderClient`. All BYOK rules apply.
3. **Two-mode ingest.**
   - **Quick mode** (default for M0/M1): a curated, small URL list seeded by an upstream "research scout" agent that does targeted web search. Bounded cost.
   - **Deep mode** (opt-in, M2): full corpus ingest with `--mode deep`, larger token budget, longer wall time, explicit user confirmation.
4. **Per-venture sandbox.** Each research job runs in its own worker process, in a per-job temp directory; outputs are uploaded to object store under `tenants/{tenant_id}/ventures/{venture_id}/research/{artifact_id}/graph.json`. Working directory is destroyed after upload.
5. **Persistence.** `graph.json` is the canonical artifact. For interactive queries during a venture session, we either reload it into NetworkX in the worker or push to a per-tenant Neo4j namespace (M3, regulated tenants).
6. **Citations are first-class.** Every `Recommendation` artifact references graph node IDs and edge IDs by their stable `id` strings. Our recommendation evaluator validates that every claim cites at least one EXTRACTED-confidence edge.
7. **Confidence is surfaced to the user.** The UI distinguishes EXTRACTED / INFERRED / AMBIGUOUS edges, and the opportunity-score computation weights them differently (see [evaluation-framework.md](evaluation-framework.md)).
8. **Sanitise extracted labels.** Already done upstream (`sanitize_label`), but we re-validate at the artifact-write boundary to protect against any upstream regression.
9. **Incremental updates.** Use Graphify's `--update` semantics for re-runs (e.g., the user adds a new URL via "ingest this"). Tenant-scoped cache, never shared.

**Concrete adapter surface (sketch):**

```python
# packages/adapters/graphify/src/ventureos_graphify/adapter.py
class GraphifyAdapter:
    def __init__(self, provider: ProviderClient, budget: BudgetGuard,
                 tenant_id: str, workdir: Path): ...

    def build_research_graph(self, brief: IdeaBrief,
                             seed_urls: list[str],
                             mode: Literal["quick", "deep"] = "quick"
                            ) -> ResearchGraph: ...

    def add_source(self, graph: ResearchGraph, url_or_file: str) -> ResearchGraph: ...

    def query(self, graph: ResearchGraph, question: str,
              budget_tokens: int = 1500) -> QueryResult: ...

    def shortest_path(self, graph: ResearchGraph, a: str, b: str) -> Path | None: ...

    def god_nodes(self, graph: ResearchGraph, top_n: int = 10) -> list[Node]: ...

    def export_neo4j(self, graph: ResearchGraph, target_uri: str) -> None: ...  # M3
```

**What we will NOT use from Graphify (yet):**

- The MCP server (we don't expose it).
- The HTML visualisation (we render our own).
- Code-AST extraction (no use case in VentureLab — we're not ingesting code in M0–M2).
- The Obsidian / wiki exporters (we have our own artifact viewer).

**Fork-and-vendor triggers (ADR):**

- Upstream removes or breaks the LLM dispatcher seam twice.
- Upstream goes silent for 60+ days with critical bugs unaddressed.
- The commercial parent (Penpax) relicenses or restricts the open-source tier.

## 9. Risks specific to VentureOS embedding (ranked)

1. **Single-author dependency.** Most operationally significant risk. Mitigate via pinned version, vendor slot, and a quarterly "can we still build a graph offline?" drill.
2. **LLM-cost surprise on deep ingest.** Gate behind explicit user confirmation; show a token-budget estimate before run; enforce hard caps in the provider layer.
3. **Untrusted content in ingest.** Prompt injection from a scraped page. Mitigate with fenced untrusted blocks in prompts, egress allowlist, and no auto-actions on output.
4. **API churn pre-1.0.** Contract tests + pinned version.
5. **In-memory scale ceiling (100k nodes).** Sufficient per venture; for cross-venture analytics, persist to Neo4j (M3).
6. **Hallucinated INFERRED edges.** Always show confidence; weight in scoring; allow user to flag-and-remove edges via the adapter.

## 10. Decision summary

- **Adopt** Graphify as VentureLab's research-graph engine, wrapped via adapter.
- **Pin** `graphifyy==0.8.25`; contract-test on every bump.
- **Library only.** No MCP server. No CLI in production.
- **Inject** our provider client.
- **Persist** `graph.json` per venture; optional Neo4j for M3.
- **Surface confidence**; weight in opportunity scoring.
- **Plan** fork-and-vendor as a real, not theoretical, contingency.
