/**
 * PersonaLab — TypeScript orchestration types.
 *
 * These mirror the contract types in `@foundry/contracts` but live here so the
 * package can build independently of UI/route layers.
 */
import type {
  PersonaLabBrief,
  PersonaLabPersona,
  InterviewTranscript,
  FocusGroupTranscript,
  BuyingCommitteeTranscript,
  BuyingCommitteeDeliberation,
  BuyingCommitteeEvaluation,
  ParticipantOpinion,
  CommitteeChallenge,
  CommitteeResponse,
  OpinionChange,
  CommitteePosition,
  ConsensusLevel,
  ChallengeTopic,
  PersonaLabInsights,
  PersonaSetEvaluation,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from '@foundry/contracts';
import type { WorkflowStage } from '@foundry/providers-core';

export type {
  PersonaLabBrief,
  PersonaLabPersona,
  InterviewTranscript,
  FocusGroupTranscript,
  BuyingCommitteeTranscript,
  BuyingCommitteeDeliberation,
  BuyingCommitteeEvaluation,
  ParticipantOpinion,
  CommitteeChallenge,
  CommitteeResponse,
  OpinionChange,
  CommitteePosition,
  ConsensusLevel,
  ChallengeTopic,
  PersonaLabInsights,
  PersonaSetEvaluation,
};

/**
 * Function that issues one chat call. Wired by the host: in the web app it
 * targets the user's selected BYOK provider via the provider adapter layer.
 * The orchestrator never sees the plaintext secret.
 */
export type ChatFn = (req: ChatRequest) => Promise<ChatResponse>;

/**
 * Per-generation telemetry emitted by the engine after each structured call.
 * Carries real usage (fixing the previous $0.00 cost reporting) plus the
 * robustness signals from the shared structured-output pipeline: whether JSON
 * repair ran, whether a semantic retry was needed, and the final status.
 */
export interface GenerationTelemetry {
  provider: ProviderId;
  model: string;
  stage: WorkflowStage;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Undefined when the resolved capability has no pricing metadata. */
  estimatedCostUsd?: number;
  finishReason: ChatResponse['finishReason'];
  jsonRepairApplied: boolean;
  repairSucceeded: boolean;
  truncated: boolean;
  retryCount: number;
  finalStatus: 'ok' | 'repaired' | 'retried' | 'failed';
  latencyMs: number;
}

/** Sink the host wires to forward {@link GenerationTelemetry} into usage/logging. */
export type GenerationTelemetrySink = (telemetry: GenerationTelemetry) => void;

export interface PersonaLabEngine {
  generatePersonas(input: { brief: PersonaLabBrief; n?: number }): Promise<PersonaLabPersona[]>;
  runInterview(input: {
    persona: PersonaLabPersona;
    topic: string;
    questions: string[];
    brief: PersonaLabBrief;
  }): Promise<InterviewTranscript>;
  runFocusGroup(input: {
    personas: PersonaLabPersona[];
    topic: string;
    brief: PersonaLabBrief;
    rounds?: number;
  }): Promise<FocusGroupTranscript>;
  runBuyingCommittee(input: {
    personas: PersonaLabPersona[];
    offerSummary: string;
    brief: PersonaLabBrief;
  }): Promise<BuyingCommitteeTranscript>;
  extractInsights(input: {
    personas: PersonaLabPersona[];
    transcripts: Array<InterviewTranscript | FocusGroupTranscript>;
  }): Promise<PersonaLabInsights>;
  validatePersonaSet(input: { personas: PersonaLabPersona[] }): Promise<PersonaSetEvaluation>;
}
