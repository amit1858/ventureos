/**
 * Normalises the LLM drafting payload into well-formed contract types.
 *
 * Drops malformed entries silently. Auto-assigns ids when missing. Guarantees
 * the shape callers can rely on (e.g. roadmap.weeks always has entries for
 * weeks 1..4, MVP scope always has at least one explicit cut).
 */
import type {
  BuildSquadArchitectureBrief,
  BuildSquadDraftPayload,
  BuildSquadMVPScope,
  BuildSquadPRD,
  BuildSquadPRDJourney,
  BuildSquadPRDRequirement,
  BuildSquadProductVision,
  BuildSquadPrototypeBrief,
  BuildSquadRoadmap,
  BuildSquadRoadmapWeek,
  BuildSquadUserStory,
  StoryPriority,
} from './types';
import { asArray, asObject, asString, asStringArray } from './json';

const STORY_PRIORITIES: StoryPriority[] = ['must', 'should', 'later'];

export function normalizeDraft(payload: unknown): BuildSquadDraftPayload {
  const o = asObject(payload);
  return {
    productVision: normalizeProductVision(o['productVision']),
    prd: normalizePrd(o['prd']),
    mvpScope: normalizeMvpScope(o['mvpScope']),
    userStories: normalizeUserStories(o['userStories']),
    architectureBrief: normalizeArchitectureBrief(o['architectureBrief']),
    roadmap: normalizeRoadmap(o['roadmap']),
    prototypeBrief: normalizePrototypeBrief(o['prototypeBrief']),
  };
}

export function normalizeProductVision(v: unknown): BuildSquadProductVision {
  const o = asObject(v);
  return {
    problem: asString(o['problem']),
    targetUsers: asStringArray(o['targetUsers']),
    productPromise: asString(o['productPromise']),
    whyNow: asString(o['whyNow']),
    differentiation: asStringArray(o['differentiation']),
    successMetrics: asStringArray(o['successMetrics']),
  };
}

export function normalizePrd(v: unknown): BuildSquadPRD | undefined {
  if (!v) return undefined;
  const o = asObject(v);
  const personas = asArray<unknown>(o['personas'])
    .map((p) => asObject(p))
    .filter((p) => asString(p['id']).length > 0)
    .map((p) => ({
      id: asString(p['id']),
      name: asString(p['name']),
      summary: asString(p['summary']),
    }));
  let reqIdx = 0;
  const requirements: BuildSquadPRDRequirement[] = asArray<unknown>(o['requirements'])
    .map((r) => asObject(r))
    .filter((r) => asString(r['text']).length > 0)
    .map((r): BuildSquadPRDRequirement => {
      const t = r['type'] === 'non_functional' ? 'non_functional' : 'functional';
      const rationale = asString(r['rationale']);
      const base: BuildSquadPRDRequirement = {
        id: asString(r['id']) || `req_${++reqIdx}`,
        text: asString(r['text']),
        type: t,
      };
      return rationale ? { ...base, rationale } : base;
    });
  let jIdx = 0;
  const userJourneys: BuildSquadPRDJourney[] = asArray<unknown>(o['userJourneys'])
    .map((j) => asObject(j))
    .filter((j) => asString(j['title']).length > 0)
    .map((j): BuildSquadPRDJourney => {
      const personaId = asString(j['personaId']);
      const base: BuildSquadPRDJourney = {
        id: asString(j['id']) || `j_${++jIdx}`,
        title: asString(j['title']),
        steps: asStringArray(j['steps']),
      };
      return personaId ? { ...base, personaId } : base;
    });
  return {
    overview: asString(o['overview']),
    goals: asStringArray(o['goals']),
    nonGoals: asStringArray(o['nonGoals']),
    personas,
    requirements,
    userJourneys,
    metrics: asStringArray(o['metrics']),
    risks: asStringArray(o['risks']),
  };
}

export function normalizeMvpScope(v: unknown): BuildSquadMVPScope | undefined {
  if (!v) return undefined;
  const o = asObject(v);
  const explicitCuts = asArray<unknown>(o['explicitCuts'])
    .map((c) => asObject(c))
    .filter((c) => asString(c['item']).length > 0)
    .map((c) => ({ item: asString(c['item']), reason: asString(c['reason']) }));
  return {
    mustHave: asStringArray(o['mustHave']),
    shouldHave: asStringArray(o['shouldHave']),
    later: asStringArray(o['later']),
    explicitCuts,
  };
}

export function normalizeUserStories(v: unknown): BuildSquadUserStory[] | undefined {
  const arr = asArray<unknown>(v);
  if (arr.length === 0) return undefined;
  let idx = 0;
  return arr
    .map((s) => asObject(s))
    .filter((s) => asString(s['title']).length > 0)
    .map((s): BuildSquadUserStory => {
      const priorityRaw = asString(s['priority']) as StoryPriority;
      const priority: StoryPriority = STORY_PRIORITIES.includes(priorityRaw) ? priorityRaw : 'should';
      const personaId = asString(s['personaId']);
      const base: BuildSquadUserStory = {
        id: asString(s['id']) || `us_${++idx}`,
        title: asString(s['title']),
        story: asString(s['story']),
        acceptanceCriteria: asStringArray(s['acceptanceCriteria']),
        priority,
      };
      return personaId ? { ...base, personaId } : base;
    });
}

export function normalizeArchitectureBrief(v: unknown): BuildSquadArchitectureBrief | undefined {
  if (!v) return undefined;
  const o = asObject(v);
  const components = asArray<unknown>(o['components'])
    .map((c) => asObject(c))
    .filter((c) => asString(c['name']).length > 0)
    .map((c) => ({ name: asString(c['name']), responsibility: asString(c['responsibility']) }));
  return {
    components,
    dataFlow: asStringArray(o['dataFlow']),
    integrations: asStringArray(o['integrations']),
    storage: asStringArray(o['storage']),
    security: asStringArray(o['security']),
    scalabilityAssumptions: asStringArray(o['scalabilityAssumptions']),
  };
}

export function normalizeRoadmap(v: unknown): BuildSquadRoadmap | undefined {
  if (!v) return undefined;
  const o = asObject(v);
  const provided = asArray<unknown>(o['weeks'])
    .map((w) => asObject(w))
    .filter((w) => typeof w['week'] === 'number');
  const byWeek = new Map<number, BuildSquadRoadmapWeek>();
  for (const w of provided) {
    const week = w['week'] as number;
    if (week !== 1 && week !== 2 && week !== 3 && week !== 4) continue;
    byWeek.set(week, {
      week: week as 1 | 2 | 3 | 4,
      theme: asString(w['theme']),
      deliverables: asStringArray(w['deliverables']),
    });
  }
  const weeks: BuildSquadRoadmapWeek[] = ([1, 2, 3, 4] as const).map(
    (n) => byWeek.get(n) ?? { week: n, theme: '', deliverables: [] },
  );
  return { weeks, futureBacklog: asStringArray(o['futureBacklog']) };
}

export function normalizePrototypeBrief(v: unknown): BuildSquadPrototypeBrief | undefined {
  if (!v) return undefined;
  const o = asObject(v);
  const pages = asArray<unknown>(o['pages'])
    .map((p) => asObject(p))
    .filter((p) => asString(p['name']).length > 0)
    .map((p) => ({ name: asString(p['name']), purpose: asString(p['purpose']) }));
  const flows = asArray<unknown>(o['flows'])
    .map((f) => asObject(f))
    .filter((f) => asString(f['name']).length > 0)
    .map((f) => ({ name: asString(f['name']), steps: asStringArray(f['steps']) }));
  return {
    pages,
    flows,
    uiComponents: asStringArray(o['uiComponents']),
    demoScenario: asString(o['demoScenario']),
  };
}
