/**
 * Sprint 1F — Optional ResearchGraph enhancement layer for VentureLab.
 *
 * Pure / deterministic. Given the LLM-extracted signals and assumption set,
 * plus a Graphify ResearchGraph, this module produces:
 *
 *   - additional VentureEvidence items (sourced from graph nodes)
 *   - additional counter-signals (sourced from contradictions)
 *   - adjusted assumption confidence/risk (validated/contradicted by graph)
 *   - adjusted score nudges for differentiation, marketClarity, competitive
 *     risk (executionRisk) and assumption confidence.
 *
 * VentureLab continues to work without a graph — every nudge is opt-in.
 */
import type {
  ResearchGraph,
  ResearchGraphEdge,
  ResearchGraphNode,
  VentureAssumption,
  VentureEvidence,
  VentureScore,
} from './types';

/** A per-dimension delta applied to deterministic scores after graph enhancement. */
export interface ResearchGraphAdjustments {
  evidence: VentureEvidence[];
  counterSignals: VentureEvidence[];
  scoreDeltas: Partial<Record<VentureScore['dimension'], number>>;
  /** Reasons appended to decisionRationale to document the graph's influence. */
  rationale: string[];
  /** Updated assumptions (same shape, with confidence/risk possibly tweaked). */
  assumptions: VentureAssumption[];
}

export const EMPTY_ADJUSTMENTS: ResearchGraphAdjustments = {
  evidence: [],
  counterSignals: [],
  scoreDeltas: {},
  rationale: [],
  assumptions: [],
};

/**
 * Compute graph-derived adjustments for the given assumption set. Pure.
 *
 * Heuristics (all deterministic):
 *   * `differentiation` += min(8, distinct competitor count * 2). The graph
 *     proves competitors exist; the LLM extractor often misses them.
 *   * `marketClarity`  += min(10, segment-node count * 4) when ≥1 market_signal
 *     node is present.
 *   * `executionRisk`  += min(10, contradictions.length * 4). Competitive risk
 *     rises when the graph surfaces directly conflicting claims.
 *   * For each assumption whose label appears as a node with an INCOMING
 *     `validates` edge, lift confidence one step (low→medium→high) and lower
 *     riskLevel one step.
 *   * For each assumption whose label appears as a node with an INCOMING
 *     `contradicts` edge, drop confidence one step and bump riskLevel one
 *     step.
 */
export function applyResearchGraphAdjustments(
  graph: ResearchGraph,
  scores: VentureScore[],
  assumptions: VentureAssumption[],
): ResearchGraphAdjustments {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  if (nodes.length === 0) return EMPTY_ADJUSTMENTS;

  const rationale: string[] = [];
  const scoreDeltas: ResearchGraphAdjustments['scoreDeltas'] = {};

  const competitors = nodes.filter((n) => n.type === 'competitor' || n.type === 'alternative');
  const segments    = nodes.filter((n) => n.type === 'segment');
  const signals     = nodes.filter((n) => n.type === 'market_signal');
  const contradictionCount = (graph.contradictions ?? []).length;

  if (competitors.length > 0) {
    const delta = Math.min(8, competitors.length * 2);
    scoreDeltas.differentiation = (scoreDeltas.differentiation ?? 0) - delta;
    rationale.push(
      `ResearchGraph surfaced ${competitors.length} competitor/alternative node(s) → differentiation −${delta}.`,
    );
  }

  if (segments.length > 0 && signals.length > 0) {
    const delta = Math.min(10, segments.length * 4);
    scoreDeltas.marketClarity = (scoreDeltas.marketClarity ?? 0) + delta;
    rationale.push(
      `ResearchGraph anchored ${segments.length} segment node(s) with ${signals.length} market signal(s) → marketClarity +${delta}.`,
    );
  }

  if (contradictionCount > 0) {
    const delta = Math.min(10, contradictionCount * 4);
    scoreDeltas.executionRisk = (scoreDeltas.executionRisk ?? 0) + delta;
    rationale.push(
      `ResearchGraph detected ${contradictionCount} contradiction(s) → executionRisk +${delta}.`,
    );
  }

  // Additional evidence: top-confidence nodes from the graph become evidence.
  const evidence: VentureEvidence[] = [];
  for (const n of [...nodes].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 6)) {
    const quote = (n.evidence?.[0] ?? n.summary ?? n.label).slice(0, 280);
    evidence.push({
      kind: 'note',
      source: `graph:${n.id}`,
      quote,
      weight: n.confidence,
      confidence: n.confidence >= 0.75 ? 'high' : n.confidence >= 0.45 ? 'medium' : 'low',
    });
  }

  // Counter-signals from contradictions.
  const counterSignals: VentureEvidence[] = (graph.contradictions ?? []).slice(0, 4).map((c, i) => ({
    kind: 'note',
    source: `graph:contradiction:${i}`,
    quote: c.slice(0, 280),
    weight: 0.7,
    confidence: 'medium',
  }));

  // Assumption confidence/risk adjustment.
  const adjustedAssumptions = adjustAssumptions(assumptions, nodes, edges, rationale);

  return {
    evidence,
    counterSignals,
    scoreDeltas,
    rationale,
    assumptions: adjustedAssumptions,
  };
}

const CONF_UP:   Record<VentureAssumption['confidence'], VentureAssumption['confidence']> = { low: 'medium', medium: 'high',   high: 'high'   };
const CONF_DOWN: Record<VentureAssumption['confidence'], VentureAssumption['confidence']> = { low: 'low',    medium: 'low',    high: 'medium' };
const RISK_UP:   Record<VentureAssumption['riskLevel'],  VentureAssumption['riskLevel']>  = { low: 'medium', medium: 'high',   high: 'critical', critical: 'critical' };
const RISK_DOWN: Record<VentureAssumption['riskLevel'],  VentureAssumption['riskLevel']>  = { low: 'low',    medium: 'low',    high: 'medium',   critical: 'high'    };

function adjustAssumptions(
  assumptions: VentureAssumption[],
  nodes: ResearchGraphNode[],
  edges: ResearchGraphEdge[],
  rationale: string[],
): VentureAssumption[] {
  if (assumptions.length === 0) return assumptions;
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  // Build incoming-edge index by node id.
  const incoming = new Map<string, ResearchGraphEdge[]>();
  for (const e of edges) {
    const arr = incoming.get(e.to) ?? [];
    arr.push(e);
    incoming.set(e.to, arr);
  }
  return assumptions.map((a) => {
    // Match an assumption to an assumption-typed graph node, either by
    // canonical id or by label substring.
    const targetNode = nodeById.get(`assumption:${a.id}`)
      ?? nodes.find((n) => n.type === 'assumption' && labelsOverlap(n.label, a.text));
    if (!targetNode) return a;
    const inEdges = incoming.get(targetNode.id) ?? [];
    const validated = inEdges.some((e) => e.type === 'validates');
    const contradicted = inEdges.some((e) => e.type === 'contradicts');
    if (validated && !contradicted) {
      const nextConf = CONF_UP[a.confidence];
      const nextRisk = RISK_DOWN[a.riskLevel];
      if (nextConf !== a.confidence || nextRisk !== a.riskLevel) {
        rationale.push(`Assumption "${truncate(a.text, 60)}" validated by graph → confidence ${a.confidence}→${nextConf}, risk ${a.riskLevel}→${nextRisk}.`);
      }
      return { ...a, confidence: nextConf, riskLevel: nextRisk };
    }
    if (contradicted && !validated) {
      const nextConf = CONF_DOWN[a.confidence];
      const nextRisk = RISK_UP[a.riskLevel];
      if (nextConf !== a.confidence || nextRisk !== a.riskLevel) {
        rationale.push(`Assumption "${truncate(a.text, 60)}" contradicted by graph → confidence ${a.confidence}→${nextConf}, risk ${a.riskLevel}→${nextRisk}.`);
      }
      return { ...a, confidence: nextConf, riskLevel: nextRisk };
    }
    return a;
  });
}

function labelsOverlap(label: string, text: string): boolean {
  const a = label.toLowerCase();
  const b = text.toLowerCase();
  if (a.length === 0 || b.length === 0) return false;
  if (a.includes(b) || b.includes(a)) return true;
  // Token overlap ≥ 50% of shorter token set.
  const ta = new Set(a.split(/[^a-z0-9]+/).filter((t) => t.length > 3));
  const tb = new Set(b.split(/[^a-z0-9]+/).filter((t) => t.length > 3));
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size) >= 0.5;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/** Apply score deltas in place onto a fresh copy. Clamps to 0..100. */
export function applyScoreDeltas(
  scores: VentureScore[],
  deltas: ResearchGraphAdjustments['scoreDeltas'],
): VentureScore[] {
  return scores.map((s) => {
    const delta = deltas[s.dimension] ?? 0;
    if (delta === 0) return s;
    const next = Math.max(0, Math.min(100, s.score + delta));
    return { ...s, score: next, explanation: `${s.explanation} [graph-adjusted ${delta >= 0 ? '+' : ''}${delta}]` };
  });
}
