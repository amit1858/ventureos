/**
 * BuildSquad — re-exports of all contract types it consumes/produces plus a
 * small set of internal payload types for the drafting + critique LLM calls.
 *
 * BuildSquad's branching:
 *   - PROCEED → drafting LLM call + critique LLM call → full artifact pack
 *   - PIVOT   → single pivot LLM call → pivot output only
 *   - KILL    → pure deterministic from VentureRecommendation; no LLM call
 */
import type {
  BuildSquadAgentCritique,
  BuildSquadAgentRole,
  BuildSquadArchitectureBrief,
  BuildSquadArtifactEvaluation,
  BuildSquadArtifactPack,
  BuildSquadDecisionMode,
  BuildSquadInputReferences,
  BuildSquadKillOutput,
  BuildSquadMVPScope,
  BuildSquadPivotOutput,
  BuildSquadPRD,
  BuildSquadPRDJourney,
  BuildSquadPRDRequirement,
  BuildSquadProductVision,
  BuildSquadPrototypeBrief,
  BuildSquadRoadmap,
  BuildSquadRoadmapWeek,
  BuildSquadUserStory,
  CallContext,
  ChatRequest,
  ChatResponse,
  IdeaBrief,
  PersonaLabPersona,
  ResearchGraph,
  StoryPriority,
  VentureRecommendation,
} from '@ventureos/contracts';

export type {
  BuildSquadAgentCritique,
  BuildSquadAgentRole,
  BuildSquadArchitectureBrief,
  BuildSquadArtifactEvaluation,
  BuildSquadArtifactPack,
  BuildSquadDecisionMode,
  BuildSquadInputReferences,
  BuildSquadKillOutput,
  BuildSquadMVPScope,
  BuildSquadPivotOutput,
  BuildSquadPRD,
  BuildSquadPRDJourney,
  BuildSquadPRDRequirement,
  BuildSquadProductVision,
  BuildSquadPrototypeBrief,
  BuildSquadRoadmap,
  BuildSquadRoadmapWeek,
  BuildSquadUserStory,
  CallContext,
  ChatRequest,
  ChatResponse,
  IdeaBrief,
  PersonaLabPersona,
  ResearchGraph,
  StoryPriority,
  VentureRecommendation,
};

export type ChatFn = (req: ChatRequest) => Promise<ChatResponse>;

export interface BuildSquadInput {
  /** Required — drives branching and all references back to the source venture. */
  recommendation: VentureRecommendation;
  /** Optional but recommended — gives drafting a concrete idea description. */
  brief?: IdeaBrief | {
    businessIdea?: string;
    targetMarket?: string;
    customerType?: string;
    region?: string;
    businessSize?: string;
    additionalContext?: string;
  };
  personas?: PersonaLabPersona[];
  researchGraph?: ResearchGraph;
}

export interface BuildSquadOptions {
  model: string;
  ctx: CallContext;
  /** Optional bypass — supply a fully-formed draft to skip the drafting LLM call. */
  draftOverride?: BuildSquadDraftPayload;
  /** Optional bypass — supply a fully-formed critique list to skip the critique LLM call. */
  critiqueOverride?: BuildSquadAgentCritique[];
  /** Optional bypass for PIVOT mode. */
  pivotOverride?: BuildSquadPivotOutput;
  /** Optional clock for deterministic tests. */
  now?: () => Date;
  /** Optional id generator for deterministic tests. */
  generateId?: () => string;
}

/** Shape of the LLM drafting response (mirrors PROCEED artifact subfields). */
export interface BuildSquadDraftPayload {
  productVision?: BuildSquadProductVision;
  prd?: BuildSquadPRD;
  mvpScope?: BuildSquadMVPScope;
  userStories?: BuildSquadUserStory[];
  architectureBrief?: BuildSquadArchitectureBrief;
  roadmap?: BuildSquadRoadmap;
  prototypeBrief?: BuildSquadPrototypeBrief;
}

export class BuildSquadError extends Error {
  readonly reason?: unknown;
  constructor(message: string, reason?: unknown) {
    super(message);
    this.name = 'BuildSquadError';
    if (reason !== undefined) this.reason = reason;
  }
}
