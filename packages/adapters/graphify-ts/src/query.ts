import type {
  ResearchGraph,
  ResearchGraphEdge,
  ResearchGraphNode,
  ResearchGraphQueryResult,
  ResearchGraphView,
} from './types';

/** Lightweight keyword search. Deterministic; no LLM. */
export function queryGraph(graph: ResearchGraph, question: string, topK = 8): ResearchGraphQueryResult {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const tokens = tokenize(question);
  if (tokens.length === 0) {
    return { question, matches: [], relatedEdges: [] };
  }
  const scored = nodes.map((n) => ({ n, s: scoreNode(n, tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.n.label.localeCompare(b.n.label))
    .slice(0, topK)
    .map((x) => x.n);
  const ids = new Set(scored.map((n) => n.id));
  const related = edges.filter((e) => ids.has(e.from) || ids.has(e.to));
  return { question, matches: scored, relatedEdges: related };
}

const NODE_TYPES_FOR_VIEW: Record<ResearchGraphView, ReadonlyArray<ResearchGraphNode['type']>> = {
  problem:    ['problem', 'market_signal'],
  customer:   ['persona', 'segment'],
  competitor: ['competitor', 'alternative'],
  market:     ['market_signal', 'segment', 'opportunity'],
  opportunity:['opportunity', 'feature', 'assumption'],
};

/** Subgraph filtered to a logical view. */
export function projectView(graph: ResearchGraph, view: ResearchGraphView): { nodes: ResearchGraphNode[]; edges: ResearchGraphEdge[] } {
  const allow = new Set<string>(NODE_TYPES_FOR_VIEW[view]);
  const nodes = (graph.nodes ?? []).filter((n) => allow.has(n.type));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = (graph.edges ?? []).filter((e) => ids.has(e.from) && ids.has(e.to));
  return { nodes, edges };
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
}

function scoreNode(n: ResearchGraphNode, tokens: string[]): number {
  const hay = `${n.label} ${n.summary ?? ''} ${(n.evidence ?? []).join(' ')}`.toLowerCase();
  let score = 0;
  for (const t of tokens) if (hay.includes(t)) score += 1;
  return score;
}
