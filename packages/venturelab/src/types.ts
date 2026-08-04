/**
 * VentureLab — TypeScript orchestration types.
 *
 * Re-exports the contract types and adds two internal payload shapes for the
 * two LLM calls VentureLab makes (`extractSignals`, `mapAssumptions`). The
 * decision engine itself never sees the LLM directly — it operates only on
 * the deterministic scores computed from these payloads + the buying
 * committee deliberation structure.
 */
import type {
  BuyingCommitteeDeliberation,
  BuyingCommitteeTranscript,
  CallContext,
  ChatRequest,
  ChatResponse,
  EvidenceConfidence,
  EvidenceKind,
  FocusGroupTranscript,
  IdeaBrief,
  InterviewTranscript,
  PersonaLabBrief,
  PersonaLabPersona,
  ResearchGraph,
  ResearchGraphEdge,
  ResearchGraphNode,
  ScoreDimension,
  ValidationCategory,
  ValidationStep,
  VentureAssumption,
  VentureDecision,
  VentureEvidence,
  VentureRecommendation,
  VentureRecommendationEvaluation,
  VentureRisk,
  VentureScore,
} from '@foundry/contracts';

export type {
  BuyingCommitteeDeliberation,
  BuyingCommitteeTranscript,
  CallContext,
  ChatRequest,
  ChatResponse,
  EvidenceConfidence,
  EvidenceKind,
  FocusGroupTranscript,
  IdeaBrief,
  InterviewTranscript,
  PersonaLabBrief,
  PersonaLabPersona,
  ResearchGraph,
  ResearchGraphEdge,
  ResearchGraphNode,
  ScoreDimension,
  ValidationCategory,
  ValidationStep,
  VentureAssumption,
  VentureDecision,
  VentureEvidence,
  VentureRecommendation,
  VentureRecommendationEvaluation,
  VentureRisk,
  VentureScore,
};

export type ChatFn = (req: ChatRequest) => Promise<ChatResponse>;

/**
 * Bundle of everything VentureLab needs from upstream PersonaLab to reason
 * about a venture. Any field may be empty — analyzers degrade gracefully when
 * a signal source is missing.
 */
export interface VentureLabInput {
  ventureId: string;
  brief: PersonaLabBrief;
  /** Optional richer brief (used for assumptions extraction). */
  ideaBrief?: IdeaBrief;
  personas: PersonaLabPersona[];
  interviews?: InterviewTranscript[];
  focusGroups?: FocusGroupTranscript[];
  committee?: BuyingCommitteeTranscript;
  /** Free-form founder/user notes. Strings only — VentureLab never executes them. */
  notes?: string[];
  /** Sprint 1F — optional Graphify ResearchGraph. VentureLab still runs without it. */
  researchGraph?: ResearchGraph;
}

/**
 * Raw evidence payload returned by the single signal-extraction LLM call.
 * Analyzers consume this; the LLM itself never produces a score or a decision.
 */
export interface SignalsPayload {
  problemEvidence: VentureEvidence[];
  urgencyEvidence: VentureEvidence[];
  willingnessToPayEvidence: VentureEvidence[];
  differentiationEvidence: VentureEvidence[];
  adoptionFrictionEvidence: VentureEvidence[];
  executionRiskEvidence: VentureEvidence[];
  marketClarityEvidence: VentureEvidence[];
}
