/**
 * GraphifyAdapter (TS) — Sprint 1F.
 *
 * Public surface:
 *   - buildResearchGraph(input)  → full ResearchGraph (one LLM call)
 *   - addSource(graph, source)   → graph with the new source appended (no LLM)
 *   - queryGraph(graph, q)       → keyword-ranked nodes + related edges
 *   - shortestPath(graph, a, b)  → undirected BFS path
 *   - godNodes(graph, topK)      → top-degree nodes
 *   - exportNeo4j(graph)         → Cypher CREATE statements as a single string
 */
import type {
  ChatRequest,
  PersonaLabPersona,
  ResearchGraph,
  ResearchGraphEdge,
  ResearchGraphEvaluation,
  ResearchGraphNode,
  ResearchGraphPath,
  ResearchGraphProvenance,
  ResearchGraphQueryResult,
  ResearchGraphSource,
  ResearchGraphSourceKind,
  ResearchGraphView,
  VentureAssumption,
  VentureRisk,
} from './types';
import type { CallContext } from './types';
import { GraphifyError } from './types';
import type { ChatFn, GraphifyInput } from './types';
import { extractGraphPrompt } from './prompts';
import { normalizeEdges, normalizeNodes, parseExtractionPayload } from './extractor';
import {
  applyWeights,
  computeCommunities,
  deriveNodesFromAssumptions,
  deriveNodesFromPersonas,
  deriveNodesFromRisks,
  detectContradictions,
  mergeNodes,
  shortestPath as shortestPathFn,
  summarizeConfidence,
  topGodNodes,
} from './graph';
import { evaluateGraph } from './evaluation';
import { projectView, queryGraph as queryGraphFn } from './query';

export interface GraphifyAdapterOptions {
  model: string;
  ctx: CallContext;
  /** Optional clock for deterministic tests. */
  now?: () => Date;
  /** Optional id generator for deterministic tests. */
  generateId?: (prefix: string) => string;
  /** Cap on source text per source (chars). */
  maxSourceChars?: number;
}

export class GraphifyAdapter {
  constructor(private readonly chat: ChatFn, private readonly opts: GraphifyAdapterOptions) {}

  async buildResearchGraph(input: GraphifyInput): Promise<ResearchGraph> {
    const now = (this.opts.now ?? (() => new Date()))();
    const createdAt = now.toISOString();
    const maxChars = this.opts.maxSourceChars ?? 4000;

    const sources = this.collectSources(input, createdAt, maxChars);
    const provenance: ResearchGraphProvenance = {
      sourceIds: sources.map((s) => s.id),
      extractor: 'llm',
      extractedAt: createdAt,
    };

    // Single LLM call: extract nodes/edges from the source text.
    let rawNodes: ReturnType<typeof parseExtractionPayload>['nodes'] = [];
    let rawEdges: ReturnType<typeof parseExtractionPayload>['edges'] = [];
    const llmSources = sources.filter((s) => (s.excerpt ?? '').trim().length > 0)
      .map((s) => ({ id: s.id, label: s.label, text: s.excerpt ?? '' }));
    if (llmSources.length > 0) {
      const req: ChatRequest = {
        model: this.opts.model,
        ctx: this.opts.ctx,
        messages: extractGraphPrompt(input, llmSources),
        temperature: 0.2,
        maxTokens: 4000,
        responseFormat: 'json',
      };
      let raw: string;
      try {
        const res = await this.chat(req);
        raw = typeof res.content === 'string' ? res.content : '';
      } catch (e) {
        throw new GraphifyError('Graphify LLM call failed', e);
      }
      const parsed = parseExtractionPayload(raw);
      rawNodes = parsed.nodes;
      rawEdges = parsed.edges;
    }

    const llmNodes = normalizeNodes(rawNodes, sources, createdAt, 'llm');
    const llmEdges = normalizeEdges(rawEdges, llmNodes, sources, createdAt, 'llm');

    // Deterministic rule-extracted nodes from structured upstream inputs.
    const personaProv = makeRuleProvenance(sources, 'persona_set', createdAt);
    const assumptionProv = makeRuleProvenance(sources, 'venture_assumption', createdAt);
    const riskProv = makeRuleProvenance(sources, 'venture_risk', createdAt);

    const personaNodes = deriveNodesFromPersonas(input.personas ?? [], personaProv);
    const assumptionNodes = deriveNodesFromAssumptions(input.assumptions ?? [], assumptionProv);
    const riskNodes = deriveNodesFromRisks(input.risks ?? [], riskProv);

    const nodesMerged = mergeNodes(llmNodes, personaNodes, assumptionNodes, riskNodes);
    const edgesMerged = llmEdges; // edges between derived nodes are inferred only when LLM emits them with matching ids

    const nodes = applyWeights(nodesMerged, edgesMerged);
    const edges = edgesMerged;

    const community = computeCommunities(nodes, edges);
    const communitiesCount = new Set(community.values()).size;
    const confidence = summarizeConfidence(nodes, edges);
    const god = topGodNodes(nodes, edges, 10).map((g) => ({
      label: g.label,
      degree: g.degree,
      community: g.community,
    }));
    const contradictions = detectContradictions(edges);

    const graphId = this.opts.generateId?.('g') ?? defaultId('g');
    return {
      kind: 'ResearchGraph',
      graphId,
      ventureId: input.ventureId,
      createdAt,
      stats: {
        nodes: nodes.length,
        edges: edges.length,
        communities: communitiesCount,
        confidence,
      },
      godNodes: god,
      nodes,
      edges,
      sources,
      contradictions: contradictions.length > 0 ? contradictions : undefined,
    };
  }

  /**
   * Append a source to an existing graph. Does NOT re-run the LLM — the new
   * source is recorded so the next `buildResearchGraph()` will incorporate it.
   * Pure / no I/O.
   */
  addSource(graph: ResearchGraph, source: { label: string; kind?: ResearchGraphSourceKind; uri?: string; text: string }): ResearchGraph {
    const now = (this.opts.now ?? (() => new Date()))();
    const id = this.opts.generateId?.('s') ?? defaultId('s');
    const newSource: ResearchGraphSource = {
      id,
      kind: source.kind ?? 'note',
      label: source.label,
      uri: source.uri,
      excerpt: truncateSource(source.text, this.opts.maxSourceChars ?? 4000),
      addedAt: now.toISOString(),
    };
    return { ...graph, sources: [...(graph.sources ?? []), newSource] };
  }

  queryGraph(graph: ResearchGraph, question: string, topK = 8): ResearchGraphQueryResult {
    return queryGraphFn(graph, question, topK);
  }

  shortestPath(graph: ResearchGraph, fromId: string, toId: string): ResearchGraphPath | null {
    return shortestPathFn(graph.nodes ?? [], graph.edges ?? [], fromId, toId);
  }

  godNodes(graph: ResearchGraph, topK = 10): Array<{ label: string; degree: number; community: number; nodeId: string }> {
    return topGodNodes(graph.nodes ?? [], graph.edges ?? [], topK);
  }

  view(graph: ResearchGraph, view: ResearchGraphView): { nodes: ResearchGraphNode[]; edges: ResearchGraphEdge[] } {
    return projectView(graph, view);
  }

  evaluate(graph: ResearchGraph): ResearchGraphEvaluation {
    return evaluateGraph(graph);
  }

  /**
   * Render the graph as a minimal Cypher script. Returns the script string —
   * does NOT open a network connection. The caller is responsible for sending
   * it to a real Neo4j instance if desired.
   */
  exportNeo4j(graph: ResearchGraph): string {
    const lines: string[] = [];
    for (const n of graph.nodes ?? []) {
      const label = capitalize(n.type);
      lines.push(`CREATE (:${label} {id: ${json(n.id)}, label: ${json(n.label)}, confidence: ${n.confidence}});`);
    }
    for (const e of graph.edges ?? []) {
      const rel = e.type.toUpperCase();
      lines.push(
        `MATCH (a {id: ${json(e.from)}}), (b {id: ${json(e.to)}}) CREATE (a)-[:${rel} {confidence: ${e.confidence}}]->(b);`,
      );
    }
    return lines.join('\n');
  }

  private collectSources(input: GraphifyInput, createdAt: string, maxChars: number): ResearchGraphSource[] {
    const out: ResearchGraphSource[] = [];
    let counter = 0;
    const nextId = () => `s_${++counter}`;
    if (input.brief) {
      out.push({
        id: nextId(),
        kind: 'brief',
        label: 'Idea brief',
        excerpt: truncateSource(
          `${input.brief.businessIdea}\n${input.brief.targetMarket}\n${input.brief.additionalContext ?? ''}`,
          maxChars,
        ),
        addedAt: createdAt,
      });
    }
    for (const n of input.notes ?? []) {
      out.push({ id: nextId(), kind: 'note', label: 'Research note', excerpt: truncateSource(n, maxChars), addedAt: createdAt });
    }
    for (const s of input.sources ?? []) {
      out.push({
        id: nextId(),
        kind: s.kind ?? 'file',
        label: s.label,
        uri: s.uri,
        excerpt: truncateSource(s.text, maxChars),
        addedAt: createdAt,
      });
    }
    if ((input.personas ?? []).length > 0) {
      out.push({ id: nextId(), kind: 'persona_set', label: 'PersonaLab personas', addedAt: createdAt });
    }
    if ((input.assumptions ?? []).length > 0) {
      out.push({ id: nextId(), kind: 'venture_assumption', label: 'VentureLab assumptions', addedAt: createdAt });
    }
    if ((input.risks ?? []).length > 0) {
      out.push({ id: nextId(), kind: 'venture_risk', label: 'VentureLab risks', addedAt: createdAt });
    }
    return out;
  }
}

function makeRuleProvenance(sources: ResearchGraphSource[], kind: ResearchGraphSourceKind, extractedAt: string): ResearchGraphProvenance {
  return {
    sourceIds: sources.filter((s) => s.kind === kind).map((s) => s.id),
    extractor: 'rule',
    extractedAt,
  };
}

function truncateSource(s: string, max: number): string {
  if (typeof s !== 'string') return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[truncated ${s.length - max} chars]`;
}

function defaultId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function json(s: string): string {
  return JSON.stringify(s);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Factory mirroring the squad-ts pattern. */
export function createGraphifyAdapter(chat: ChatFn, opts: GraphifyAdapterOptions): GraphifyAdapter {
  return new GraphifyAdapter(chat, opts);
}
