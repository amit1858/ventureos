/**
 * BuildSquad orchestrator.
 *
 * `run(input)` branches on `input.recommendation.decision`:
 *   - PROCEED → draft LLM call + critique LLM call → full artifact pack
 *   - PIVOT   → single pivot LLM call → pivot output (no PRD/MVP/etc.)
 *   - KILL    → pure deterministic kill output (no LLM call)
 *
 * Every LLM failure is caught; deterministic fallbacks keep the artifact pack
 * usable so the UI is never left blank. The decrypted secret never reaches
 * this layer — `ChatFn` is the only surface.
 */
import type { ChatRequest, ChatResponse } from '@foundry/contracts';

import { BUILDSQUAD_AGENTS } from './agents';
import {
  mergeCritiques,
  normalizeCritiques,
  runDeterministicCritiqueChecks,
} from './critique';
import {
  normalizeDraft,
  normalizeProductVision,
} from './draft';
import { buildKillOutput, buildKillVisionStub } from './kill';
import { buildPivotVisionStub, normalizePivot } from './pivot';
import { critiquePrompt, draftPrompt, pivotPrompt } from './prompts';
import { asString, parseJsonBlock } from './json';
import type {
  BuildSquadAgentCritique,
  BuildSquadArtifactPack,
  BuildSquadDecisionMode,
  BuildSquadDraftPayload,
  BuildSquadInput,
  BuildSquadInputReferences,
  BuildSquadOptions,
  BuildSquadProductVision,
  ChatFn,
} from './types';
import { BuildSquadError } from './types';

const PROCEED_MAX_TOKENS_DRAFT = 6000;
const PROCEED_MAX_TOKENS_CRITIQUE = 2000;
const PIVOT_MAX_TOKENS = 1500;

export class BuildSquad {
  constructor(private readonly chat: ChatFn, private readonly opts: BuildSquadOptions) {}

  async run(input: BuildSquadInput): Promise<BuildSquadArtifactPack> {
    if (!input?.recommendation) {
      throw new BuildSquadError('BuildSquad.run requires a VentureRecommendation.');
    }
    const decision = input.recommendation.decision;
    if (decision === 'KILL') return this.runKill(input);
    if (decision === 'PIVOT') return this.runPivot(input);
    return this.runProceed(input);
  }

  // ── PROCEED ───────────────────────────────────────────────────────────────
  private async runProceed(input: BuildSquadInput): Promise<BuildSquadArtifactPack> {
    const rationale: string[] = ['Mode: PROCEED — running drafting + critique pass.'];
    const draft = await this.draft(input, rationale);
    const llmCritiques = await this.critique(input, draft, rationale);
    const deterministic = runDeterministicCritiqueChecks(draft);
    const agentCritiques = mergeCritiques(llmCritiques, deterministic);

    const productVision = draft.productVision ?? this.fallbackVision(input);

    return this.assemble({
      input,
      mode: 'proceed',
      productVision,
      draft,
      agentCritiques,
      rationale,
    });
  }

  private async draft(input: BuildSquadInput, rationale: string[]): Promise<BuildSquadDraftPayload> {
    if (this.opts.draftOverride) {
      rationale.push('Drafting LLM call skipped (override provided).');
      return this.opts.draftOverride;
    }
    let res: ChatResponse;
    try {
      const req: ChatRequest = {
        model: this.opts.model,
        ctx: this.opts.ctx,
        messages: draftPrompt(input),
        temperature: 0.3,
        maxTokens: PROCEED_MAX_TOKENS_DRAFT,
        responseFormat: 'json',
      };
      res = await this.chat(req);
    } catch (e) {
      throw new BuildSquadError('BuildSquad drafting call failed.', e);
    }
    const parsed = parseJsonBlock<unknown>(asText(res));
    if (!parsed) {
      throw new BuildSquadError('BuildSquad drafting returned unparseable content.');
    }
    return normalizeDraft(parsed);
  }

  private async critique(
    input: BuildSquadInput,
    draft: BuildSquadDraftPayload,
    rationale: string[],
  ): Promise<BuildSquadAgentCritique[]> {
    if (this.opts.critiqueOverride) {
      rationale.push('Critique LLM call skipped (override provided).');
      return this.opts.critiqueOverride;
    }
    try {
      const req: ChatRequest = {
        model: this.opts.model,
        ctx: this.opts.ctx,
        messages: critiquePrompt(input, draft),
        temperature: 0.4,
        maxTokens: PROCEED_MAX_TOKENS_CRITIQUE,
        responseFormat: 'json',
      };
      const res = await this.chat(req);
      const parsed = parseJsonBlock<unknown>(asText(res));
      return normalizeCritiques(parsed);
    } catch {
      rationale.push('Critique LLM call failed; deterministic checks will carry the review.');
      return [];
    }
  }

  // ── PIVOT ─────────────────────────────────────────────────────────────────
  private async runPivot(input: BuildSquadInput): Promise<BuildSquadArtifactPack> {
    const rationale: string[] = ['Mode: PIVOT — single LLM call for pivot brief.'];
    let pivot;
    if (this.opts.pivotOverride) {
      rationale.push('Pivot LLM call skipped (override provided).');
      pivot = this.opts.pivotOverride;
    } else {
      try {
        const req: ChatRequest = {
          model: this.opts.model,
          ctx: this.opts.ctx,
          messages: pivotPrompt(input),
          temperature: 0.3,
          maxTokens: PIVOT_MAX_TOKENS,
          responseFormat: 'json',
        };
        const res = await this.chat(req);
        pivot = normalizePivot(parseJsonBlock<unknown>(asText(res)), input.recommendation);
      } catch {
        rationale.push('Pivot LLM call failed; using deterministic pivot brief.');
        pivot = normalizePivot(null, input.recommendation);
      }
    }
    const productVision = buildPivotVisionStub(input, pivot);

    return this.assemble({
      input,
      mode: 'pivot',
      productVision,
      draft: {},
      agentCritiques: [],
      rationale,
      pivot,
    });
  }

  // ── KILL ──────────────────────────────────────────────────────────────────
  private runKill(input: BuildSquadInput): BuildSquadArtifactPack {
    const rationale: string[] = ['Mode: KILL — no LLM call; deterministic kill output only.'];
    const kill = buildKillOutput(input.recommendation);
    const productVision = buildKillVisionStub(input);
    return this.assemble({
      input,
      mode: 'kill',
      productVision,
      draft: {},
      agentCritiques: [],
      rationale,
      kill,
    });
  }

  // ── Common ────────────────────────────────────────────────────────────────
  private assemble(args: {
    input: BuildSquadInput;
    mode: BuildSquadDecisionMode;
    productVision: BuildSquadProductVision;
    draft: BuildSquadDraftPayload;
    agentCritiques: BuildSquadAgentCritique[];
    rationale: string[];
    pivot?: BuildSquadArtifactPack['pivot'];
    kill?: BuildSquadArtifactPack['kill'];
  }): BuildSquadArtifactPack {
    const now = this.opts.now ? this.opts.now() : new Date();
    const id = this.opts.generateId
      ? this.opts.generateId()
      : `bsq_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const inputReferences: BuildSquadInputReferences = {
      ventureId: args.input.recommendation.ventureId,
      recommendationId: args.input.recommendation.recommendationId,
      ...(args.input.researchGraph?.graphId ? { graphId: args.input.researchGraph.graphId } : {}),
    };

    const pack: BuildSquadArtifactPack = {
      kind: 'BuildSquadArtifactPack',
      artifactId: id,
      ventureId: args.input.recommendation.ventureId,
      createdAt: now.toISOString(),
      mode: args.mode,
      inputReferences,
      productVision: args.productVision,
      agentCritiques: args.agentCritiques,
      rationale: args.rationale,
    };
    if (args.mode === 'proceed') {
      if (args.draft.prd) pack.prd = args.draft.prd;
      if (args.draft.mvpScope) pack.mvpScope = args.draft.mvpScope;
      if (args.draft.userStories) pack.userStories = args.draft.userStories;
      if (args.draft.architectureBrief) pack.architectureBrief = args.draft.architectureBrief;
      if (args.draft.roadmap) pack.roadmap = args.draft.roadmap;
      if (args.draft.prototypeBrief) pack.prototypeBrief = args.draft.prototypeBrief;
    }
    if (args.pivot) pack.pivot = args.pivot;
    if (args.kill) pack.kill = args.kill;
    return pack;
  }

  private fallbackVision(input: BuildSquadInput): BuildSquadProductVision {
    return normalizeProductVision({
      problem: input.recommendation.executiveSummary,
      productPromise: '',
      whyNow: '',
      targetUsers: [],
      differentiation: [],
      successMetrics: [],
    });
  }
}

function asText(res: ChatResponse): string {
  if (typeof res.content === 'string') return res.content;
  if (Array.isArray(res.content)) {
    const part = res.content.find((p) => typeof (p as { type?: string }).type === 'string');
    if (part && 'name' in part) return (part as { name?: string }).name ?? '';
  }
  return '';
}

export function createBuildSquad(chat: ChatFn, opts: BuildSquadOptions): BuildSquad {
  return new BuildSquad(chat, opts);
}

export { BUILDSQUAD_AGENTS };
