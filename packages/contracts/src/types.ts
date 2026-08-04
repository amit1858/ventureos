/**
 * Hand-mirrored TypeScript types for the schemas in `./schema/`.
 * Source of truth: the JSON Schema files. Keep in sync until codegen lands.
 */

export type ProviderId =
  | 'openai'
  | 'azure_openai'
  | 'anthropic'
  | 'gemini'
  | 'github_models'
  | 'ollama'
  | 'azure_ai_foundry'
  // Non-LLM integration credential. Stored through the same envelope-encryption
  // pipeline as model providers; no chat/completion surface implemented.
  | 'github';

export type KeyStatus = 'pending_validation' | 'active' | 'revoked' | 'invalid';

export interface ByokKey {
  id: string;                    // ^k_[0-9A-HJKMNP-TV-Z]{26}$
  tenantId: string;
  userId?: string;
  provider: ProviderId;
  alias: string;
  /** Display-only mask. Never the plaintext. */
  maskedSecret: string;
  scope?: string[];
  monthlyBudgetUsd?: number | null;
  regions?: string[];
  metadata?: Record<string, string>;
  status: KeyStatus;
  lastValidatedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

/** Used by the provider layer ONLY at the moment of issuing a call. Never persisted, never logged. */
export interface DecryptedKey {
  id: string;
  provider: ProviderId;
  /** Plaintext secret. Lives in process memory for the duration of one call. */
  secret: string;
}

export interface ProviderRoute {
  provider: ProviderId;
  modelId: string;
  keyId: string;
  weight?: number;
  region?: string;
}

export type LogicalModel = 'flagship' | 'standard' | 'fast' | 'embed' | 'vision';

export interface ProviderConfig {
  tenantId: string;
  defaultProvider: ProviderId;
  routes: {
    flagship: ProviderRoute[];
    standard: ProviderRoute[];
    fast: ProviderRoute[];
    embed?: ProviderRoute[];
    vision?: ProviderRoute[];
  };
  budgets?: {
    tenantMonthlyUsd: number;
    ventureUsd: number;
    perJobUsd?: number | null;
  };
}

export interface IdeaBrief {
  kind: 'IdeaBrief';
  title: string;
  summary: string;
  targetMarket?: string;
  wedge?: string;
  businessModelHypothesis?: string;
  founderAssumptions?: string[];
  tags?: string[];
}

export interface Persona {
  id: string;
  name: string;
  role?: string;
  demographics?: Record<string, unknown>;
  toolsToday?: string[];
  pain?: string;
  buyingPower?: string;
  aiTrust?: string;
  validatorScore?: number;
  [extra: string]: unknown;
}

export interface BuyingCommitteeSlot {
  role: string;
  personas: string[];
}

export interface PersonaSet {
  kind: 'PersonaSet';
  personas: Persona[];
  buyingCommitteeComposition?: BuyingCommitteeSlot[];
}

export type Confidence = 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS';

// ──────────── ResearchGraph (Sprint 1F: Graphify) ────────────

export type ResearchGraphNodeType =
  | 'problem'
  | 'persona'
  | 'segment'
  | 'competitor'
  | 'feature'
  | 'alternative'
  | 'risk'
  | 'assumption'
  | 'market_signal'
  | 'opportunity';

export type ResearchGraphEdgeType =
  | 'experiences'
  | 'needs'
  | 'competes_with'
  | 'substitutes'
  | 'blocks'
  | 'enables'
  | 'validates'
  | 'contradicts'
  | 'influences'
  | 'depends_on';

export type ResearchGraphView =
  | 'problem'
  | 'customer'
  | 'competitor'
  | 'market'
  | 'opportunity';

export type ResearchGraphSourceKind =
  | 'note'
  | 'interview'
  | 'web'
  | 'file'
  | 'persona_set'
  | 'venture_assumption'
  | 'venture_risk'
  | 'brief';

export interface ResearchGraphSource {
  id: string;
  kind: ResearchGraphSourceKind;
  label: string;
  uri?: string;
  /** Truncated excerpt of the source text (≤2000 chars). Never raw secrets. */
  excerpt?: string;
  addedAt: string;
}

export interface ResearchGraphProvenance {
  /** IDs into ResearchGraph.sources[]. */
  sourceIds: string[];
  extractor: 'llm' | 'rule' | 'manual';
  /** ISO-8601 timestamp the node/edge was extracted. */
  extractedAt: string;
}

export interface ResearchGraphNode {
  id: string;
  type: ResearchGraphNodeType;
  label: string;
  summary?: string;
  /** 0..1. */
  confidence: number;
  /** Verbatim short quotes from source material. */
  evidence: string[];
  provenance: ResearchGraphProvenance;
  /** Computed centrality / degree weight, 0..1. */
  weight?: number;
}

export interface ResearchGraphEdge {
  id: string;
  from: string;
  to: string;
  type: ResearchGraphEdgeType;
  /** 0..1. */
  confidence: number;
  evidence: string[];
  provenance: ResearchGraphProvenance;
}

export interface ResearchGraph {
  kind: 'ResearchGraph';
  graphId?: string;
  ventureId?: string;
  /** ISO-8601 timestamp. Optional for back-compat with Sprint 0 fixtures. */
  createdAt?: string;
  /** Aggregate counts. Always populated when nodes/edges are present. */
  stats: {
    nodes: number;
    edges: number;
    communities: number;
    confidence: Record<Confidence, number>;
  };
  godNodes: Array<{ label: string; degree: number; community: number }>;
  surprisingConnections?: string[];
  evidenceUri?: string;
  /** Sprint 1F full graph payload — optional for back-compat with Sprint 0 stat-only graphs. */
  nodes?: ResearchGraphNode[];
  edges?: ResearchGraphEdge[];
  sources?: ResearchGraphSource[];
  /** Detected directly-conflicting edges/claims (sourceId pairs or short descriptions). */
  contradictions?: string[];
}

export interface ResearchGraphQueryResult {
  question: string;
  matches: ResearchGraphNode[];
  relatedEdges: ResearchGraphEdge[];
}

export interface ResearchGraphPath {
  from: string;
  to: string;
  nodes: ResearchGraphNode[];
  edges: ResearchGraphEdge[];
  hops: number;
}

export interface ResearchGraphEvaluation {
  /** 0..1 — nodes have non-trivial labels and recognised types. */
  nodeRelevance: number;
  /** 0..1 — edges connect distinct nodes with allowed types. */
  edgeUsefulness: number;
  /** 0..1 — proportion of nodes/edges with ≥1 evidence quote. */
  evidenceCoverage: number;
  /** 0..1 — proportion of nodes/edges with at least one provenance source. */
  provenanceCoverage: number;
  /** 0..1 — contradictions were surfaced when contradictory edges exist. */
  contradictionDetection: number;
  /** 0..1 — graph density is in the sane range (not empty, not fully connected). */
  densitySanity: number;
  warnings: string[];
  overallScore: number;
}

export type RecommendationDecision =
  | 'PROCEED'
  | 'PROCEED_WITH_PIVOT_NOTES'
  | 'PIVOT'
  | 'KILL';

export interface Recommendation {
  kind: 'Recommendation';
  decision: RecommendationDecision;
  confidence: number;
  rationale: string[];
  assumptionAudit?: Array<{
    assumption: string;
    status: 'SUPPORTED' | 'WEAK' | 'CONTRADICTED';
    evidence?: string[];
  }>;
  riskRegister?: Array<{
    risk: string;
    severity: 'low' | 'medium' | 'high';
    likelihood: 'low' | 'medium' | 'high';
    mitigation?: string;
  }>;
  pivotNotes?: string[];
  goConditions?: string[];
  evidenceRefs?: string[];
  qualityScore?: number;
}

// ──────────── Provider chat contract ────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parametersSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface CallContext {
  tenantId: string;
  userId?: string;
  ventureId?: string;
  artifactId?: string;
  traceId: string;
  idempotencyKey?: string;
}

export interface ChatRequest {
  model: LogicalModel | string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  toolChoice?: 'auto' | 'none' | 'required' | { name: string };
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json' | { jsonSchema: Record<string, unknown> };
  seed?: number;
  cacheable?: boolean;
  ctx: CallContext;
}

export interface ChatResponse {
  content: string | ToolCall[];
  finishReason: 'stop' | 'length' | 'tool' | 'content_filter' | 'error';
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  cost: { usd: number; provider: ProviderId; model: string };
  cached: boolean;
  providerRequestId?: string;
}

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  supportsJsonSchema: boolean;
  supportsVision: boolean;
  supportsEmbeddings: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}

// ──────────── PersonaLab (Sprint 1D) ────────────

/**
 * Context the user provides when asking PersonaLab to generate a persona set.
 * Mirrors the manual brief shown in the UI: idea + market + region + size + notes.
 */
export interface PersonaLabBrief {
  businessIdea: string;
  targetMarket: string;
  customerType: string;
  region: string;
  businessSize: string;
  additionalContext?: string;
}

/**
 * Richer, PersonaLab-specific projection of a single persona. Compatible with
 * `Persona` because every required key from `Persona` (`id`, `name`) is present
 * and additional keys are allowed by the `[extra: string]: unknown` index.
 *
 * `confidenceScore` is bounded [0,1]. `evidenceNotes` lists short, non-sensitive
 * justifications the generator wrote to support the persona's claims.
 */
export interface PersonaLabPersona {
  id: string;
  name: string;
  role: string;
  businessContext: string;
  goals: string[];
  painPoints: string[];
  motivations: string[];
  objections: string[];
  buyingTriggers: string[];
  decisionPower: 'low' | 'medium' | 'high';
  quote: string;
  confidenceScore: number;
  evidenceNotes: string[];
  [extra: string]: unknown;
}

export interface InterviewTurn {
  speaker: 'interviewer' | 'persona';
  content: string;
}

export interface InterviewTranscript {
  personaId: string;
  topic: string;
  turns: InterviewTurn[];
  summary: string;
}

export interface FocusGroupTurn {
  speakerPersonaId: string;
  content: string;
}

export interface FocusGroupTranscript {
  topic: string;
  participantIds: string[];
  turns: FocusGroupTurn[];
  summary: string;
  agreements: string[];
  disagreements: string[];
}

export type CommitteeStance = 'champion' | 'supporter' | 'neutral' | 'skeptic' | 'blocker';

export interface BuyingCommitteeMember {
  personaId: string;
  committeeRole: string;
  stance: CommitteeStance;
  rationale: string;
  blockingObjections: string[];
}

export interface BuyingCommitteeTranscript {
  offerSummary: string;
  members: BuyingCommitteeMember[];
  decision: 'buy' | 'pilot' | 'defer' | 'reject';
  decisionRationale: string;
  nextSteps: string[];
  /**
   * Multi-phase deliberation record (Sprint 1D.5). Optional for backward
   * compatibility with the single-shot output from Sprint 1D. When present,
   * the decision in this object emerged from explicit agent interaction
   * (initial positions → challenges → responses → consensus) rather than
   * post-hoc stance scoring.
   */
  deliberation?: BuyingCommitteeDeliberation;
}

// ──────────── Agentic buying committee (Sprint 1D.5) ────────────

export type CommitteePosition =
  | 'support'
  | 'support_with_concerns'
  | 'pilot_first'
  | 'reject';

export type ChallengeTopic =
  | 'assumption'
  | 'pricing'
  | 'onboarding'
  | 'roi'
  | 'workflow'
  | 'trust'
  | 'other';

export type ConsensusLevel = 'strong' | 'moderate' | 'weak' | 'split';

export interface ParticipantOpinion {
  personaId: string;
  position: CommitteePosition;
  /** 0..1 — how energised this persona is about the offer. */
  enthusiasm: number;
  concerns: string[];
  willingnessToAdopt: string;
  rationale: string;
}

export interface CommitteeChallenge {
  fromPersonaId: string;
  toPersonaId: string;
  topic: ChallengeTopic;
  argument: string;
}

export interface CommitteeResponse {
  fromPersonaId: string;
  /** Index into `phases.challenges` that this response addresses. */
  challengeIndex: number;
  argument: string;
  changedOpinion: boolean;
}

export interface OpinionChange {
  personaId: string;
  fromPosition: CommitteePosition;
  toPosition: CommitteePosition;
  reason: string;
}

export interface BuyingCommitteeDeliberation {
  phases: {
    initialPositions: ParticipantOpinion[];
    challenges: CommitteeChallenge[];
    responses: CommitteeResponse[];
    consensus: ParticipantOpinion[];
  };
  opinionChanges: OpinionChange[];
  unresolvedObjections: string[];
  strongestSupportingArguments: string[];
  strongestOpposingArguments: string[];
  whatWouldChangeMinds: string[];
  consensusLevel: ConsensusLevel;
  /** 0..1 — model's reported confidence in the final decision. */
  confidenceScore: number;
}

export interface BuyingCommitteeEvaluation {
  /** 0..1 — spread of positions/concerns across participants. */
  diversityOfViewpoints: number;
  /** 0..1 — challenges are specific and on-topic, not generic. */
  challengeQuality: number;
  /** 0..1 — objections are specific, falsifiable, and grounded in persona context. */
  objectionQuality: number;
  /** 0..1 — fraction of participants whose position shifted across phases. */
  opinionMovement: number;
  /** 0..1 — degree of alignment in the consensus phase. */
  consensusStrength: number;
  warnings: string[];
  overallScore: number;
}


export interface PersonaLabInsights {
  topPainPoints: string[];
  topBuyingTriggers: string[];
  topObjections: string[];
  recommendedPositioning: string;
  riskFlags: string[];
  confidence: number;
}

export interface PersonaSetEvaluation {
  diversityScore: number;        // 0..1, higher = more varied roles/contexts
  consistencyScore: number;      // 0..1, internal consistency across persona fields
  roleRealismScore: number;      // 0..1, realistic role + context match
  painPointSpecificityScore: number;
  buyingTriggerQualityScore: number;
  contradictionCount: number;    // count of detected contradictions across personas
  contradictions: string[];
  warnings: string[];
  overallScore: number;          // weighted mean of the five scores
}

// ──────────── VentureLab (Sprint 1E) ────────────────────────────────────────
//
// VentureLab consumes PersonaLab + BuyingCommittee outputs and emits a single
// auditable VentureRecommendation. The decision (PROCEED | PIVOT | KILL) is
// computed by a deterministic rule engine over deterministic scores; LLM calls
// are restricted to evidence extraction and assumption mapping.

export type VentureDecision = 'PROCEED' | 'PIVOT' | 'KILL';

export type EvidenceKind =
  | 'persona'
  | 'interview'
  | 'focus_group'
  | 'committee'
  | 'brief'
  | 'note';

export type EvidenceConfidence = 'low' | 'medium' | 'high';

export interface VentureEvidence {
  kind: EvidenceKind;
  /** Stable identifier: personaId, "deliberation.consensus", "brief.founderAssumptions[0]", etc. */
  source: string;
  quote: string;
  /** 0..1 — relative weight assigned by the extractor. */
  weight: number;
  confidence?: EvidenceConfidence;
}

export type ScoreDimension =
  | 'problemStrength'
  | 'buyerUrgency'
  | 'willingnessToPay'
  | 'differentiation'
  | 'adoptionFriction'
  | 'committeeConfidence'
  | 'executionRisk'
  | 'marketClarity';

export interface VentureScore {
  dimension: ScoreDimension;
  /** 0..100. For risk/friction dimensions, higher = worse. See `higherIsBetter`. */
  score: number;
  higherIsBetter: boolean;
  explanation: string;
  supportingEvidence: VentureEvidence[];
  opposingEvidence: VentureEvidence[];
}

export type AssumptionType = 'explicit' | 'implicit' | 'risky' | 'dependency';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface VentureAssumption {
  id: string;
  text: string;
  type: AssumptionType;
  confidence: EvidenceConfidence;
  evidence: VentureEvidence[];
  riskLevel: RiskLevel;
  validationStrategy: string;
}

export interface VentureRisk {
  id: string;
  risk: string;
  impact: 'low' | 'medium' | 'high';
  likelihood: 'low' | 'medium' | 'high';
  mitigation: string;
  relatedAssumptionIds?: string[];
  relatedDimension?: ScoreDimension;
}

export type ValidationCategory =
  | 'user_research'
  | 'pricing_test'
  | 'onboarding_test'
  | 'competitive_analysis'
  | 'pilot'
  | 'technical_spike'
  | 'market_sizing'
  | 'positioning_test';

export interface ValidationStep {
  id: string;
  title: string;
  category: ValidationCategory;
  /** 1 = highest, 3 = lowest. */
  priority: 1 | 2 | 3;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  /** True when this step blocks the recommended decision until completed. */
  blocksDecision: boolean;
  relatedDimension?: ScoreDimension;
}

export interface VentureRecommendation {
  kind: 'VentureRecommendation';
  recommendationId: string;
  ventureId: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  decision: VentureDecision;
  /** 0..100 — composite weighted score across all dimensions. */
  overallScore: number;
  /** 0..1 — reflects evidence coverage + signal consistency, NOT decision strength. */
  confidenceScore: number;
  executiveSummary: string;
  scores: VentureScore[];
  evidence: VentureEvidence[];
  counterSignals: VentureEvidence[];
  assumptions: VentureAssumption[];
  risks: VentureRisk[];
  nextSteps: ValidationStep[];
  /** Ordered list of plain-English reasons the rule engine returned this decision. */
  decisionRationale: string[];
}

export interface VentureRecommendationEvaluation {
  /** 0..1 — recommendation is internally consistent (score ↔ decision ↔ rationale). */
  recommendationQuality: number;
  /** 0..1 — evidence items are specific, attributed, and not generic. */
  evidenceQuality: number;
  /** 0..1 — assumptions are concrete and have validation strategies. */
  assumptionQuality: number;
  /** 0..1 — risks have non-empty mitigations and concrete impact/likelihood. */
  riskQuality: number;
  /** 0..1 — scores agree with their supporting/opposing evidence directionally. */
  scoreConsistency: number;
  /** 0..1 — the decision matches the score profile per the rule engine. */
  decisionConsistency: number;
  warnings: string[];
  overallScore: number;
}

// ──────────── BuildSquad (Sprint 2A) ────────────────────────────────────────
//
// BuildSquad consumes a VentureRecommendation (+ personas, research graph,
// brief) and emits a BuildSquadArtifactPack: a deterministic-shape bundle of
// planning artifacts (vision, PRD, MVP scope, user stories, architecture
// brief, roadmap, prototype brief), per-agent critiques, and a decision-aware
// header. BuildSquad branches on `VentureDecision`:
//   - PROCEED → full artifact pack
//   - PIVOT   → pivot brief instead of full pack
//   - KILL    → kill rationale + learning summary + alternatives
// BuildSquad makes at most two LLM calls per PROCEED run (drafting + critique)
// and at most one for PIVOT. KILL is purely deterministic.

export type BuildSquadAgentRole =
  | 'pm'
  | 'ux'
  | 'architect'
  | 'backend'
  | 'frontend'
  | 'qa'
  | 'gtm';

export type BuildSquadDecisionMode = 'proceed' | 'pivot' | 'kill';

export type StoryPriority = 'must' | 'should' | 'later';

export interface BuildSquadProductVision {
  problem: string;
  targetUsers: string[];
  productPromise: string;
  whyNow: string;
  differentiation: string[];
  successMetrics: string[];
}

export interface BuildSquadPRDRequirement {
  id: string;
  text: string;
  type: 'functional' | 'non_functional';
  rationale?: string;
}

export interface BuildSquadPRDJourney {
  id: string;
  personaId?: string;
  title: string;
  steps: string[];
}

export interface BuildSquadPRD {
  overview: string;
  goals: string[];
  nonGoals: string[];
  personas: { id: string; name: string; summary: string }[];
  requirements: BuildSquadPRDRequirement[];
  userJourneys: BuildSquadPRDJourney[];
  metrics: string[];
  risks: string[];
}

export interface BuildSquadMVPScope {
  mustHave: string[];
  shouldHave: string[];
  later: string[];
  /** Explicit cuts: things we are deliberately NOT building, with reason. */
  explicitCuts: { item: string; reason: string }[];
}

export interface BuildSquadUserStory {
  id: string;
  title: string;
  personaId?: string;
  story: string;             // "As a … I want … so that …"
  acceptanceCriteria: string[];
  priority: StoryPriority;
}

export interface BuildSquadArchitectureBrief {
  components: { name: string; responsibility: string }[];
  dataFlow: string[];
  integrations: string[];
  storage: string[];
  security: string[];
  scalabilityAssumptions: string[];
}

export interface BuildSquadRoadmapWeek {
  week: 1 | 2 | 3 | 4;
  theme: string;
  deliverables: string[];
}

export interface BuildSquadRoadmap {
  weeks: BuildSquadRoadmapWeek[];
  futureBacklog: string[];
}

export interface BuildSquadPrototypeBrief {
  pages: { name: string; purpose: string }[];
  flows: { name: string; steps: string[] }[];
  uiComponents: string[];
  demoScenario: string;
}

export interface BuildSquadAgentCritique {
  role: BuildSquadAgentRole;
  /** Section the critique is targeting (e.g. "mvp_scope", "user_stories"). */
  targetSection: string;
  severity: 'info' | 'warning' | 'blocker';
  comment: string;
  /** Optional concrete suggested change. */
  suggestion?: string;
}

export interface BuildSquadKillOutput {
  killRationale: string[];
  learningSummary: string[];
  alternativeIdeas: { title: string; rationale: string }[];
  validationGaps: string[];
}

export interface BuildSquadPivotOutput {
  pivotBrief: string;
  revisedProblemStatement: string;
  revisedMvpDirection: string;
  validationPlan: { id: string; title: string; rationale: string }[];
}

export interface BuildSquadInputReferences {
  ventureId: string;
  recommendationId: string;
  /** Optional ResearchGraph identifier. */
  graphId?: string;
  /** Optional PersonaSet identifier. */
  personaSetId?: string;
}

export interface BuildSquadArtifactPack {
  kind: 'BuildSquadArtifactPack';
  artifactId: string;
  ventureId: string;
  createdAt: string;
  /** Mirrors the source VentureRecommendation decision. */
  mode: BuildSquadDecisionMode;
  inputReferences: BuildSquadInputReferences;
  /** Always present, but for KILL mode this is a short "do not build" stub. */
  productVision: BuildSquadProductVision;
  /** Present only for PROCEED. */
  prd?: BuildSquadPRD;
  /** Present only for PROCEED. */
  mvpScope?: BuildSquadMVPScope;
  /** Present only for PROCEED. */
  userStories?: BuildSquadUserStory[];
  /** Present only for PROCEED. */
  architectureBrief?: BuildSquadArchitectureBrief;
  /** Present only for PROCEED. */
  roadmap?: BuildSquadRoadmap;
  /** Present only for PROCEED. */
  prototypeBrief?: BuildSquadPrototypeBrief;
  /** Present only for PIVOT. */
  pivot?: BuildSquadPivotOutput;
  /** Present only for KILL. */
  kill?: BuildSquadKillOutput;
  /** Cross-agent critiques. Empty array allowed (e.g. for KILL mode). */
  agentCritiques: BuildSquadAgentCritique[];
  /** Ordered plain-English notes from the orchestrator: branch chosen, inputs used, etc. */
  rationale: string[];
}

export interface BuildSquadArtifactEvaluation {
  /** 0..1 — required sections are populated for the active mode. */
  completeness: number;
  /** 0..1 — user stories have concrete acceptance criteria. */
  storyQuality: number;
  /** 0..1 — MVP scope shows clear must/should/later separation with cuts. */
  scopeDiscipline: number;
  /** 0..1 — architecture brief touches security, storage, and integrations. */
  architectureCoverage: number;
  /** 0..1 — critiques reference real sections and have severities. */
  critiqueQuality: number;
  warnings: string[];
  overallScore: number;
}



// ──────────── Venture (Sprint 2A.5) ────────────────────────────────────────
//
// The Venture is the top-level container in Foundry. Every PersonaSet,
// ResearchGraph, VentureRecommendation, and BuildSquadArtifactPack belongs to
// exactly one Venture. Artifacts are versioned per (ventureId, kind) and
// every attach emits a VentureTimelineEvent. The Venture is owned by a single
// user_id (tenantId in services) and is never visible across tenants.

export type VentureStatus =
  | 'draft'
  | 'researching'
  | 'validating'
  | 'pivoting'
  | 'approved'
  | 'building'
  | 'archived'
  | 'rejected';

export interface Venture {
  kind: 'Venture';
  ventureId: string;
  ownerId: string;
  title: string;
  description: string;
  problemStatement: string;
  targetMarket: string;
  customerType: string;
  region: string;
  businessSize: string;
  status: VentureStatus;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

export type VentureArtifactKind =
  | 'persona_set'
  | 'interview_transcript'
  | 'focus_group_transcript'
  | 'buying_committee'
  | 'persona_insights'
  | 'research_graph'
  | 'venture_recommendation'
  | 'buildsquad_pack'
  | 'evaluation_report'
  | 'github_repo';

export interface VentureArtifact {
  kind: 'VentureArtifact';
  artifactId: string;
  ventureId: string;
  ownerId: string;
  artifactKind: VentureArtifactKind;
  /** Monotonic per (ventureId, artifactKind), starting at 1. */
  version: number;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** Short human label for the My Ventures dashboard / timeline. */
  summary: string;
  /** Serialised payload — typed at read time by callers. */
  payload: unknown;
}

export type VentureTimelineEventKind =
  | 'venture_created'
  | 'venture_updated'
  | 'venture_archived'
  | 'persona_set_generated'
  | 'interview_run'
  | 'focus_group_run'
  | 'buying_committee_run'
  | 'persona_insights_generated'
  | 'research_graph_built'
  | 'recommendation_generated'
  | 'buildsquad_pack_generated'
  | 'evaluation_report_generated'
  | 'job_started'
  | 'job_progress'
  | 'job_succeeded'
  | 'job_failed'
  | 'github_export_started'
  | 'buildsquad_repo_pushed';

export interface VentureTimelineEvent {
  kind: 'VentureTimelineEvent';
  eventId: string;
  ventureId: string;
  ownerId: string;
  eventKind: VentureTimelineEventKind;
  label: string;
  /** ISO-8601 timestamp. */
  at: string;
  /** Optional reference to the artifact that triggered the event. */
  artifactId?: string;
  /** Optional reference to the job that emitted the event. */
  jobId?: string;
  /**
   * Optional observability metadata copied from the job that emitted the
   * event. Persisted denormalised so timeline queries don't have to JOIN.
   */
  metrics?: VentureJobMetrics;
}

export interface VentureProgress {
  /** 0..100 — derived from artifact coverage. */
  research: number;
  validation: number;
  planning: number;
  buildReadiness: number;
}

export interface VentureReadinessScore {
  /** 0..100 — composite. */
  overall: number;
  /** 0..100 — each axis. */
  personaCoverage: number;
  researchCoverage: number;
  validationConfidence: number;
  buildsquadCompleteness: number;
  riskCoverage: number;
  warnings: string[];
}

export interface VentureSummary {
  venture: Venture;
  progress: VentureProgress;
  readiness: VentureReadinessScore;
  latestRecommendation?: {
    recommendationId: string;
    decision: VentureDecision;
    overallScore: number;
    confidenceScore: number;
    createdAt: string;
  };
  artifactCount: number;
  lastEventAt?: string;
}

// ──────────── VentureJob (Sprint 2A.6) ─────────────────────────────────────
//
// Every long-running unit of work in Foundry is a VentureJob: lab runs,
// GitHub exports, evaluation regenerations. Jobs persist their lifecycle
// (status + progress + observability metrics) so the workspace can survive
// process restarts and surface dead-air to the user.

export type VentureJobKind =
  | 'personalab.generate_personas'
  | 'personalab.run_interview'
  | 'personalab.run_focus_group'
  | 'personalab.run_buying_committee'
  | 'personalab.extract_insights'
  | 'graphify.build'
  | 'venturelab.recommend'
  | 'buildsquad.plan'
  | 'github.export';

export type VentureJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

/**
 * Denormalised observability snapshot copied into timeline events so the UI
 * can render `provider · model · duration · cost` without joining venture_jobs.
 */
export interface VentureJobMetrics {
  executionDurationMs?: number | null;
  providerName?: ProviderId | null;
  providerModel?: string | null;
  estimatedCostCents?: number | null;
  artifactKind?: VentureArtifactKind | null;
  artifactVersion?: number | null;
}

export interface VentureJob {
  kind: 'VentureJob';
  jobId: string;
  ventureId: string;
  ownerId: string;

  jobKind: VentureJobKind;
  status: VentureJobStatus;

  /** 0.0 → 1.0. Best-effort; not all handlers report fine-grained progress. */
  progress: number;
  /** Human label of the current step ("Drafting interviews 2/5"). */
  stepLabel: string | null;

  /** Frozen input payload — never mutated after enqueue. */
  input: unknown;

  /** Set on success. */
  outputArtifactId: string | null;

  /** Set on failure. Always sanitised — no secrets, ≤500 chars. */
  errorCode: string | null;
  errorMessage: string | null;

  /** Lifecycle timestamps. */
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;

  // Observability (mirrors VentureJobMetrics; persisted as columns).
  executionDurationMs: number | null;
  providerName: ProviderId | null;
  providerModel: string | null;
  estimatedCostCents: number | null;
  artifactKind: VentureArtifactKind | null;
  artifactVersion: number | null;

  /** BYOK credential used (provider) or integration credential (github). */
  credentialId: string | null;
}

// ──────────── EvaluationReport (Sprint 2A.6) ───────────────────────────────
//
// First-class artifact summarising a Venture's readiness for shipping.
// Rendered to EVALUATION_REPORT.md in the GitHub export. Both the structured
// payload (this type) and the Markdown live alongside the venture.

export interface EvaluationReportCoverageItem {
  score: number;
  notes: string[];
}

export interface EvaluationReportRiskItem {
  label: string;
  severity: 'low' | 'med' | 'high';
  source: 'recommendation' | 'graph' | 'committee';
}

export interface EvaluationReport {
  kind: 'EvaluationReport';
  reportId: string;
  ventureId: string;
  generatedAt: string;
  generatorVersion: string;

  venture: {
    id: string;
    title: string;
    status: VentureStatus;
    region?: string;
    customerType?: string;
  };

  readinessScore: VentureReadinessScore;

  recommendation: {
    decision: VentureDecision | null;
    confidence: number | null;
    rationale: string[];
    pivotOptions?: string[];
  };

  coverage: {
    persona: EvaluationReportCoverageItem & { count: number };
    research: EvaluationReportCoverageItem & {
      nodeCount: number;
      godNodeCount: number;
      contradictionCount: number;
      topGodNodes: { label: string; weight: number }[];
    };
    risk: EvaluationReportCoverageItem & {
      identifiedRisks: EvaluationReportRiskItem[];
      contradictions: { left: string; right: string }[];
    };
  };

  assumptions: string[];
  openQuestions: string[];
  validationRoadmap: {
    nextSteps: { label: string; owner?: string; dueIn?: string }[];
    successCriteria: string[];
    killCriteria: string[];
  };

  provenance: {
    sourceArtifacts: { kind: VentureArtifactKind; version: number }[];
  };
}

// ──────────── Evaluation aggregates (Sprint 2A.6 — surface stubs) ──────────
//
// These types lock the shape that the evaluation routes will return when
// implemented in Sprint 2B. The routes themselves ship as 501 stubs.

export interface JobMetricsAggregate {
  count: number;
  successRate: number;
  p50DurationMs: number;
  p95DurationMs: number;
  totalCostCents: number;
  byArtifactKind: { artifactKind: VentureArtifactKind; count: number }[];
}

export interface VentureSpendSummary {
  ventureId: string;
  totalCostCents: number;
  totalDurationMs: number;
  jobs: { jobKind: VentureJobKind; count: number; costCents: number }[];
}

// ──────────── GitHubRepo artifact payload (Sprint 2A.6) ────────────────────

export interface GitHubRepoArtifactPayload {
  kind: 'GitHubRepoArtifact';
  owner: string;
  name: string;
  htmlUrl: string;
  defaultBranch: string;
  commitSha: string;
  /** Files written on first export. */
  files: { path: string; sha: string }[];
}

