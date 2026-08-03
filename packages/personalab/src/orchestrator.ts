/**
 * PersonaLab LLM-orchestrated engine.
 *
 * Mirrors the semantics of Microsoft TinyTroupe (named agents with role,
 * occupation, personality; multi-agent dialogue) but runs entirely inside the
 * Foundry provider abstraction. The engine accepts a single `ChatFn` and
 * never touches a provider SDK directly — the host wires that function with the
 * decrypted BYOK secret, scoped to the lifetime of one orchestration call.
 *
 * The optional TinyTroupe Python subprocess engine lives in `tinytroupe.ts` and
 * is selected by the host when `VENTUREOS_TINYTROUPE_PYTHON` is set.
 */
import type { ChatRequest, CallContext, ProviderId } from '@foundry/contracts';
import {
  generateStructured,
  recommendedBudget,
  resolveCapability,
  StructuredParseError,
  type ModelCapability,
  type StructuredTelemetry,
  type WorkflowStage,
} from '@foundry/providers-core';

import { evaluatePersonaSet } from './evaluation';
import { asString, asStringArray, clamp01, PersonaLabParseError } from './json';
import {
  bcChallengePrompt,
  bcConsensusPrompt,
  bcInitialPositionsPrompt,
  bcResponsePrompt,
  focusGroupPrompt,
  generatePersonasPrompt,
  insightsPrompt,
  interviewPrompt,
} from './prompts';
import type {
  BuyingCommitteeDeliberation,
  BuyingCommitteeTranscript,
  ChatFn,
  CommitteeChallenge,
  CommitteePosition,
  CommitteeResponse,
  ConsensusLevel,
  FocusGroupTranscript,
  GenerationTelemetry,
  GenerationTelemetrySink,
  InterviewTranscript,
  OpinionChange,
  ParticipantOpinion,
  PersonaLabBrief,
  PersonaLabEngine,
  PersonaLabInsights,
  PersonaLabPersona,
  PersonaSetEvaluation,
} from './types';

export interface PersonaLabOptions {
  /** Model id passed through to the provider. Caller picks based on user's BYOK profile. */
  model: string;
  /** Required tenant/trace context for the provider call. */
  ctx: CallContext;
  /**
   * Provider the model belongs to. Drives capability resolution (verbosity,
   * native JSON support, output ceiling) so budgeting and structured-output
   * handling adapt automatically — no per-provider branching in the workflow.
   * Defaults to `'openai'` when omitted (backward compatible).
   */
  provider?: ProviderId;
  /** Optional sink for per-generation telemetry (usage, finishReason, repair, retry). */
  onTelemetry?: GenerationTelemetrySink;
  /**
   * Explicit output-budget overrides. When unset, budgets are derived
   * adaptively from the resolved capability + workflow stage.
   */
  maxTokensPersonas?: number;
  maxTokensTranscript?: number;
  maxTokensInsights?: number;
}

export class PersonaLab implements PersonaLabEngine {
  /** Resolved once from (provider, model): verbosity, JSON support, ceiling, cost. */
  private readonly capability: ModelCapability;

  constructor(
    private readonly chat: ChatFn,
    private readonly opts: PersonaLabOptions,
  ) {
    this.capability = resolveCapability(opts.provider ?? 'openai', opts.model);
  }

  async generatePersonas(input: {
    brief: PersonaLabBrief;
    n?: number;
  }): Promise<PersonaLabPersona[]> {
    const n = Math.max(1, Math.min(12, input.n ?? 6));
    return this.generate(
      'personas',
      generatePersonasPrompt(input.brief, n),
      this.opts.maxTokensPersonas,
      (parsed) => {
        const json = parsed as { personas?: unknown };
        const arr = Array.isArray(json.personas) ? json.personas : [];
        return arr.map((p, i) => coercePersona(p, i));
      },
    );
  }

  async runInterview(input: {
    persona: PersonaLabPersona;
    topic: string;
    questions: string[];
    brief: PersonaLabBrief;
  }): Promise<InterviewTranscript> {
    return this.generate(
      'interview',
      interviewPrompt(input.persona, input.brief, input.topic, input.questions),
      this.opts.maxTokensTranscript,
      (parsed) => coerceInterview(parsed as Record<string, unknown>, input.persona.id, input.topic),
    );
  }

  async runFocusGroup(input: {
    personas: PersonaLabPersona[];
    topic: string;
    brief: PersonaLabBrief;
    rounds?: number;
  }): Promise<FocusGroupTranscript> {
    const rounds = Math.max(1, Math.min(5, input.rounds ?? 3));
    return this.generate(
      'focusGroup',
      focusGroupPrompt(input.personas, input.brief, input.topic, rounds),
      this.opts.maxTokensTranscript,
      (parsed) => coerceFocusGroup(parsed as Record<string, unknown>, input.personas, input.topic),
    );
  }

  async runBuyingCommittee(input: {
    personas: PersonaLabPersona[];
    offerSummary: string;
    brief: PersonaLabBrief;
  }): Promise<BuyingCommitteeTranscript> {
    const { personas, brief, offerSummary } = input;
    const ids = new Set(personas.map((p) => p.id));

    // Phase 1 — initial positions
    const initialPositions = await this.generate(
      'buyingCommittee',
      bcInitialPositionsPrompt(personas, brief, offerSummary),
      this.opts.maxTokensTranscript,
      (p) => coerceOpinions((p as Record<string, unknown>)['initialPositions'], ids),
    );

    // Phase 2 — challenges
    const challenges = await this.generate(
      'buyingCommittee',
      bcChallengePrompt(personas, brief, offerSummary, initialPositions),
      this.opts.maxTokensTranscript,
      (p) => coerceChallenges((p as Record<string, unknown>)['challenges'], ids),
    );

    // Phase 3 — responses
    const responses = await this.generate(
      'buyingCommittee',
      bcResponsePrompt(personas, brief, offerSummary, initialPositions, challenges),
      this.opts.maxTokensTranscript,
      (p) => coerceResponses((p as Record<string, unknown>)['responses'], ids, challenges.length),
    );

    // Phase 4+5 — consensus and decision
    const j4 = await this.generate(
      'buyingCommittee',
      bcConsensusPrompt(personas, brief, offerSummary, initialPositions, challenges, responses),
      this.opts.maxTokensTranscript,
      (p) => p as Record<string, unknown>,
    );
    const consensus = coerceOpinions(j4['consensus'], ids);
    const opinionChanges = coerceOpinionChanges(j4['opinionChanges'], ids);

    const deliberation: BuyingCommitteeDeliberation = {
      phases: { initialPositions, challenges, responses, consensus },
      opinionChanges,
      unresolvedObjections: asStringArray(j4['unresolvedObjections']),
      strongestSupportingArguments: asStringArray(j4['strongestSupportingArguments']),
      strongestOpposingArguments: asStringArray(j4['strongestOpposingArguments']),
      whatWouldChangeMinds: asStringArray(j4['whatWouldChangeMinds']),
      consensusLevel: coerceConsensusLevel(j4['consensusLevel'], consensus),
      confidenceScore: clamp01(j4['confidenceScore'], 0.5),
    };

    const decision = coerceDecision(j4['decision'], consensus);
    const members = deriveMembers(personas, initialPositions, consensus);

    return {
      offerSummary,
      members,
      decision,
      decisionRationale: asString(j4['decisionRationale']),
      nextSteps: asStringArray(j4['nextSteps']),
      deliberation,
    };
  }

  async extractInsights(input: {
    personas: PersonaLabPersona[];
    transcripts: Array<InterviewTranscript | FocusGroupTranscript>;
  }): Promise<PersonaLabInsights> {
    return this.generate(
      'insights',
      insightsPrompt(input.personas, input.transcripts),
      this.opts.maxTokensInsights,
      (parsed) => {
        const json = parsed as Record<string, unknown>;
        return {
          topPainPoints: asStringArray(json['topPainPoints']),
          topBuyingTriggers: asStringArray(json['topBuyingTriggers']),
          topObjections: asStringArray(json['topObjections']),
          recommendedPositioning: asString(json['recommendedPositioning']),
          riskFlags: asStringArray(json['riskFlags']),
          confidence: clamp01(json['confidence'], 0.5),
        };
      },
    );
  }

  async validatePersonaSet(input: {
    personas: PersonaLabPersona[];
  }): Promise<PersonaSetEvaluation> {
    return evaluatePersonaSet(input.personas);
  }

  /**
   * Single provider-independent structured-generation path. Resolves the output
   * budget adaptively (unless the host set an explicit override), runs the
   * shared pipeline (parse → repair → validate → one retry), and emits telemetry.
   */
  private async generate<T>(
    stage: WorkflowStage,
    messages: ChatRequest['messages'],
    override: number | undefined,
    coerce: (parsed: unknown) => T,
  ): Promise<T> {
    const budget = override ?? recommendedBudget(this.capability, stage);
    const request = this.buildRequest(messages, budget);
    let result;
    try {
      result = await generateStructured<T>({
        chat: this.chat,
        request,
        coerce,
        retryMaxTokens: this.capability.maxOutputTokens,
      });
    } catch (err) {
      // Preserve PersonaLab's public error contract: the shared pipeline throws
      // a provider-neutral StructuredParseError, but callers (and tests) expect
      // PersonaLabParseError with its secret-redacted preview.
      if (err instanceof StructuredParseError) {
        throw new PersonaLabParseError('Failed to parse model response.', err.raw);
      }
      throw err;
    }
    const { data, telemetry } = result;
    this.emitTelemetry(stage, telemetry);
    return data;
  }

  private emitTelemetry(stage: WorkflowStage, t: StructuredTelemetry): void {
    const sink = this.opts.onTelemetry;
    if (!sink) return;
    const cap = this.capability;
    const estimatedCostUsd = cap.cost
      ? (t.usage.promptTokens / 1000) * cap.cost.inputUsdPer1k +
        (t.usage.completionTokens / 1000) * cap.cost.outputUsdPer1k
      : undefined;
    const event: GenerationTelemetry = {
      provider: cap.provider,
      model: this.opts.model,
      stage,
      promptTokens: t.usage.promptTokens,
      completionTokens: t.usage.completionTokens,
      totalTokens: t.usage.totalTokens,
      ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
      finishReason: t.finishReason,
      jsonRepairApplied: t.repairApplied,
      repairSucceeded: t.repairSucceeded,
      truncated: t.truncated,
      retryCount: t.retryCount,
      finalStatus: t.finalStatus,
      latencyMs: t.latencyMs,
    };
    sink(event);
  }

  private buildRequest(messages: ChatRequest['messages'], maxTokens: number): ChatRequest {
    return {
      model: this.opts.model,
      messages,
      temperature: 0.7,
      maxTokens,
      responseFormat: 'json',
      ctx: this.opts.ctx,
    };
  }
}

// ── coercion helpers ─────────────────────────────────────────────────────────

function coercePersona(raw: unknown, idx: number): PersonaLabPersona {
  const o = (raw ?? {}) as Record<string, unknown>;
  const decisionPower = (() => {
    const v = asString(o['decisionPower'], 'medium').toLowerCase();
    return v === 'low' || v === 'medium' || v === 'high' ? v : 'medium';
  })();
  return {
    id: asString(o['id'], `p${idx + 1}`),
    name: asString(o['name'], `Persona ${idx + 1}`),
    role: asString(o['role'], 'Stakeholder'),
    businessContext: asString(o['businessContext']),
    goals: asStringArray(o['goals']),
    painPoints: asStringArray(o['painPoints']),
    motivations: asStringArray(o['motivations']),
    objections: asStringArray(o['objections']),
    buyingTriggers: asStringArray(o['buyingTriggers']),
    decisionPower: decisionPower as PersonaLabPersona['decisionPower'],
    quote: asString(o['quote']),
    confidenceScore: clamp01(o['confidenceScore'], 0.6),
    evidenceNotes: asStringArray(o['evidenceNotes']),
  };
}

function coerceInterview(
  json: Record<string, unknown>,
  personaId: string,
  topic: string,
): InterviewTranscript {
  const rawTurns = Array.isArray(json['turns']) ? json['turns'] : [];
  const turns = rawTurns
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      const speaker = asString(o['speaker']).toLowerCase() === 'interviewer' ? 'interviewer' : 'persona';
      return { speaker: speaker as 'interviewer' | 'persona', content: asString(o['content']) };
    })
    .filter((t) => t.content.length > 0);
  return {
    personaId: asString(json['personaId'], personaId),
    topic: asString(json['topic'], topic),
    turns,
    summary: asString(json['summary']),
  };
}

function coerceFocusGroup(
  json: Record<string, unknown>,
  personas: PersonaLabPersona[],
  topic: string,
): FocusGroupTranscript {
  const ids = new Set(personas.map((p) => p.id));
  const rawTurns = Array.isArray(json['turns']) ? json['turns'] : [];
  const turns = rawTurns
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      return {
        speakerPersonaId: asString(o['speakerPersonaId']),
        content: asString(o['content']),
      };
    })
    .filter((t) => t.content.length > 0 && ids.has(t.speakerPersonaId));
  return {
    topic: asString(json['topic'], topic),
    participantIds: personas.map((p) => p.id),
    turns,
    summary: asString(json['summary']),
    agreements: asStringArray(json['agreements']),
    disagreements: asStringArray(json['disagreements']),
  };
}

// ── deliberation helpers (Sprint 1D.5) ───────────────────────────────────────

const VALID_POSITIONS: ReadonlyArray<CommitteePosition> = [
  'support',
  'support_with_concerns',
  'pilot_first',
  'reject',
];

const VALID_TOPICS: ReadonlyArray<string> = [
  'assumption',
  'pricing',
  'onboarding',
  'roi',
  'workflow',
  'trust',
  'other',
];

function coercePosition(
  v: unknown,
  fallback: CommitteePosition = 'support_with_concerns',
): CommitteePosition {
  const s = asString(v, fallback).toLowerCase();
  return (VALID_POSITIONS as ReadonlyArray<string>).includes(s)
    ? (s as CommitteePosition)
    : fallback;
}

function coerceOpinions(raw: unknown, ids: Set<string>): ParticipantOpinion[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((o) => {
      const x = (o ?? {}) as Record<string, unknown>;
      return {
        personaId: asString(x['personaId']),
        position: coercePosition(x['position']),
        enthusiasm: clamp01(x['enthusiasm'], 0.5),
        concerns: asStringArray(x['concerns']),
        willingnessToAdopt: asString(x['willingnessToAdopt']),
        rationale: asString(x['rationale']),
      };
    })
    .filter((o) => ids.has(o.personaId));
}

function coerceChallenges(raw: unknown, ids: Set<string>): CommitteeChallenge[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((c) => {
      const x = (c ?? {}) as Record<string, unknown>;
      const topic = asString(x['topic'], 'other').toLowerCase();
      return {
        fromPersonaId: asString(x['fromPersonaId']),
        toPersonaId: asString(x['toPersonaId']),
        topic: (VALID_TOPICS.includes(topic) ? topic : 'other') as CommitteeChallenge['topic'],
        argument: asString(x['argument']),
      };
    })
    .filter(
      (c) =>
        c.argument.length > 0 &&
        ids.has(c.fromPersonaId) &&
        ids.has(c.toPersonaId) &&
        c.fromPersonaId !== c.toPersonaId,
    );
}

function coerceResponses(
  raw: unknown,
  ids: Set<string>,
  challengeCount: number,
): CommitteeResponse[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((r) => {
      const x = (r ?? {}) as Record<string, unknown>;
      const idx = Number(x['challengeIndex']);
      return {
        fromPersonaId: asString(x['fromPersonaId']),
        challengeIndex: Number.isInteger(idx) ? idx : -1,
        argument: asString(x['argument']),
        changedOpinion: x['changedOpinion'] === true,
      };
    })
    .filter(
      (r) =>
        r.argument.length > 0 &&
        ids.has(r.fromPersonaId) &&
        r.challengeIndex >= 0 &&
        r.challengeIndex < challengeCount,
    );
}

function coerceOpinionChanges(raw: unknown, ids: Set<string>): OpinionChange[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((o) => {
      const x = (o ?? {}) as Record<string, unknown>;
      return {
        personaId: asString(x['personaId']),
        fromPosition: coercePosition(x['fromPosition']),
        toPosition: coercePosition(x['toPosition']),
        reason: asString(x['reason']),
      };
    })
    .filter((o) => ids.has(o.personaId) && o.fromPosition !== o.toPosition);
}

function derivedConsensusLevel(consensus: ParticipantOpinion[]): ConsensusLevel {
  if (consensus.length === 0) return 'weak';
  const counts = new Map<CommitteePosition, number>();
  for (const o of consensus) counts.set(o.position, (counts.get(o.position) ?? 0) + 1);
  const max = Math.max(...counts.values());
  const ratio = max / consensus.length;
  if (counts.size === 1) return 'strong';
  if (counts.size >= 3) return 'split';
  if (ratio >= 0.75) return 'moderate';
  return 'weak';
}

function coerceConsensusLevel(
  v: unknown,
  consensus: ParticipantOpinion[],
): ConsensusLevel {
  const s = asString(v, '').toLowerCase();
  if (s === 'strong' || s === 'moderate' || s === 'weak' || s === 'split') {
    return s as ConsensusLevel;
  }
  return derivedConsensusLevel(consensus);
}

function coerceDecision(
  v: unknown,
  consensus: ParticipantOpinion[],
): BuyingCommitteeTranscript['decision'] {
  const s = asString(v, '').toLowerCase();
  if (s === 'buy' || s === 'pilot' || s === 'defer' || s === 'reject') {
    return s as BuyingCommitteeTranscript['decision'];
  }
  if (consensus.length === 0) return 'defer';
  const counts: Record<CommitteePosition, number> = {
    support: 0,
    support_with_concerns: 0,
    pilot_first: 0,
    reject: 0,
  };
  for (const o of consensus) counts[o.position] += 1;
  if (counts.reject > consensus.length / 2) return 'reject';
  if (counts.support === consensus.length) return 'buy';
  if (counts.support + counts.support_with_concerns > consensus.length / 2) return 'pilot';
  return 'defer';
}

const POSITION_TO_STANCE: Record<
  CommitteePosition,
  BuyingCommitteeTranscript['members'][number]['stance']
> = {
  support: 'champion',
  support_with_concerns: 'supporter',
  pilot_first: 'neutral',
  reject: 'blocker',
};

/**
 * Back-compat view: derive the flat `members[]` shape from the final consensus.
 * Stance comes from the structural position mapping, refined by enthusiasm —
 * no keyword scoring.
 */
function deriveMembers(
  personas: PersonaLabPersona[],
  initialPositions: ParticipantOpinion[],
  consensus: ParticipantOpinion[],
): BuyingCommitteeTranscript['members'] {
  const finalById = new Map(consensus.map((o) => [o.personaId, o]));
  const initialById = new Map(initialPositions.map((o) => [o.personaId, o]));
  return personas.map((p) => {
    const opinion = finalById.get(p.id) ?? initialById.get(p.id);
    if (!opinion) {
      return {
        personaId: p.id,
        committeeRole: p.role || 'Participant',
        stance: 'neutral' as const,
        rationale: '',
        blockingObjections: [],
      };
    }
    let stance = POSITION_TO_STANCE[opinion.position];
    if (stance === 'champion' && opinion.enthusiasm < 0.7) stance = 'supporter';
    if (stance === 'blocker' && opinion.enthusiasm > 0.3) stance = 'skeptic';
    return {
      personaId: p.id,
      committeeRole: p.role || 'Participant',
      stance,
      rationale: opinion.rationale,
      blockingObjections:
        opinion.position === 'reject' || opinion.position === 'pilot_first'
          ? opinion.concerns
          : [],
    };
  });
}
