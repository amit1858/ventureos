/**
 * Sprint 0 BuildSquad adapter — interface + two stub implementations.
 *
 *   HandRolledBuildSquadAdapter — DEFAULT. Will become a real hand-rolled multi-agent
 *                                 orchestrator in M1. Lives entirely inside Foundry;
 *                                 no external runtime dependencies.
 *   SquadOssAdapter             — Wraps Brady Gaster's @bradygaster/squad-cli (Squad-OSS).
 *                                 Permanently gated behind the env flag VENTUREOS_USE_SQUAD_OSS=true.
 *                                 Constructor throws FeatureDisabledError unless the flag is set.
 *
 * Naming: the internal module is "BuildSquad"; "Squad" / "Squad-OSS" refer to the upstream repo.
 * Method signatures mirror docs/dependency-analysis-squad.md §8.
 */

import type { ChatRequest, IdeaBrief, Persona, Recommendation, ResearchGraph } from '@foundry/contracts';
import {
  FeatureDisabledError,
  NotImplementedError,
  type ProviderClient,
} from '@foundry/providers-core';

export interface BuildPlan {
  steps: Array<{ id: string; title: string; agent: string; deps: string[] }>;
  artifacts: string[];
}

export interface BuildArtifact {
  path: string;
  contentType: string;
  /** SHA-256 of contents. */
  digest: string;
}

export interface BuildResult {
  recommendation: Recommendation;
  artifacts: BuildArtifact[];
  transcriptUri?: string;
  costUsd: number;
}

export interface BuildSquadAdapter {
  /** Decompose an idea + research graph + personas into an agent plan. */
  plan(input: {
    brief: IdeaBrief;
    personas: Persona[];
    research: ResearchGraph;
  }): Promise<BuildPlan>;

  /** Execute the plan, producing artifacts (code, ICPs, GTM doc, etc.). */
  run(plan: BuildPlan, ctx: ChatRequest['ctx']): Promise<BuildResult>;

  /** Cancel an in-flight run. */
  cancel(runId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default: hand-rolled BuildSquad. Always available, M0 critical path.
// ─────────────────────────────────────────────────────────────────────────────

export class HandRolledBuildSquadAdapter implements BuildSquadAdapter {
  readonly kind = 'hand-rolled' as const;

  constructor(private readonly provider: ProviderClient) {}

  async plan(_input: {
    brief: IdeaBrief;
    personas: Persona[];
    research: ResearchGraph;
  }): Promise<BuildPlan> {
    throw new NotImplementedError(
      'HandRolledBuildSquadAdapter.plan — implemented in M1 Sprint 1.',
    );
  }

  async run(_plan: BuildPlan, _ctx: ChatRequest['ctx']): Promise<BuildResult> {
    throw new NotImplementedError(
      'HandRolledBuildSquadAdapter.run — implemented in M1 Sprint 1.',
    );
  }

  async cancel(_runId: string): Promise<void> {
    throw new NotImplementedError(
      'HandRolledBuildSquadAdapter.cancel — implemented in M1 Sprint 1.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional: Squad-OSS wrapper. Feature-flagged off by default.
// ─────────────────────────────────────────────────────────────────────────────

const SQUAD_OSS_FLAG = 'VENTUREOS_USE_SQUAD_OSS';

export class SquadOssAdapter implements BuildSquadAdapter {
  readonly kind = 'squad-oss' as const;

  constructor(private readonly provider: ProviderClient) {
    if (process.env[SQUAD_OSS_FLAG] !== 'true') {
      throw new FeatureDisabledError(
        SQUAD_OSS_FLAG,
        `SquadOssAdapter requires env ${SQUAD_OSS_FLAG}=true. ` +
          `Use HandRolledBuildSquadAdapter (default) otherwise.`,
      );
    }
  }

  async plan(_input: {
    brief: IdeaBrief;
    personas: Persona[];
    research: ResearchGraph;
  }): Promise<BuildPlan> {
    throw new NotImplementedError('SquadOssAdapter.plan — wiring deferred to M1+.');
  }

  async run(_plan: BuildPlan, _ctx: ChatRequest['ctx']): Promise<BuildResult> {
    throw new NotImplementedError('SquadOssAdapter.run — wiring deferred to M1+.');
  }

  async cancel(_runId: string): Promise<void> {
    throw new NotImplementedError('SquadOssAdapter.cancel — wiring deferred to M1+.');
  }
}

/** Factory: returns the configured BuildSquad adapter. */
export function createBuildSquadAdapter(provider: ProviderClient): BuildSquadAdapter {
  if (process.env[SQUAD_OSS_FLAG] === 'true') {
    return new SquadOssAdapter(provider);
  }
  return new HandRolledBuildSquadAdapter(provider);
}
