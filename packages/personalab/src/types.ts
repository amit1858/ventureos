/**
 * PersonaLab — TypeScript orchestration types.
 *
 * These mirror the contract types in `@ventureos/contracts` but live here so the
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
} from '@ventureos/contracts';

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
