/**
 * Critique pass.
 *
 * Two layers:
 *   1. `normalizeCritiques` cleans + bounds whatever the critique LLM returned.
 *   2. `runDeterministicCritiqueChecks` runs each agent's stable checklist over
 *      the draft and emits a critique whenever a check fails. Used both as a
 *      seed (always present) and as a fallback if the LLM critique call fails.
 */
import type {
  BuildSquadAgentCritique,
  BuildSquadAgentRole,
  BuildSquadDraftPayload,
} from './types';
import { asArray, asObject, asString } from './json';
import { BUILDSQUAD_AGENTS, BUILDSQUAD_AGENT_BY_ROLE } from './agents';

const ROLES: BuildSquadAgentRole[] = ['pm', 'ux', 'architect', 'backend', 'frontend', 'qa', 'gtm'];
const SEVERITIES = ['info', 'warning', 'blocker'] as const;
type Severity = (typeof SEVERITIES)[number];

const ALLOWED_SECTIONS = new Set([
  'product_vision',
  'prd',
  'mvp_scope',
  'user_stories',
  'architecture_brief',
  'roadmap',
  'prototype_brief',
]);

const MAX_CRITIQUES = 30;

export function normalizeCritiques(payload: unknown): BuildSquadAgentCritique[] {
  const o = asObject(payload);
  const arr = asArray<unknown>(o['critiques'] ?? payload);
  const out: BuildSquadAgentCritique[] = [];
  for (const item of arr) {
    if (out.length >= MAX_CRITIQUES) break;
    const c = asObject(item);
    const role = asString(c['role']) as BuildSquadAgentRole;
    if (!ROLES.includes(role)) continue;
    const targetSection = asString(c['targetSection']);
    if (!ALLOWED_SECTIONS.has(targetSection)) continue;
    const sev = asString(c['severity']) as Severity;
    const severity: Severity = SEVERITIES.includes(sev) ? sev : 'info';
    const comment = asString(c['comment']);
    if (!comment) continue;
    const suggestion = asString(c['suggestion']);
    const base: BuildSquadAgentCritique = { role, targetSection, severity, comment };
    out.push(suggestion ? { ...base, suggestion } : base);
  }
  return out;
}

/**
 * Run each charter's checklist deterministically. Surfaces every failed check
 * as a critique. Guarantees at least one critique per agent if there is
 * material to review.
 */
export function runDeterministicCritiqueChecks(draft: BuildSquadDraftPayload): BuildSquadAgentCritique[] {
  const out: BuildSquadAgentCritique[] = [];
  const mustStories = (draft.userStories ?? []).filter((s) => s.priority === 'must');

  // PM
  if ((draft.mvpScope?.explicitCuts ?? []).length === 0) {
    out.push({
      role: 'pm',
      targetSection: 'mvp_scope',
      severity: 'warning',
      comment: 'No explicit cuts listed; scope discipline is unclear.',
      suggestion: 'Add at least one "explicit cut" with a reason.',
    });
  }
  const filledWeeks = (draft.roadmap?.weeks ?? []).filter((w) => w.deliverables.length > 0).length;
  if (filledWeeks < 4) {
    out.push({
      role: 'pm',
      targetSection: 'roadmap',
      severity: 'warning',
      comment: `Only ${filledWeeks}/4 roadmap weeks have deliverables.`,
    });
  }
  const mustStoriesWithoutAC = mustStories.filter((s) => s.acceptanceCriteria.length === 0);
  if (mustStoriesWithoutAC.length > 0) {
    out.push({
      role: 'pm',
      targetSection: 'user_stories',
      severity: 'blocker',
      comment: `${mustStoriesWithoutAC.length} must-priority story(ies) have no acceptance criteria.`,
    });
  }

  // UX
  // (UX critique catches missing flow steps; persona-coverage check is best-effort.)
  const flowsWithoutSteps = (draft.prototypeBrief?.flows ?? []).filter((f) => f.steps.length < 2).length;
  if (flowsWithoutSteps > 0) {
    out.push({
      role: 'ux',
      targetSection: 'prototype_brief',
      severity: 'warning',
      comment: `${flowsWithoutSteps} prototype flow(s) have fewer than two steps.`,
    });
  }

  // Architect
  if ((draft.architectureBrief?.components ?? []).length < 3) {
    out.push({
      role: 'architect',
      targetSection: 'architecture_brief',
      severity: 'warning',
      comment: 'Architecture brief lists fewer than three components.',
    });
  }
  if ((draft.architectureBrief?.security ?? []).length === 0) {
    out.push({
      role: 'architect',
      targetSection: 'architecture_brief',
      severity: 'warning',
      comment: 'Architecture brief does not address security.',
    });
  }
  if ((draft.architectureBrief?.storage ?? []).length === 0) {
    out.push({
      role: 'architect',
      targetSection: 'architecture_brief',
      severity: 'warning',
      comment: 'Architecture brief does not specify storage.',
    });
  }

  // Backend
  const nfReqs = (draft.prd?.requirements ?? []).filter((r) => r.type === 'non_functional');
  if (nfReqs.length === 0) {
    out.push({
      role: 'backend',
      targetSection: 'prd',
      severity: 'warning',
      comment: 'PRD has no non-functional requirements.',
    });
  }

  // Frontend
  if ((draft.prototypeBrief?.pages ?? []).length < 2) {
    out.push({
      role: 'frontend',
      targetSection: 'prototype_brief',
      severity: 'warning',
      comment: 'Prototype brief lists fewer than two pages.',
    });
  }
  if ((draft.prototypeBrief?.uiComponents ?? []).length === 0) {
    out.push({
      role: 'frontend',
      targetSection: 'prototype_brief',
      severity: 'info',
      comment: 'UI components list is empty.',
    });
  }

  // QA
  const thinAC = mustStories.filter((s) => s.acceptanceCriteria.length > 0 && s.acceptanceCriteria.length < 2);
  if (thinAC.length > 0) {
    out.push({
      role: 'qa',
      targetSection: 'user_stories',
      severity: 'warning',
      comment: `${thinAC.length} must-priority story(ies) have fewer than two acceptance criteria.`,
    });
  }
  const lazyAC = (draft.userStories ?? []).some((s) =>
    s.acceptanceCriteria.some((a) => /\betc\.?\b/i.test(a)),
  );
  if (lazyAC) {
    out.push({
      role: 'qa',
      targetSection: 'user_stories',
      severity: 'info',
      comment: 'Some acceptance criteria use "etc"; replace with concrete cases.',
    });
  }

  // GTM
  const diffCount = (draft.productVision?.differentiation ?? []).length;
  if (diffCount < 2) {
    out.push({
      role: 'gtm',
      targetSection: 'product_vision',
      severity: 'warning',
      comment: 'Product vision lists fewer than two differentiation points.',
    });
  }
  const metricCount = (draft.productVision?.successMetrics ?? []).length;
  if (metricCount < 2) {
    out.push({
      role: 'gtm',
      targetSection: 'product_vision',
      severity: 'warning',
      comment: 'Product vision lists fewer than two success metrics.',
    });
  }

  return out;
}

/** Merge LLM critiques with deterministic checks, dedup by role+section+comment. */
export function mergeCritiques(
  llm: BuildSquadAgentCritique[],
  deterministic: BuildSquadAgentCritique[],
): BuildSquadAgentCritique[] {
  const seen = new Set<string>();
  const out: BuildSquadAgentCritique[] = [];
  for (const c of [...deterministic, ...llm]) {
    const key = `${c.role}|${c.targetSection}|${c.comment.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= MAX_CRITIQUES) break;
  }
  return out;
}

/** Returns roles that have produced at least one critique. */
export function activeCritiqueRoles(critiques: BuildSquadAgentCritique[]): BuildSquadAgentRole[] {
  const set = new Set<BuildSquadAgentRole>();
  for (const c of critiques) set.add(c.role);
  return BUILDSQUAD_AGENTS.map((a) => a.role).filter((r) => set.has(r));
}

export { BUILDSQUAD_AGENT_BY_ROLE };
