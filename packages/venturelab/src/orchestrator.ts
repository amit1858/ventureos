/**
 * VentureLab orchestrator.
 *
 * Two LLM calls only:
 *   1. signalsPrompt     → SignalsPayload (evidence per dimension)
 *   2. assumptionsPrompt → VentureAssumption[]
 *
 * Everything else (scoring, decision, risks, next steps, executive summary)
 * is deterministic. The LLM never produces a decision or an overall score.
 */
import type { CallContext, ChatRequest, ChatResponse } from '@ventureos/contracts';

import { analyzeAll, dedupeEvidence } from './analyzers';
import { computeConfidenceScore, computeOverallScore, decide } from './decision';
import { asString, asStringArray, clamp01, parseJsonBlock } from './json';
import { generateNextSteps } from './next-steps';
import { assumptionsPrompt, signalsPrompt } from './prompts';
import { applyResearchGraphAdjustments, applyScoreDeltas } from './research-graph';
import { generateRiskRegister } from './risk-register';
import type {
  ChatFn,
  EvidenceConfidence,
  EvidenceKind,
  SignalsPayload,
  VentureAssumption,
  VentureDecision,
  VentureEvidence,
  VentureLabInput,
  VentureRecommendation,
  VentureScore,
} from './types';

export interface VentureLabOptions {
  model: string;
  ctx: CallContext;
  /** Optional bypass for the LLM — pass a fully-formed signals payload to skip extractSignals. */
  signalsOverride?: SignalsPayload;
  /** Optional bypass for the LLM — pass a fully-formed assumption list to skip mapAssumptions. */
  assumptionsOverride?: VentureAssumption[];
  /** Optional clock for deterministic tests. */
  now?: () => Date;
  /** Optional id generator for deterministic tests. */
  generateId?: () => string;
}

export class VentureLab {
  constructor(private readonly chat: ChatFn, private readonly opts: VentureLabOptions) {}

  async extractSignals(input: VentureLabInput): Promise<SignalsPayload> {
    if (this.opts.signalsOverride) return this.opts.signalsOverride;
    const req: ChatRequest = {
      model: this.opts.model,
      ctx: this.opts.ctx,
      messages: signalsPrompt(input),
      temperature: 0.2,
      maxTokens: 4000,
      responseFormat: 'json',
    };
    const res = await this.chat(req);
    return normalizeSignalsPayload(parseJsonBlock<unknown>(asText(res)));
  }

  async mapAssumptions(input: VentureLabInput): Promise<VentureAssumption[]> {
    if (this.opts.assumptionsOverride) return this.opts.assumptionsOverride;
    const req: ChatRequest = {
      model: this.opts.model,
      ctx: this.opts.ctx,
      messages: assumptionsPrompt(input),
      temperature: 0.2,
      maxTokens: 3000,
      responseFormat: 'json',
    };
    const res = await this.chat(req);
    const parsed = parseJsonBlock<{ assumptions?: unknown }>(asText(res));
    return normalizeAssumptions(parsed?.assumptions);
  }

  async analyze(input: VentureLabInput): Promise<VentureRecommendation> {
    const [signals, assumptions] = await Promise.all([
      this.extractSignals(input),
      this.mapAssumptions(input),
    ]);
    return this.synthesise(input, signals, assumptions);
  }

  /** Pure / deterministic synthesis step. Exposed for tests + tooling. */
  synthesise(
    input: VentureLabInput,
    signals: SignalsPayload,
    assumptions: VentureAssumption[],
  ): VentureRecommendation {
    const baseScores = analyzeAll(signals, input);

    // Sprint 1F — optional ResearchGraph enhancement. Pure / deterministic.
    let scores = baseScores;
    let effectiveAssumptions = assumptions;
    let extraEvidence: VentureEvidence[] = [];
    let extraCounter: VentureEvidence[] = [];
    let graphRationale: string[] = [];
    if (input.researchGraph && (input.researchGraph.nodes?.length ?? 0) > 0) {
      const adj = applyResearchGraphAdjustments(input.researchGraph, baseScores, assumptions);
      scores = applyScoreDeltas(baseScores, adj.scoreDeltas);
      effectiveAssumptions = adj.assumptions;
      extraEvidence = adj.evidence;
      extraCounter = adj.counterSignals;
      graphRationale = adj.rationale;
    }

    const decision = decide(scores);
    const risks = generateRiskRegister(scores, effectiveAssumptions, input);
    const nextSteps = generateNextSteps(scores, effectiveAssumptions);

    const topEvidence = topByWeight(
      dedupeEvidence(
        signals.problemEvidence,
        signals.urgencyEvidence,
        signals.willingnessToPayEvidence,
        signals.differentiationEvidence,
        signals.marketClarityEvidence,
        extraEvidence,
      ),
      8,
    );
    const counterSignals = topByWeight(
      dedupeEvidence(signals.adoptionFrictionEvidence, signals.executionRiskEvidence, extraCounter),
      8,
    );

    const executiveSummary = buildExecutiveSummary(input, decision.decision, decision.overallScore, scores);

    const now = (this.opts.now ?? (() => new Date()))();
    const recommendationId = this.opts.generateId?.() ?? defaultId('rec');

    return {
      kind: 'VentureRecommendation',
      recommendationId,
      ventureId: input.ventureId,
      createdAt: now.toISOString(),
      decision: decision.decision,
      overallScore: decision.overallScore,
      confidenceScore: decision.confidenceScore,
      executiveSummary,
      scores,
      evidence: topEvidence,
      counterSignals,
      assumptions: effectiveAssumptions,
      risks,
      nextSteps,
      decisionRationale: [...decision.rationale, ...graphRationale],
    };
  }
}

// Re-export the engine helpers for convenience.
export { computeOverallScore, computeConfidenceScore, decide };

function asText(res: ChatResponse): string {
  if (typeof res.content === 'string') return res.content;
  // The signal/assumption prompts never request tool calls; if the provider
  // returned tool-calls, surface the first one's arguments as JSON.
  const first = res.content[0];
  return first ? JSON.stringify(first.arguments ?? {}) : '';
}

function topByWeight(items: VentureEvidence[], n: number): VentureEvidence[] {
  return [...items].sort((a, b) => b.weight - a.weight).slice(0, n);
}

function decisionVerb(d: VentureDecision): string {
  return d === 'PROCEED' ? 'Proceed' : d === 'PIVOT' ? 'Pivot' : 'Kill';
}

function buildExecutiveSummary(
  input: VentureLabInput,
  decision: VentureDecision,
  overallScore: number,
  scores: VentureScore[],
): string {
  const top = [...scores].filter((s) => s.higherIsBetter).sort((a, b) => b.score - a.score)[0];
  const bottom = [...scores].filter((s) => s.higherIsBetter).sort((a, b) => a.score - b.score)[0];
  const friction = scores.find((s) => s.dimension === 'adoptionFriction');
  const verb = decisionVerb(decision);
  const target = input.brief.targetMarket || 'the target market';
  return [
    `${verb} on "${input.brief.businessIdea}" (composite ${overallScore}/100).`,
    top ? `Strongest signal: ${top.dimension} ${top.score}/100.` : '',
    bottom ? `Weakest signal: ${bottom.dimension} ${bottom.score}/100.` : '',
    friction ? `Adoption friction: ${friction.score}/100 (higher = worse).` : '',
    `Target buyer: ${target}.`,
  ].filter(Boolean).join(' ');
}

function defaultId(prefix: string): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${t}_${r}`;
}

// ───────────── Normalisers (defensive over LLM JSON) ─────────────

const EV_KINDS: ReadonlySet<EvidenceKind> = new Set([
  'persona', 'interview', 'focus_group', 'committee', 'brief', 'note',
]);
const EV_CONFIDENCES: ReadonlySet<EvidenceConfidence> = new Set(['low', 'medium', 'high']);

function normalizeEvidence(raw: unknown): VentureEvidence[] {
  if (!Array.isArray(raw)) return [];
  const out: VentureEvidence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const kindRaw = asString(it.kind, 'note');
    const kind: EvidenceKind = EV_KINDS.has(kindRaw as EvidenceKind) ? (kindRaw as EvidenceKind) : 'note';
    const source = asString(it.source, '').slice(0, 240);
    const quote = asString(it.quote, '').slice(0, 600);
    if (!quote) continue;
    const weight = clamp01(it.weight, 0.5);
    const confRaw = asString(it.confidence, '');
    const confidence = EV_CONFIDENCES.has(confRaw as EvidenceConfidence)
      ? (confRaw as EvidenceConfidence) : undefined;
    out.push({ kind, source, quote, weight, ...(confidence ? { confidence } : {}) });
  }
  return out;
}

function normalizeSignalsPayload(raw: unknown): SignalsPayload {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    problemEvidence: normalizeEvidence(obj.problemEvidence),
    urgencyEvidence: normalizeEvidence(obj.urgencyEvidence),
    willingnessToPayEvidence: normalizeEvidence(obj.willingnessToPayEvidence),
    differentiationEvidence: normalizeEvidence(obj.differentiationEvidence),
    adoptionFrictionEvidence: normalizeEvidence(obj.adoptionFrictionEvidence),
    executionRiskEvidence: normalizeEvidence(obj.executionRiskEvidence),
    marketClarityEvidence: normalizeEvidence(obj.marketClarityEvidence),
  };
}

const A_TYPES = new Set(['explicit', 'implicit', 'risky', 'dependency']);
const A_RISKS = new Set(['low', 'medium', 'high', 'critical']);

function normalizeAssumptions(raw: unknown): VentureAssumption[] {
  if (!Array.isArray(raw)) return [];
  const out: VentureAssumption[] = [];
  let i = 1;
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const text = asString(it.text, '').slice(0, 600);
    if (!text) continue;
    const id = asString(it.id, '') || `a${i}`;
    const typeRaw = asString(it.type, 'implicit');
    const type = A_TYPES.has(typeRaw) ? (typeRaw as VentureAssumption['type']) : 'implicit';
    const confRaw = asString(it.confidence, 'medium');
    const confidence: EvidenceConfidence = EV_CONFIDENCES.has(confRaw as EvidenceConfidence)
      ? (confRaw as EvidenceConfidence) : 'medium';
    const riskRaw = asString(it.riskLevel, 'medium');
    const riskLevel = A_RISKS.has(riskRaw) ? (riskRaw as VentureAssumption['riskLevel']) : 'medium';
    const validationStrategy = asString(it.validationStrategy, '').slice(0, 400);
    const evidence = normalizeEvidence(it.evidence);
    out.push({ id, text, type, confidence, riskLevel, validationStrategy, evidence });
    i += 1;
  }
  return out;
}

// Tiny utility — expose for tests that want to round-trip arbitrary assumption text lists.
export function assumptionsFromStrings(items: string[]): VentureAssumption[] {
  return asStringArray(items).map((text, i) => ({
    id: `a${i + 1}`,
    text,
    type: 'explicit',
    confidence: 'medium',
    riskLevel: 'medium',
    validationStrategy: '',
    evidence: [],
  }));
}
