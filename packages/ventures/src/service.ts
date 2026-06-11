import type {
  Venture,
  VentureArtifact,
  VentureRecommendation,
  VentureSummary,
  VentureTimelineEvent,
} from '@ventureos/contracts';

import { calculateVentureProgress, calculateVentureReadiness } from './readiness.js';
import type {
  AttachArtifactInput,
  CreateVentureInput,
  ListVenturesQuery,
  RecordEventInput,
  UpdateVentureInput,
  VentureStore,
} from './types.js';

export class VentureNotFoundError extends Error {
  constructor(public readonly ventureId: string) {
    super(`Venture not found: ${ventureId}`);
    this.name = 'VentureNotFoundError';
  }
}

export interface VentureServiceOptions {
  now?: () => Date;
  generateId?: (prefix: string) => string;
}

/**
 * VentureService — orchestrates the Venture lifecycle on top of a VentureStore.
 *
 * Tenant isolation is enforced at every call: every method takes ownerId and
 * the store keys all rows by (ownerId, ventureId). Versioning is monotonic
 * per (ventureId, artifactKind); attaching a new payload never overwrites a
 * prior one.
 */
export class VentureService {
  private readonly now: () => Date;
  private readonly generateId: (prefix: string) => string;

  constructor(
    private readonly store: VentureStore,
    opts: VentureServiceOptions = {},
  ) {
    this.now = opts.now ?? (() => new Date());
    this.generateId = opts.generateId ?? defaultIdGenerator();
  }

  async createVenture(input: CreateVentureInput): Promise<Venture> {
    const at = this.now().toISOString();
    const v: Venture = {
      kind: 'Venture',
      ventureId: this.generateId('ven'),
      ownerId: input.ownerId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      problemStatement: input.problemStatement?.trim() ?? '',
      targetMarket: input.targetMarket?.trim() ?? '',
      customerType: input.customerType?.trim() ?? '',
      region: input.region?.trim() ?? '',
      businessSize: input.businessSize?.trim() ?? '',
      status: input.status ?? 'draft',
      createdAt: at,
      updatedAt: at,
    };
    if (v.title.length === 0) {
      throw new Error('Venture title is required.');
    }
    await this.store.createVenture(v);
    await this.store.appendEvent({
      kind: 'VentureTimelineEvent',
      eventId: this.generateId('evt'),
      ventureId: v.ventureId,
      ownerId: v.ownerId,
      eventKind: 'venture_created',
      label: `Venture created: ${v.title}`,
      at,
    });
    return v;
  }

  async getVenture(ownerId: string, ventureId: string): Promise<Venture> {
    const v = await this.store.getVenture(ownerId, ventureId);
    if (!v) throw new VentureNotFoundError(ventureId);
    return v;
  }

  async listVentures(q: ListVenturesQuery): Promise<Venture[]> {
    return this.store.listVentures(q);
  }

  async updateVenture(input: UpdateVentureInput): Promise<Venture> {
    const current = await this.getVenture(input.ownerId, input.ventureId);
    const at = this.now().toISOString();
    const next: Venture = {
      ...current,
      ...input.patch,
      kind: 'Venture',
      ventureId: current.ventureId,
      ownerId: current.ownerId,
      createdAt: current.createdAt,
      updatedAt: at,
    };
    await this.store.replaceVenture(next);
    const eventKind = input.patch.status === 'archived' ? 'venture_archived' : 'venture_updated';
    const label = input.patch.status
      ? `Status → ${input.patch.status}`
      : 'Venture updated';
    await this.store.appendEvent({
      kind: 'VentureTimelineEvent',
      eventId: this.generateId('evt'),
      ventureId: next.ventureId,
      ownerId: next.ownerId,
      eventKind,
      label,
      at,
    });
    return next;
  }

  async archiveVenture(ownerId: string, ventureId: string): Promise<Venture> {
    return this.updateVenture({ ownerId, ventureId, patch: { status: 'archived' } });
  }

  async attachArtifact(input: AttachArtifactInput): Promise<VentureArtifact> {
    // Tenant isolation: confirm the venture exists for this owner first.
    await this.getVenture(input.ownerId, input.ventureId);
    const existing = await this.store.listArtifacts(input.ownerId, input.ventureId);
    const sameKind = existing.filter((a) => a.artifactKind === input.artifactKind);
    const nextVersion = sameKind.length === 0
      ? 1
      : Math.max(...sameKind.map((a) => a.version)) + 1;
    const at = this.now().toISOString();
    const artifact: VentureArtifact = {
      kind: 'VentureArtifact',
      artifactId: this.generateId('art'),
      ventureId: input.ventureId,
      ownerId: input.ownerId,
      artifactKind: input.artifactKind,
      version: nextVersion,
      createdAt: at,
      summary: input.summary,
      payload: input.payload,
    };
    await this.store.appendArtifact(artifact);
    await this.store.appendEvent({
      kind: 'VentureTimelineEvent',
      eventId: this.generateId('evt'),
      ventureId: input.ventureId,
      ownerId: input.ownerId,
      eventKind: artifactKindToEventKind(input.artifactKind),
      label: `${friendlyArtifactKind(input.artifactKind)} v${nextVersion}: ${input.summary}`,
      at,
      artifactId: artifact.artifactId,
    });
    // Bump status forwards conservatively when meaningful artifacts land.
    await this.maybeAdvanceStatus(input.ownerId, input.ventureId, input.artifactKind);
    return artifact;
  }

  async listArtifacts(ownerId: string, ventureId: string): Promise<VentureArtifact[]> {
    await this.getVenture(ownerId, ventureId);
    return this.store.listArtifacts(ownerId, ventureId);
  }

  async recordEvent(input: RecordEventInput): Promise<VentureTimelineEvent> {
    await this.getVenture(input.ownerId, input.ventureId);
    const evt: VentureTimelineEvent = {
      kind: 'VentureTimelineEvent',
      eventId: this.generateId('evt'),
      ventureId: input.ventureId,
      ownerId: input.ownerId,
      eventKind: input.eventKind,
      label: input.label,
      at: this.now().toISOString(),
      ...(input.artifactId ? { artifactId: input.artifactId } : {}),
    };
    await this.store.appendEvent(evt);
    return evt;
  }

  async listEvents(ownerId: string, ventureId: string): Promise<VentureTimelineEvent[]> {
    await this.getVenture(ownerId, ventureId);
    return this.store.listEvents(ownerId, ventureId);
  }

  /**
   * Internal escape hatch for the JobOrchestrator to write fully-formed
   * timeline events (so it owns the event id, jobId pointer, and metrics
   * snapshot). Callers that aren't the orchestrator should use `recordEvent`.
   */
  async appendRawEvent(event: VentureTimelineEvent): Promise<void> {
    await this.store.appendEvent(event);
  }

  async getSummary(ownerId: string, ventureId: string): Promise<VentureSummary> {
    const venture = await this.getVenture(ownerId, ventureId);
    const artifacts = await this.store.listArtifacts(ownerId, ventureId);
    const events = await this.store.listEvents(ownerId, ventureId);
    const progress = calculateVentureProgress(artifacts);
    const readiness = calculateVentureReadiness(artifacts);

    let latestRec: VentureSummary['latestRecommendation'];
    const recArt = await this.store.latestArtifactByKind(ownerId, ventureId, 'venture_recommendation');
    if (recArt) {
      const r = recArt.payload as VentureRecommendation | undefined;
      if (r && r.kind === 'VentureRecommendation') {
        latestRec = {
          recommendationId: r.recommendationId,
          decision: r.decision,
          overallScore: r.overallScore,
          confidenceScore: r.confidenceScore,
          createdAt: r.createdAt,
        };
      }
    }

    const lastEvent = events.length > 0 ? events[events.length - 1] : undefined;
    return {
      venture,
      progress,
      readiness,
      ...(latestRec ? { latestRecommendation: latestRec } : {}),
      artifactCount: artifacts.length,
      ...(lastEvent ? { lastEventAt: lastEvent.at } : {}),
    };
  }

  /** Conservative status auto-advance based on artifact arrival. Never moves to/away from terminal states. */
  private async maybeAdvanceStatus(
    ownerId: string,
    ventureId: string,
    kind: VentureArtifact['artifactKind'],
  ): Promise<void> {
    const v = await this.store.getVenture(ownerId, ventureId);
    if (!v) return;
    if (v.status === 'archived' || v.status === 'rejected' || v.status === 'approved' || v.status === 'building') return;
    let target: Venture['status'] | null = null;
    if (kind === 'persona_set' || kind === 'research_graph') target = 'researching';
    if (kind === 'venture_recommendation') target = 'validating';
    if (kind === 'buildsquad_pack') target = 'approved';
    if (!target || target === v.status) return;
    // Don't downgrade.
    const order: Venture['status'][] = ['draft', 'researching', 'validating', 'pivoting', 'approved', 'building'];
    if (order.indexOf(target) <= order.indexOf(v.status)) return;
    const at = this.now().toISOString();
    await this.store.replaceVenture({ ...v, status: target, updatedAt: at });
  }
}

function artifactKindToEventKind(k: VentureArtifact['artifactKind']): VentureTimelineEvent['eventKind'] {
  switch (k) {
    case 'persona_set': return 'persona_set_generated';
    case 'interview_transcript': return 'interview_run';
    case 'focus_group_transcript': return 'focus_group_run';
    case 'buying_committee': return 'buying_committee_run';
    case 'persona_insights': return 'persona_insights_generated';
    case 'research_graph': return 'research_graph_built';
    case 'venture_recommendation': return 'recommendation_generated';
    case 'buildsquad_pack': return 'buildsquad_pack_generated';
    case 'evaluation_report': return 'evaluation_report_generated';
    case 'github_repo': return 'buildsquad_repo_pushed';
  }
}

function friendlyArtifactKind(k: VentureArtifact['artifactKind']): string {
  switch (k) {
    case 'persona_set': return 'Persona set';
    case 'interview_transcript': return 'Interview';
    case 'focus_group_transcript': return 'Focus group';
    case 'buying_committee': return 'Buying committee';
    case 'persona_insights': return 'Persona insights';
    case 'research_graph': return 'Research graph';
    case 'venture_recommendation': return 'Recommendation';
    case 'buildsquad_pack': return 'BuildSquad pack';
    case 'evaluation_report': return 'Evaluation report';
    case 'github_repo': return 'GitHub repository';
  }
}

function defaultIdGenerator(): (prefix: string) => string {
  let counter = 0;
  return (prefix: string) => {
    counter += 1;
    const r = Math.random().toString(36).slice(2, 8);
    const t = Date.now().toString(36);
    return `${prefix}_${t}_${counter.toString(36)}_${r}`;
  };
}
