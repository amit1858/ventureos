import type {
  CallContext,
  ChatRequest,
  ChatResponse,
  Confidence,
  PersonaLabBrief,
  PersonaLabPersona,
  ResearchGraph,
  ResearchGraphEdge,
  ResearchGraphEdgeType,
  ResearchGraphEvaluation,
  ResearchGraphNode,
  ResearchGraphNodeType,
  ResearchGraphPath,
  ResearchGraphProvenance,
  ResearchGraphQueryResult,
  ResearchGraphSource,
  ResearchGraphSourceKind,
  ResearchGraphView,
  VentureAssumption,
  VentureRisk,
} from '@foundry/contracts';

export type {
  CallContext,
  ChatRequest,
  ChatResponse,
  Confidence,
  PersonaLabBrief,
  PersonaLabPersona,
  ResearchGraph,
  ResearchGraphEdge,
  ResearchGraphEdgeType,
  ResearchGraphEvaluation,
  ResearchGraphNode,
  ResearchGraphNodeType,
  ResearchGraphPath,
  ResearchGraphProvenance,
  ResearchGraphQueryResult,
  ResearchGraphSource,
  ResearchGraphSourceKind,
  ResearchGraphView,
  VentureAssumption,
  VentureRisk,
};

export type ChatFn = (req: ChatRequest) => Promise<ChatResponse>;

/** Free-form research input. All fields optional — adapter degrades gracefully. */
export interface GraphifyInput {
  ventureId: string;
  brief?: PersonaLabBrief;
  /** Free-form notes (founder, market, competitor, customer). */
  notes?: string[];
  /** Uploaded/pasted source texts. */
  sources?: Array<{
    label: string;
    kind?: ResearchGraphSourceKind;
    uri?: string;
    text: string;
  }>;
  /** PersonaLab outputs (will be linked into customer/segment nodes). */
  personas?: PersonaLabPersona[];
  /** VentureLab assumptions (mapped to assumption nodes). */
  assumptions?: VentureAssumption[];
  /** VentureLab risks (mapped to risk nodes). */
  risks?: VentureRisk[];
}

export const NODE_TYPES: readonly ResearchGraphNodeType[] = [
  'problem',
  'persona',
  'segment',
  'competitor',
  'feature',
  'alternative',
  'risk',
  'assumption',
  'market_signal',
  'opportunity',
] as const;

export const EDGE_TYPES: readonly ResearchGraphEdgeType[] = [
  'experiences',
  'needs',
  'competes_with',
  'substitutes',
  'blocks',
  'enables',
  'validates',
  'contradicts',
  'influences',
  'depends_on',
] as const;

/** Edge type pairs that are directly contradictory when they share endpoints. */
export const CONTRADICTORY_EDGE_PAIRS: ReadonlyArray<readonly [ResearchGraphEdgeType, ResearchGraphEdgeType]> = [
  ['validates', 'contradicts'],
  ['enables', 'blocks'],
];

export class GraphifyError extends Error {
  readonly reason?: unknown;
  constructor(message: string, reason?: unknown) {
    super(message);
    this.name = 'GraphifyError';
    this.reason = reason;
  }
}
