/**
 * @ventureos/buildsquad — public surface.
 */
export * from './types';
export {
  BUILDSQUAD_AGENTS,
  BUILDSQUAD_AGENT_BY_ROLE,
  type BuildSquadAgentCharter,
} from './agents';
export {
  normalizeDraft,
  normalizeProductVision,
  normalizePrd,
  normalizeMvpScope,
  normalizeUserStories,
  normalizeArchitectureBrief,
  normalizeRoadmap,
  normalizePrototypeBrief,
} from './draft';
export {
  normalizeCritiques,
  runDeterministicCritiqueChecks,
  mergeCritiques,
  activeCritiqueRoles,
} from './critique';
export { buildKillOutput, buildKillVisionStub } from './kill';
export { normalizePivot, buildPivotVisionStub, deterministicPivotBrief } from './pivot';
export { evaluateArtifactPack } from './evaluation';
export { draftPrompt, critiquePrompt, pivotPrompt } from './prompts';
export { BuildSquad, createBuildSquad } from './orchestrator';
export {
  renderPack,
  renderEvaluationReport,
  type ScaffoldFile as RenderedScaffoldFile,
  type RenderEvaluationReportInput,
  type RenderEvaluationReportOutput,
} from './render';
