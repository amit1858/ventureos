import type {
  BuildSquadArtifactPack,
  VentureArtifact,
  VentureArtifactKind,
  VentureProgress,
  VentureReadinessScore,
  VentureRecommendation,
  ResearchGraph,
  PersonaLabPersona,
} from '@foundry/contracts';

/**
 * Deterministic, dependency-free progress + readiness derivation.
 *
 * Input: the artifact ledger (per (ventureId)). Output: 0..100 axes that the
 * Venture dashboard renders verbatim. Both functions are pure.
 */

const LATEST = (artifacts: VentureArtifact[], kind: VentureArtifactKind): VentureArtifact | null => {
  let latest: VentureArtifact | null = null;
  for (const a of artifacts) {
    if (a.artifactKind !== kind) continue;
    if (!latest || a.version > latest.version) latest = a;
  }
  return latest;
};

export function calculateVentureProgress(artifacts: VentureArtifact[]): VentureProgress {
  const personas = LATEST(artifacts, 'persona_set');
  const interviews = artifacts.filter((a) => a.artifactKind === 'interview_transcript').length;
  const focusGroup = LATEST(artifacts, 'focus_group_transcript');
  const committee = LATEST(artifacts, 'buying_committee');
  const research = LATEST(artifacts, 'research_graph');
  const recommendation = LATEST(artifacts, 'venture_recommendation');
  const pack = LATEST(artifacts, 'buildsquad_pack');

  // Research: persona_set (40), interviews ≥1 (20), focus_group (20), research_graph (20)
  let researchScore = 0;
  if (personas) researchScore += 40;
  if (interviews >= 1) researchScore += 20;
  if (focusGroup) researchScore += 20;
  if (research) researchScore += 20;

  // Validation: committee (30), recommendation (40), recommendation confidence bonus (30)
  let validationScore = 0;
  if (committee) validationScore += 30;
  if (recommendation) {
    validationScore += 40;
    const rec = recommendation.payload as VentureRecommendation | undefined;
    if (rec && typeof rec.confidenceScore === 'number') {
      validationScore += Math.round(Math.max(0, Math.min(1, rec.confidenceScore)) * 30);
    }
  }

  // Planning: buildsquad pack present (60) + mode is proceed (40) | pivot (20) | kill (10)
  let planningScore = 0;
  if (pack) {
    planningScore += 60;
    const p = pack.payload as BuildSquadArtifactPack | undefined;
    if (p?.mode === 'proceed') planningScore += 40;
    else if (p?.mode === 'pivot') planningScore += 20;
    else if (p?.mode === 'kill') planningScore += 10;
  }

  // Build readiness: requires proceed pack with all 7 sections + ≥3 must stories + ≥3 components.
  let buildReadiness = 0;
  if (pack) {
    const p = pack.payload as BuildSquadArtifactPack | undefined;
    if (p?.mode === 'proceed') {
      if (p.prd) buildReadiness += 15;
      if (p.mvpScope) buildReadiness += 15;
      if (p.userStories && p.userStories.filter((s) => s.priority === 'must').length >= 3) {
        buildReadiness += 20;
      }
      if (p.architectureBrief && p.architectureBrief.components.length >= 3) {
        buildReadiness += 20;
      }
      if (p.roadmap && p.roadmap.weeks.length === 4) buildReadiness += 15;
      if (p.prototypeBrief) buildReadiness += 15;
    }
  }

  return {
    research: clamp(researchScore),
    validation: clamp(validationScore),
    planning: clamp(planningScore),
    buildReadiness: clamp(buildReadiness),
  };
}

export function calculateVentureReadiness(artifacts: VentureArtifact[]): VentureReadinessScore {
  const personas = LATEST(artifacts, 'persona_set');
  const research = LATEST(artifacts, 'research_graph');
  const committee = LATEST(artifacts, 'buying_committee');
  const recommendation = LATEST(artifacts, 'venture_recommendation');
  const pack = LATEST(artifacts, 'buildsquad_pack');

  const warnings: string[] = [];

  // Persona coverage: 100 if a persona_set exists with ≥3 personas; 50 if 1-2; 0 otherwise.
  let personaCoverage = 0;
  if (personas) {
    const arr = personas.payload as PersonaLabPersona[] | undefined;
    const n = Array.isArray(arr) ? arr.length : 0;
    if (n >= 3) personaCoverage = 100;
    else if (n >= 1) personaCoverage = 50;
    else warnings.push('Persona set is present but empty.');
  } else {
    warnings.push('No persona set generated yet.');
  }

  // Research coverage: god-nodes count + contradictions surfaced.
  let researchCoverage = 0;
  if (research) {
    const g = research.payload as ResearchGraph | undefined;
    const godCount = g?.godNodes?.length ?? 0;
    const nodes = g?.nodes?.length ?? 0;
    if (nodes >= 10) researchCoverage += 40;
    else if (nodes >= 5) researchCoverage += 20;
    if (godCount >= 3) researchCoverage += 40;
    else if (godCount >= 1) researchCoverage += 20;
    if (g?.contradictions && g.contradictions.length > 0) researchCoverage += 20;
  } else {
    warnings.push('No research graph built yet.');
  }

  // Validation confidence: recommendation.confidenceScore × 100, with committee bonus.
  let validationConfidence = 0;
  if (recommendation) {
    const r = recommendation.payload as VentureRecommendation | undefined;
    const c = typeof r?.confidenceScore === 'number' ? r.confidenceScore : 0;
    validationConfidence = Math.round(Math.max(0, Math.min(1, c)) * 80);
    if (committee) validationConfidence += 20;
  } else {
    warnings.push('No recommendation generated yet.');
  }

  // BuildSquad completeness: section coverage for proceed; flat 40 for pivot; 20 for kill.
  let buildsquadCompleteness = 0;
  if (pack) {
    const p = pack.payload as BuildSquadArtifactPack | undefined;
    if (p?.mode === 'proceed') {
      const sections = [p.prd, p.mvpScope, p.userStories, p.architectureBrief, p.roadmap, p.prototypeBrief];
      buildsquadCompleteness = Math.round((sections.filter(Boolean).length / sections.length) * 100);
    } else if (p?.mode === 'pivot') {
      buildsquadCompleteness = 40;
    } else if (p?.mode === 'kill') {
      buildsquadCompleteness = 20;
    }
  } else {
    warnings.push('No BuildSquad pack generated yet.');
  }

  // Risk coverage: from recommendation.risks + research contradictions + buildsquad critiques.
  let riskCoverage = 0;
  if (recommendation) {
    const r = recommendation.payload as VentureRecommendation | undefined;
    if (r?.risks && r.risks.length >= 3) riskCoverage += 50;
    else if (r?.risks && r.risks.length >= 1) riskCoverage += 25;
  }
  if (research) {
    const g = research.payload as ResearchGraph | undefined;
    if (g?.contradictions && g.contradictions.length > 0) riskCoverage += 25;
  }
  if (pack) {
    const p = pack.payload as BuildSquadArtifactPack | undefined;
    if (p?.agentCritiques && p.agentCritiques.length >= 3) riskCoverage += 25;
  }

  const axes = [
    personaCoverage,
    researchCoverage,
    validationConfidence,
    buildsquadCompleteness,
    riskCoverage,
  ];
  const overall = Math.round(axes.reduce((s, a) => s + a, 0) / axes.length);

  return {
    overall: clamp(overall),
    personaCoverage: clamp(personaCoverage),
    researchCoverage: clamp(researchCoverage),
    validationConfidence: clamp(validationConfidence),
    buildsquadCompleteness: clamp(buildsquadCompleteness),
    riskCoverage: clamp(riskCoverage),
    warnings,
  };
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
