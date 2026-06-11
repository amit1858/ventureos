/**
 * BuildSquad artifact pack evaluation.
 *
 * Six small axes, all in [0,1]:
 *   completeness        — required sections present for the active mode
 *   storyQuality        — must-stories have ≥2 acceptance criteria
 *   scopeDiscipline     — must/should/later separation + explicit cuts
 *   architectureCoverage— security/storage/integrations populated
 *   critiqueQuality     — critiques reference real sections with severities
 * Plus a weighted overallScore.
 */
import type { BuildSquadArtifactEvaluation, BuildSquadArtifactPack } from './types';

const WEIGHTS = {
  completeness: 0.3,
  storyQuality: 0.2,
  scopeDiscipline: 0.2,
  architectureCoverage: 0.15,
  critiqueQuality: 0.15,
} as const;

const ALLOWED_SECTIONS = new Set([
  'product_vision',
  'prd',
  'mvp_scope',
  'user_stories',
  'architecture_brief',
  'roadmap',
  'prototype_brief',
]);

export function evaluateArtifactPack(pack: BuildSquadArtifactPack): BuildSquadArtifactEvaluation {
  const warnings: string[] = [];

  // Completeness — depends on mode.
  let completeness = 1;
  if (pack.mode === 'proceed') {
    const required: Array<keyof BuildSquadArtifactPack> = [
      'prd', 'mvpScope', 'userStories', 'architectureBrief', 'roadmap', 'prototypeBrief',
    ];
    const present = required.filter((k) => !!pack[k]).length;
    completeness = present / required.length;
    if (present < required.length) warnings.push(`Missing ${required.length - present} required PROCEED section(s).`);
  } else if (pack.mode === 'pivot') {
    completeness = pack.pivot ? 1 : 0;
    if (!pack.pivot) warnings.push('PIVOT mode without pivot output.');
  } else {
    completeness = pack.kill ? 1 : 0;
    if (!pack.kill) warnings.push('KILL mode without kill output.');
  }

  // Story quality.
  let storyQuality = 1;
  const stories = pack.userStories ?? [];
  if (stories.length === 0 && pack.mode === 'proceed') {
    storyQuality = 0;
    warnings.push('No user stories.');
  } else if (stories.length > 0) {
    const must = stories.filter((s) => s.priority === 'must');
    if (must.length === 0) {
      storyQuality = 0.5;
      warnings.push('No must-priority stories.');
    } else {
      const good = must.filter((s) => s.acceptanceCriteria.length >= 2).length;
      storyQuality = good / must.length;
    }
  }

  // Scope discipline.
  let scopeDiscipline = 1;
  if (pack.mode === 'proceed') {
    const m = pack.mvpScope;
    if (!m) scopeDiscipline = 0;
    else {
      let s = 0;
      if (m.mustHave.length > 0) s += 0.4;
      if (m.shouldHave.length > 0) s += 0.2;
      if (m.later.length > 0) s += 0.2;
      if (m.explicitCuts.length > 0) s += 0.2;
      scopeDiscipline = s;
      if (m.explicitCuts.length === 0) warnings.push('MVP scope has no explicit cuts.');
    }
  }

  // Architecture coverage.
  let architectureCoverage = 1;
  if (pack.mode === 'proceed') {
    const a = pack.architectureBrief;
    if (!a) architectureCoverage = 0;
    else {
      let s = 0;
      if (a.components.length >= 3) s += 0.3;
      if (a.dataFlow.length > 0) s += 0.15;
      if (a.storage.length > 0) s += 0.2;
      if (a.security.length > 0) s += 0.2;
      if (a.integrations.length >= 0) s += 0.15;
      architectureCoverage = Math.min(1, s);
      if (a.security.length === 0) warnings.push('Architecture brief lacks security entries.');
    }
  }

  // Critique quality.
  let critiqueQuality = 1;
  if (pack.mode === 'proceed') {
    const valid = pack.agentCritiques.filter((c) => ALLOWED_SECTIONS.has(c.targetSection)).length;
    critiqueQuality = pack.agentCritiques.length === 0 ? 0 : valid / pack.agentCritiques.length;
    if (pack.agentCritiques.length < 5) warnings.push(`Only ${pack.agentCritiques.length} critique(s); expected at least 5.`);
  }

  const overallScore =
    WEIGHTS.completeness * completeness +
    WEIGHTS.storyQuality * storyQuality +
    WEIGHTS.scopeDiscipline * scopeDiscipline +
    WEIGHTS.architectureCoverage * architectureCoverage +
    WEIGHTS.critiqueQuality * critiqueQuality;

  return {
    completeness,
    storyQuality,
    scopeDiscipline,
    architectureCoverage,
    critiqueQuality,
    warnings,
    overallScore,
  };
}
