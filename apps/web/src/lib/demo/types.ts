/**
 * Demo Mode data model.
 *
 * A `DemoVenture` is a fully-seeded, deterministic snapshot of a venture that
 * has already been driven end-to-end through every Foundry lab. It exists so
 * a judge or first-time user can experience the entire product surface —
 * personas, buying committee, research graph, validation, build plan,
 * evaluation report and a (simulated) GitHub export — WITHOUT supplying any
 * BYOK provider key, Supabase project or GitHub token.
 *
 * Everything here is typed against `@foundry/contracts`, so the demo cannot
 * drift from the real artifact shapes the labs emit. Demo data is intentionally
 * separate from Real Mode: Real Mode remains the default product path and is
 * never touched by anything in this folder.
 */
import type {
  BuildSquadArtifactPack,
  BuyingCommitteeTranscript,
  IdeaBrief,
  PersonaLabPersona,
  ResearchGraph,
  Venture,
  VentureArtifact,
  VentureRecommendation,
  VentureSummary,
  VentureTimelineEvent,
} from '@foundry/contracts';

/** A simulated GitHub export result (no token used, nothing pushed). */
export interface DemoExport {
  owner: string;
  repo: string;
  fullName: string;
  htmlUrl: string;
  visibility: 'private' | 'public';
  defaultBranch: string;
  commitSha: string;
  /** Real-mode equivalent of the credential that would be used. */
  credentialHint: string;
}

export interface DemoVenture {
  /** URL slug, e.g. "faceless-crm". */
  slug: string;
  /** Short marketing tagline for the demo index card. */
  tagline: string;
  /** The single thing a user types in Real Mode. Everything else is generated. */
  brief: IdeaBrief;
  venture: Venture;
  personas: PersonaLabPersona[];
  committee: BuyingCommitteeTranscript;
  research: ResearchGraph;
  recommendation: VentureRecommendation;
  pack: BuildSquadArtifactPack;
  timeline: VentureTimelineEvent[];
  /** Pre-computed dashboard summary (validated against the real scoring engine in tests). */
  summary: VentureSummary;
  /** The artifact ledger, rebuilt from the payloads above. */
  artifacts: VentureArtifact[];
  /** Simulated GitHub export outcome. */
  export: DemoExport;
}
