/**
 * Deterministic evaluation of a generated persona set.
 *
 * All scores are in [0, 1] except `contradictionCount` which is a non-negative
 * integer. The evaluator never calls an LLM — it inspects field content using
 * cheap heuristics so results are reproducible and never leak prompts to a
 * provider.
 */
import type {
  BuyingCommitteeDeliberation,
  BuyingCommitteeEvaluation,
  CommitteePosition,
  PersonaLabPersona,
  PersonaSetEvaluation,
} from './types';

const GENERIC_PAIN_TOKENS = new Set(['slow', 'hard', 'difficult', 'bad', 'expensive', 'issue']);
const GENERIC_TRIGGER_TOKENS = new Set(['need', 'want', 'use', 'buy']);

function uniqueLowered(values: string[]): Set<string> {
  return new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const v of a) if (b.has(v)) intersect += 1;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function diversity(personas: PersonaLabPersona[]): number {
  if (personas.length <= 1) return 0;
  const roles = uniqueLowered(personas.map((p) => p.role));
  const decisions = uniqueLowered(personas.map((p) => p.decisionPower));
  // Pairwise dissimilarity over pain points + goals.
  let pairs = 0;
  let dissimilaritySum = 0;
  for (let i = 0; i < personas.length; i++) {
    for (let j = i + 1; j < personas.length; j++) {
      const a = personas[i];
      const b = personas[j];
      if (!a || !b) continue;
      const setA = uniqueLowered([...a.painPoints, ...a.goals]);
      const setB = uniqueLowered([...b.painPoints, ...b.goals]);
      dissimilaritySum += 1 - jaccard(setA, setB);
      pairs += 1;
    }
  }
  const dissimilarity = pairs > 0 ? dissimilaritySum / pairs : 0;
  const roleSpread = Math.min(1, roles.size / personas.length);
  const decisionSpread = Math.min(1, decisions.size / 3);
  return clamp01(0.5 * dissimilarity + 0.3 * roleSpread + 0.2 * decisionSpread);
}

function consistency(personas: PersonaLabPersona[]): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let ok = 0;
  for (const p of personas) {
    let local = 1;
    if (!p.role.trim()) { local -= 0.4; warnings.push(`${p.id}: role is empty`); }
    if (!p.businessContext.trim()) { local -= 0.2; warnings.push(`${p.id}: businessContext is empty`); }
    if (p.painPoints.length === 0) { local -= 0.2; warnings.push(`${p.id}: no pain points`); }
    if (p.buyingTriggers.length === 0) { local -= 0.1; warnings.push(`${p.id}: no buying triggers`); }
    if (!p.quote.trim()) { local -= 0.1; warnings.push(`${p.id}: empty quote`); }
    ok += Math.max(0, local);
  }
  const score = personas.length === 0 ? 0 : ok / personas.length;
  return { score, warnings };
}

function roleRealism(personas: PersonaLabPersona[]): number {
  if (personas.length === 0) return 0;
  let realistic = 0;
  for (const p of personas) {
    const hasRole = p.role.trim().length >= 3;
    const hasContext = p.businessContext.trim().length >= 10;
    const hasGoals = p.goals.length > 0;
    if (hasRole && hasContext && hasGoals) realistic += 1;
  }
  return realistic / personas.length;
}

function painPointSpecificity(personas: PersonaLabPersona[]): number {
  let scored = 0;
  let count = 0;
  for (const p of personas) {
    for (const pain of p.painPoints) {
      count += 1;
      const words = pain.trim().split(/\s+/);
      const lowered = words.map((w) => w.toLowerCase());
      const generic = lowered.every((w) => GENERIC_PAIN_TOKENS.has(w) || w.length < 4);
      // Specific = at least 6 words AND not entirely generic tokens.
      if (words.length >= 6 && !generic) scored += 1;
      else if (words.length >= 4 && !generic) scored += 0.5;
    }
  }
  return count === 0 ? 0 : scored / count;
}

function buyingTriggerQuality(personas: PersonaLabPersona[]): number {
  let scored = 0;
  let count = 0;
  for (const p of personas) {
    for (const trigger of p.buyingTriggers) {
      count += 1;
      const words = trigger.trim().split(/\s+/);
      const lowered = words.map((w) => w.toLowerCase());
      const generic = lowered.every((w) => GENERIC_TRIGGER_TOKENS.has(w) || w.length < 4);
      if (words.length >= 5 && !generic) scored += 1;
      else if (words.length >= 3 && !generic) scored += 0.5;
    }
  }
  return count === 0 ? 0 : scored / count;
}

function detectContradictions(personas: PersonaLabPersona[]): string[] {
  const findings: string[] = [];
  // Duplicate ids
  const ids = new Set<string>();
  for (const p of personas) {
    if (ids.has(p.id)) findings.push(`duplicate persona id: ${p.id}`);
    ids.add(p.id);
  }
  // Decision power mismatch with committee role text
  for (const p of personas) {
    const roleLower = p.role.toLowerCase();
    if (
      p.decisionPower === 'low' &&
      /\b(ceo|owner|founder|director|head of|cfo|coo)\b/.test(roleLower)
    ) {
      findings.push(`${p.id}: role "${p.role}" implies high decision power but field is "low"`);
    }
    if (
      p.decisionPower === 'high' &&
      /\b(intern|junior|trainee|assistant)\b/.test(roleLower)
    ) {
      findings.push(`${p.id}: role "${p.role}" implies low decision power but field is "high"`);
    }
  }
  return findings;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export function evaluatePersonaSet(personas: PersonaLabPersona[]): PersonaSetEvaluation {
  const diversityScore = diversity(personas);
  const { score: consistencyScore, warnings } = consistency(personas);
  const roleRealismScore = roleRealism(personas);
  const painPointSpecificityScore = painPointSpecificity(personas);
  const buyingTriggerQualityScore = buyingTriggerQuality(personas);
  const contradictions = detectContradictions(personas);
  const overallScore = clamp01(
    0.25 * diversityScore +
      0.2 * consistencyScore +
      0.2 * roleRealismScore +
      0.2 * painPointSpecificityScore +
      0.15 * buyingTriggerQualityScore,
  );
  return {
    diversityScore,
    consistencyScore,
    roleRealismScore,
    painPointSpecificityScore,
    buyingTriggerQualityScore,
    contradictionCount: contradictions.length,
    contradictions,
    warnings,
    overallScore,
  };
}

// ──────────── Buying-committee deliberation evaluation (Sprint 1D.5) ─────────

const GENERIC_CHALLENGE_TOKENS = new Set([
  'why', 'how', 'really', 'sure', 'maybe', 'just', 'thing', 'stuff',
]);

function deliberationDiversityOfViewpoints(
  d: BuyingCommitteeDeliberation,
): number {
  const initial = d.phases.initialPositions;
  if (initial.length === 0) return 0;
  const positions = new Set<CommitteePosition>(initial.map((o) => o.position));
  const positionSpread = positions.size / 4; // 4 valid positions
  // concern uniqueness across participants
  const concernSets = initial.map((o) => uniqueLowered(o.concerns));
  let pairs = 0;
  let dissim = 0;
  for (let i = 0; i < concernSets.length; i++) {
    for (let j = i + 1; j < concernSets.length; j++) {
      const a = concernSets[i];
      const b = concernSets[j];
      if (!a || !b) continue;
      dissim += 1 - jaccard(a, b);
      pairs += 1;
    }
  }
  const concernDiversity = pairs > 0 ? dissim / pairs : 0;
  return clamp01(0.5 * positionSpread + 0.5 * concernDiversity);
}

function deliberationChallengeQuality(
  d: BuyingCommitteeDeliberation,
): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  const challenges = d.phases.challenges;
  if (challenges.length === 0) {
    warnings.push('no challenges were raised in the deliberation');
    return { score: 0, warnings };
  }
  let scored = 0;
  for (const c of challenges) {
    const words = c.argument.trim().split(/\s+/);
    const lowered = words.map((w) => w.toLowerCase());
    const genericRatio = lowered.filter((w) => GENERIC_CHALLENGE_TOKENS.has(w)).length / Math.max(1, lowered.length);
    const onTopic = c.topic !== 'other' ? 1 : 0.5;
    let s = 0;
    if (words.length >= 25 && genericRatio < 0.3) s = 1;
    else if (words.length >= 15) s = 0.7;
    else if (words.length >= 8) s = 0.4;
    scored += s * (0.5 + 0.5 * onTopic);
  }
  // topic spread
  const topics = new Set(challenges.map((c) => c.topic));
  const topicBonus = Math.min(0.2, topics.size * 0.05);
  return { score: clamp01(scored / challenges.length + topicBonus), warnings };
}

function deliberationObjectionQuality(
  d: BuyingCommitteeDeliberation,
): number {
  const all = [
    ...d.unresolvedObjections,
    ...d.phases.consensus.flatMap((o) => o.concerns),
  ];
  if (all.length === 0) return 0;
  let scored = 0;
  for (const obj of all) {
    const words = obj.trim().split(/\s+/);
    if (words.length >= 8) scored += 1;
    else if (words.length >= 5) scored += 0.6;
    else if (words.length >= 3) scored += 0.3;
  }
  return clamp01(scored / all.length);
}

function deliberationOpinionMovement(d: BuyingCommitteeDeliberation): number {
  const initial = d.phases.initialPositions;
  const consensus = d.phases.consensus;
  if (initial.length === 0 || consensus.length === 0) return 0;
  const initialById = new Map(initial.map((o) => [o.personaId, o.position]));
  let moved = 0;
  let total = 0;
  for (const o of consensus) {
    const before = initialById.get(o.personaId);
    if (!before) continue;
    total += 1;
    if (before !== o.position) moved += 1;
  }
  if (total === 0) return 0;
  // Reward some movement (active deliberation), but not chaos.
  const ratio = moved / total;
  if (ratio === 0) return 0.2;
  if (ratio <= 0.5) return clamp01(0.6 + ratio);
  return clamp01(1 - (ratio - 0.5));
}

function deliberationConsensusStrength(d: BuyingCommitteeDeliberation): number {
  const level = d.consensusLevel;
  const base =
    level === 'strong' ? 1 :
    level === 'moderate' ? 0.7 :
    level === 'weak' ? 0.4 : 0.2;
  return clamp01(base * (0.5 + 0.5 * d.confidenceScore));
}

export function evaluateBuyingCommittee(
  d: BuyingCommitteeDeliberation,
): BuyingCommitteeEvaluation {
  const diversityOfViewpoints = deliberationDiversityOfViewpoints(d);
  const { score: challengeQuality, warnings: cqWarnings } = deliberationChallengeQuality(d);
  const objectionQuality = deliberationObjectionQuality(d);
  const opinionMovement = deliberationOpinionMovement(d);
  const consensusStrength = deliberationConsensusStrength(d);
  const warnings = [...cqWarnings];
  if (d.phases.initialPositions.length < 2) {
    warnings.push('fewer than 2 participants — deliberation cannot be meaningful');
  }
  if (d.phases.responses.length === 0 && d.phases.challenges.length > 0) {
    warnings.push('challenges raised but no responses captured');
  }
  const overallScore = clamp01(
    0.25 * diversityOfViewpoints +
      0.25 * challengeQuality +
      0.2 * objectionQuality +
      0.15 * opinionMovement +
      0.15 * consensusStrength,
  );
  return {
    diversityOfViewpoints,
    challengeQuality,
    objectionQuality,
    opinionMovement,
    consensusStrength,
    warnings,
    overallScore,
  };
}
