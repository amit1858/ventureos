/**
 * Deterministic graph operations.
 *
 * All centrality, communities, contradictions and path-finding are computed
 * here — the LLM never produces them. This module is pure (no I/O, no
 * randomness) so the same inputs always produce the same graph.
 */
import type {
  Confidence,
  PersonaLabPersona,
  ResearchGraphEdge,
  ResearchGraphNode,
  ResearchGraphPath,
  ResearchGraphProvenance,
  VentureAssumption,
  VentureRisk,
} from './types';
import { CONTRADICTORY_EDGE_PAIRS } from './types';

export function deriveNodesFromPersonas(
  personas: PersonaLabPersona[],
  provenance: ResearchGraphProvenance,
): ResearchGraphNode[] {
  return personas.map((p) => ({
    id: `persona:${p.id}`,
    type: 'persona' as const,
    label: p.name,
    summary: p.role,
    confidence: typeof p.confidenceScore === 'number' ? Math.max(0, Math.min(1, p.confidenceScore)) : 0.6,
    evidence: [
      ...(p.painPoints ?? []).slice(0, 2),
      ...(p.objections ?? []).slice(0, 2),
    ],
    provenance,
  }));
}

export function deriveNodesFromAssumptions(
  assumptions: VentureAssumption[],
  provenance: ResearchGraphProvenance,
): ResearchGraphNode[] {
  return assumptions.map((a) => ({
    id: `assumption:${a.id}`,
    type: 'assumption' as const,
    label: a.text,
    summary: `${a.type} · ${a.riskLevel} risk`,
    confidence: a.confidence === 'high' ? 0.85 : a.confidence === 'medium' ? 0.6 : 0.35,
    evidence: [],
    provenance,
  }));
}

export function deriveNodesFromRisks(
  risks: VentureRisk[],
  provenance: ResearchGraphProvenance,
): ResearchGraphNode[] {
  return risks.map((r) => ({
    id: `risk:${r.id}`,
    type: 'risk' as const,
    label: r.risk,
    summary: `impact:${r.impact} likelihood:${r.likelihood}`,
    confidence: 0.65,
    evidence: [r.mitigation].filter(Boolean),
    provenance,
  }));
}

/** Merge node lists, deduplicating by id (first occurrence wins). */
export function mergeNodes(...lists: ResearchGraphNode[][]): ResearchGraphNode[] {
  const seen = new Set<string>();
  const out: ResearchGraphNode[] = [];
  for (const list of lists) {
    for (const n of list) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(n);
    }
  }
  return out;
}

/** Compute degree (in + out) per node. Pure. */
export function computeDegree(nodes: ResearchGraphNode[], edges: ResearchGraphEdge[]): Map<string, number> {
  const degree = new Map<string, number>();
  for (const n of nodes) degree.set(n.id, 0);
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  return degree;
}

/**
 * Connected-components communities. Treats the graph as undirected. Each
 * component gets a 0-based community id assigned in deterministic node-order.
 */
export function computeCommunities(nodes: ResearchGraphNode[], edges: ResearchGraphEdge[]): Map<string, number> {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }
  const community = new Map<string, number>();
  let next = 0;
  for (const n of nodes) {
    if (community.has(n.id)) continue;
    const stack = [n.id];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (community.has(cur)) continue;
      community.set(cur, next);
      for (const nb of adj.get(cur) ?? []) if (!community.has(nb)) stack.push(nb);
    }
    next++;
  }
  return community;
}

/** Top-K nodes by degree, with community + label. */
export function topGodNodes(
  nodes: ResearchGraphNode[],
  edges: ResearchGraphEdge[],
  topK = 10,
): Array<{ label: string; degree: number; community: number; nodeId: string }> {
  const degree = computeDegree(nodes, edges);
  const community = computeCommunities(nodes, edges);
  return nodes
    .map((n) => ({
      nodeId: n.id,
      label: n.label,
      degree: degree.get(n.id) ?? 0,
      community: community.get(n.id) ?? 0,
    }))
    .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label))
    .slice(0, topK);
}

/** Detect contradictory edge pairs (validates↔contradicts, enables↔blocks) sharing the same endpoints. */
export function detectContradictions(edges: ResearchGraphEdge[]): string[] {
  const out: string[] = [];
  const index = new Map<string, ResearchGraphEdge[]>();
  for (const e of edges) {
    const k = `${e.from}|${e.to}`;
    const arr = index.get(k) ?? [];
    arr.push(e);
    index.set(k, arr);
    // also include reverse for symmetric relations
    const kr = `${e.to}|${e.from}`;
    const arrR = index.get(kr) ?? [];
    arrR.push(e);
    index.set(kr, arrR);
  }
  const seen = new Set<string>();
  for (const e of edges) {
    for (const [a, b] of CONTRADICTORY_EDGE_PAIRS) {
      if (e.type !== a) continue;
      const sibling = (index.get(`${e.from}|${e.to}`) ?? []).find((x) => x.type === b);
      if (!sibling) continue;
      const key = [e.id, sibling.id].sort().join('::');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(`Edge ${e.id} (${a}) contradicts edge ${sibling.id} (${b}) on ${e.from} → ${e.to}`);
    }
  }
  return out;
}

/** Stats aggregator. */
export function summarizeConfidence(
  nodes: ResearchGraphNode[],
  edges: ResearchGraphEdge[],
): Record<Confidence, number> {
  const all = [...nodes, ...edges];
  let extracted = 0;
  let inferred = 0;
  let ambiguous = 0;
  for (const x of all) {
    if (x.confidence >= 0.75) extracted++;
    else if (x.confidence >= 0.45) inferred++;
    else ambiguous++;
  }
  return { EXTRACTED: extracted, INFERRED: inferred, AMBIGUOUS: ambiguous };
}

/** Undirected BFS shortest path. Returns null if disconnected. */
export function shortestPath(
  nodes: ResearchGraphNode[],
  edges: ResearchGraphEdge[],
  fromId: string,
  toId: string,
): ResearchGraphPath | null {
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  if (!nodeById.has(fromId) || !nodeById.has(toId)) return null;
  if (fromId === toId) {
    return { from: fromId, to: toId, nodes: [nodeById.get(fromId)!], edges: [], hops: 0 };
  }
  const adj = new Map<string, Array<{ neighbor: string; edge: ResearchGraphEdge }>>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.from)?.push({ neighbor: e.to, edge: e });
    adj.get(e.to)?.push({ neighbor: e.from, edge: e });
  }
  const prev = new Map<string, { node: string; edge: ResearchGraphEdge }>();
  const queue: string[] = [fromId];
  const visited = new Set<string>([fromId]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === toId) break;
    for (const { neighbor, edge } of adj.get(cur) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      prev.set(neighbor, { node: cur, edge });
      queue.push(neighbor);
    }
  }
  if (!prev.has(toId) && fromId !== toId) return null;
  const pathEdges: ResearchGraphEdge[] = [];
  const pathNodes: ResearchGraphNode[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const step = prev.get(cursor);
    if (!step) return null;
    pathEdges.unshift(step.edge);
    pathNodes.unshift(nodeById.get(cursor)!);
    cursor = step.node;
  }
  pathNodes.unshift(nodeById.get(fromId)!);
  return { from: fromId, to: toId, nodes: pathNodes, edges: pathEdges, hops: pathEdges.length };
}

/** Apply computed degree weights back into node.weight (0..1 normalised). */
export function applyWeights(nodes: ResearchGraphNode[], edges: ResearchGraphEdge[]): ResearchGraphNode[] {
  const degree = computeDegree(nodes, edges);
  let max = 0;
  for (const v of degree.values()) if (v > max) max = v;
  return nodes.map((n) => ({
    ...n,
    weight: max > 0 ? (degree.get(n.id) ?? 0) / max : 0,
  }));
}
