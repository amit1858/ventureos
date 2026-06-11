/**
 * Client-safe evaluation builder.
 *
 * Renders the EvaluationReport artifact + EVALUATION_REPORT.md directly in the
 * browser from already-loaded venture artifacts, using the SAME pure renderer
 * Real Mode's GitHub export uses (`@ventureos/buildsquad`). The `/api/evaluation/*`
 * routes ship as 501 stubs (Sprint 2B), so the workspace renders evaluation
 * locally — no extra round-trip, no server work, and byte-for-byte identical to
 * what an export would write.
 *
 * Pure: no I/O, no secrets, no provider SDKs.
 */
import { renderEvaluationReport } from '@ventureos/buildsquad';
import type {
  BuildSquadArtifactPack,
  BuyingCommitteeTranscript,
  EvaluationReport,
  PersonaLabPersona,
  ResearchGraph,
  Venture,
  VentureArtifactKind,
  VentureReadinessScore,
  VentureRecommendation,
} from '@ventureos/contracts';

export interface BuildEvaluationInput {
  venture: Venture;
  readiness: VentureReadinessScore;
  personas?: PersonaLabPersona[] | null;
  graph?: ResearchGraph | null;
  recommendation?: VentureRecommendation | null;
  committee?: BuyingCommitteeTranscript | null;
  pack?: BuildSquadArtifactPack | null;
  sourceArtifacts?: { kind: VentureArtifactKind; version: number }[];
  now?: () => Date;
}

export interface BuiltEvaluation {
  report: EvaluationReport;
  markdown: string;
}

export function buildEvaluationFromArtifacts(input: BuildEvaluationInput): BuiltEvaluation {
  const { artifact, markdown } = renderEvaluationReport({
    venture: input.venture,
    pack: input.pack ?? null,
    recommendation: input.recommendation ?? null,
    personas: input.personas ?? null,
    graph: input.graph ?? null,
    committee: input.committee ?? null,
    readiness: input.readiness,
    ...(input.sourceArtifacts ? { sourceArtifacts: input.sourceArtifacts } : {}),
    ...(input.now ? { now: input.now } : {}),
  });
  return { report: artifact, markdown };
}
