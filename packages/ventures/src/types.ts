/**
 * @foundry/ventures — Venture domain (Sprint 2A.5).
 *
 * Re-exports the Venture-shaped contracts plus internal helper types.
 */
export type {
  Venture,
  VentureStatus,
  VentureArtifact,
  VentureArtifactKind,
  VentureTimelineEvent,
  VentureTimelineEventKind,
  VentureProgress,
  VentureReadinessScore,
  VentureSummary,
  VentureDecision,
  VentureRecommendation,
  BuildSquadArtifactPack,
  PersonaLabPersona,
  ResearchGraph,
  BuyingCommitteeTranscript,
  VentureJob,
  VentureJobKind,
  VentureJobStatus,
  VentureJobMetrics,
  EvaluationReport,
  EvaluationReportCoverageItem,
  EvaluationReportRiskItem,
  JobMetricsAggregate,
  VentureSpendSummary,
  GitHubRepoArtifactPayload,
  ProviderId,
} from '@foundry/contracts';

import type {
  Venture,
  VentureStatus,
  VentureArtifact,
  VentureArtifactKind,
  VentureTimelineEvent,
  VentureTimelineEventKind,
} from '@foundry/contracts';

/** Tenant-scoped query — every call MUST carry ownerId. */
export interface OwnerScoped {
  ownerId: string;
}

export interface CreateVentureInput extends OwnerScoped {
  title: string;
  description?: string;
  problemStatement?: string;
  targetMarket?: string;
  customerType?: string;
  region?: string;
  businessSize?: string;
  status?: VentureStatus;
}

export interface UpdateVentureInput extends OwnerScoped {
  ventureId: string;
  patch: Partial<Omit<Venture, 'kind' | 'ventureId' | 'ownerId' | 'createdAt' | 'updatedAt'>>;
}

export interface AttachArtifactInput extends OwnerScoped {
  ventureId: string;
  artifactKind: VentureArtifactKind;
  summary: string;
  payload: unknown;
}

export interface RecordEventInput extends OwnerScoped {
  ventureId: string;
  eventKind: VentureTimelineEventKind;
  label: string;
  artifactId?: string;
}

export interface ListVenturesQuery extends OwnerScoped {
  status?: VentureStatus;
  search?: string;
  sort?: 'updated_desc' | 'created_desc' | 'title_asc';
}

/** Storage interface — swap in-memory for Supabase later without touching service. */
export interface VentureStore {
  createVenture(v: Venture): Promise<void>;
  getVenture(ownerId: string, ventureId: string): Promise<Venture | null>;
  listVentures(q: ListVenturesQuery): Promise<Venture[]>;
  replaceVenture(v: Venture): Promise<void>;

  appendArtifact(a: VentureArtifact): Promise<void>;
  listArtifacts(ownerId: string, ventureId: string): Promise<VentureArtifact[]>;
  /** Latest version per kind. */
  latestArtifactByKind(
    ownerId: string,
    ventureId: string,
    kind: VentureArtifactKind,
  ): Promise<VentureArtifact | null>;

  appendEvent(e: VentureTimelineEvent): Promise<void>;
  listEvents(ownerId: string, ventureId: string): Promise<VentureTimelineEvent[]>;
}
