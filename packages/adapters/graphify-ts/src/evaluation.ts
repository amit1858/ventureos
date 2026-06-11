import { NODE_TYPES, EDGE_TYPES } from './types';
import type { ResearchGraph, ResearchGraphEdge, ResearchGraphEvaluation, ResearchGraphNode } from './types';

const NODE_TYPE_SET = new Set<string>(NODE_TYPES);
const EDGE_TYPE_SET = new Set<string>(EDGE_TYPES);

export function evaluateGraph(graph: ResearchGraph): ResearchGraphEvaluation {
  const nodes: ResearchGraphNode[] = graph.nodes ?? [];
  const edges: ResearchGraphEdge[] = graph.edges ?? [];
  const warnings: string[] = [];

  // ── nodeRelevance: labels are non-trivial and types are valid.
  let goodNodes = 0;
  for (const n of nodes) {
    if (!NODE_TYPE_SET.has(n.type)) continue;
    if (n.label.trim().length < 3) continue;
    goodNodes++;
  }
  const nodeRelevance = nodes.length === 0 ? 0 : goodNodes / nodes.length;
  if (nodeRelevance < 0.7) warnings.push(`nodeRelevance=${nodeRelevance.toFixed(2)} — some nodes have invalid types or trivial labels`);

  // ── edgeUsefulness: edges connect distinct existing nodes with valid types.
  const nodeIds = new Set(nodes.map((n) => n.id));
  let goodEdges = 0;
  for (const e of edges) {
    if (!EDGE_TYPE_SET.has(e.type)) continue;
    if (e.from === e.to) continue;
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    goodEdges++;
  }
  const edgeUsefulness = edges.length === 0 ? 0 : goodEdges / edges.length;
  if (edges.length > 0 && edgeUsefulness < 0.7) warnings.push(`edgeUsefulness=${edgeUsefulness.toFixed(2)} — some edges are invalid or self-loops`);

  // ── evidenceCoverage: proportion of nodes/edges with ≥1 evidence quote.
  const withEvidence = nodes.filter((n) => (n.evidence ?? []).length > 0).length
    + edges.filter((e) => (e.evidence ?? []).length > 0).length;
  const total = nodes.length + edges.length;
  const evidenceCoverage = total === 0 ? 0 : withEvidence / total;
  if (evidenceCoverage < 0.5) warnings.push(`evidenceCoverage=${evidenceCoverage.toFixed(2)} — most nodes/edges lack verbatim evidence quotes`);

  // ── provenanceCoverage: proportion with ≥1 source id.
  const withProv = nodes.filter((n) => (n.provenance?.sourceIds ?? []).length > 0).length
    + edges.filter((e) => (e.provenance?.sourceIds ?? []).length > 0).length;
  const provenanceCoverage = total === 0 ? 0 : withProv / total;
  if (provenanceCoverage < 0.5) warnings.push(`provenanceCoverage=${provenanceCoverage.toFixed(2)} — most nodes/edges lack source provenance`);

  // ── contradictionDetection: if contradictory edge pairs exist in edges, did contradictions[] surface ≥1?
  const contradictions = graph.contradictions ?? [];
  const contradictoryPairsPresent = countDirectContradictions(edges);
  let contradictionDetection: number;
  if (contradictoryPairsPresent === 0) contradictionDetection = 1; // nothing to detect
  else if (contradictions.length === 0) {
    contradictionDetection = 0;
    warnings.push(`contradictionDetection=0.00 — ${contradictoryPairsPresent} contradictory pair(s) present but contradictions[] is empty`);
  } else {
    contradictionDetection = Math.min(1, contradictions.length / contradictoryPairsPresent);
  }

  // ── densitySanity: edge-to-node ratio in [0.3, 3].
  let densitySanity: number;
  if (nodes.length === 0) {
    densitySanity = 0;
    warnings.push('densitySanity=0.00 — graph is empty');
  } else {
    const ratio = edges.length / nodes.length;
    if (ratio < 0.1) {
      densitySanity = Math.max(0, ratio / 0.3);
      warnings.push(`densitySanity=${densitySanity.toFixed(2)} — graph is too sparse (edges/nodes=${ratio.toFixed(2)})`);
    } else if (ratio > 4) {
      densitySanity = Math.max(0, 1 - (ratio - 3) / 5);
      warnings.push(`densitySanity=${densitySanity.toFixed(2)} — graph is too dense (edges/nodes=${ratio.toFixed(2)})`);
    } else {
      densitySanity = 1;
    }
  }

  const overallScore = (
    nodeRelevance * 0.2 +
    edgeUsefulness * 0.2 +
    evidenceCoverage * 0.2 +
    provenanceCoverage * 0.15 +
    contradictionDetection * 0.1 +
    densitySanity * 0.15
  );

  return {
    nodeRelevance,
    edgeUsefulness,
    evidenceCoverage,
    provenanceCoverage,
    contradictionDetection,
    densitySanity,
    warnings,
    overallScore,
  };
}

function countDirectContradictions(edges: ResearchGraphEdge[]): number {
  let count = 0;
  const byKey = new Map<string, string[]>();
  for (const e of edges) {
    const k = `${e.from}|${e.to}`;
    const arr = byKey.get(k) ?? [];
    arr.push(e.type);
    byKey.set(k, arr);
  }
  for (const types of byKey.values()) {
    const set = new Set(types);
    if (set.has('validates') && set.has('contradicts')) count++;
    if (set.has('enables') && set.has('blocks')) count++;
  }
  return count;
}
