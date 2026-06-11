import { asString, asStringArray, clamp01, parseJsonBlock } from './json';
import { EDGE_TYPES, NODE_TYPES } from './types';
import type {
  ResearchGraphEdge,
  ResearchGraphEdgeType,
  ResearchGraphNode,
  ResearchGraphNodeType,
  ResearchGraphProvenance,
  ResearchGraphSource,
} from './types';

export interface RawNode {
  id?: unknown;
  type?: unknown;
  label?: unknown;
  summary?: unknown;
  confidence?: unknown;
  evidence?: unknown;
  sourceIds?: unknown;
}

export interface RawEdge {
  from?: unknown;
  to?: unknown;
  type?: unknown;
  confidence?: unknown;
  evidence?: unknown;
  sourceIds?: unknown;
}

export interface ExtractionPayload {
  nodes: RawNode[];
  edges: RawEdge[];
}

export function parseExtractionPayload(text: string): ExtractionPayload {
  const parsed = parseJsonBlock<{ nodes?: unknown; edges?: unknown }>(text);
  return {
    nodes: Array.isArray(parsed?.nodes) ? (parsed.nodes as RawNode[]) : [],
    edges: Array.isArray(parsed?.edges) ? (parsed.edges as RawEdge[]) : [],
  };
}

const NODE_TYPE_SET = new Set<string>(NODE_TYPES);
const EDGE_TYPE_SET = new Set<string>(EDGE_TYPES);

export function normalizeNodes(
  raw: RawNode[],
  knownSources: ResearchGraphSource[],
  extractedAt: string,
  extractor: 'llm' | 'rule' | 'manual' = 'llm',
): ResearchGraphNode[] {
  const sourceIds = new Set(knownSources.map((s) => s.id));
  const out: ResearchGraphNode[] = [];
  const seen = new Set<string>();
  for (const n of raw) {
    const id = asString(n.id).trim();
    const type = asString(n.type) as ResearchGraphNodeType;
    const label = asString(n.label).trim();
    if (!id || !label) continue;
    if (!NODE_TYPE_SET.has(type)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const provenanceSources = asStringArray(n.sourceIds).filter((s) => sourceIds.has(s));
    const provenance: ResearchGraphProvenance = {
      sourceIds: provenanceSources,
      extractor,
      extractedAt,
    };
    out.push({
      id,
      type,
      label,
      summary: asString(n.summary) || undefined,
      confidence: clamp01(n.confidence, 0.5),
      evidence: asStringArray(n.evidence).slice(0, 6),
      provenance,
    });
  }
  return out;
}

export function normalizeEdges(
  raw: RawEdge[],
  nodes: ResearchGraphNode[],
  knownSources: ResearchGraphSource[],
  extractedAt: string,
  extractor: 'llm' | 'rule' | 'manual' = 'llm',
): ResearchGraphEdge[] {
  const sourceIds = new Set(knownSources.map((s) => s.id));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const out: ResearchGraphEdge[] = [];
  const seen = new Set<string>();
  let counter = 0;
  for (const e of raw) {
    const from = asString(e.from);
    const to = asString(e.to);
    const type = asString(e.type) as ResearchGraphEdgeType;
    if (!from || !to || from === to) continue;
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue;
    if (!EDGE_TYPE_SET.has(type)) continue;
    const key = `${from}|${type}|${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const provenance: ResearchGraphProvenance = {
      sourceIds: asStringArray(e.sourceIds).filter((s) => sourceIds.has(s)),
      extractor,
      extractedAt,
    };
    out.push({
      id: `e_${++counter}`,
      from,
      to,
      type,
      confidence: clamp01(e.confidence, 0.5),
      evidence: asStringArray(e.evidence).slice(0, 4),
      provenance,
    });
  }
  return out;
}
