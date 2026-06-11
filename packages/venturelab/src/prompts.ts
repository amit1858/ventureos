/**
 * VentureLab prompt builders.
 *
 * VentureLab makes exactly TWO LLM calls:
 *   1. `signalsPrompt`     — extracts evidence per dimension from upstream data.
 *   2. `assumptionsPrompt` — surfaces explicit + implicit + risky + dependency
 *                            assumptions and proposes validation strategies.
 *
 * Both prompts demand a SINGLE JSON object. Neither asks the model to produce
 * a score, a recommendation, or a decision — those are computed deterministically
 * downstream by the rule engine.
 */
import type { ChatMessage } from '@ventureos/contracts';

import type { VentureLabInput } from './types';

const SYSTEM_BASE = [
  'You are VentureLab, the venture-validation reasoning engine for VentureOS.',
  'You ALWAYS reply with a SINGLE JSON object that matches the requested schema.',
  'Never include commentary, markdown fences, or prose outside the JSON object.',
  'You extract evidence verbatim or as close-to-verbatim short quotes.',
  'You NEVER fabricate evidence. If there is no evidence for a dimension, return an empty array.',
  'You NEVER produce a recommendation, a decision, or an overall score — those are computed elsewhere.',
].join(' ');

function briefBlock(input: VentureLabInput): string {
  const b = input.brief;
  return [
    `Business idea: ${b.businessIdea}`,
    `Target market: ${b.targetMarket}`,
    `Customer type: ${b.customerType}`,
    `Region: ${b.region}`,
    `Business size: ${b.businessSize}`,
    b.additionalContext ? `Additional context: ${b.additionalContext}` : '',
  ].filter(Boolean).join('\n');
}

function personasBlock(input: VentureLabInput): string {
  return input.personas
    .map((p) => `- id=${p.id} | ${p.name} | role=${p.role} | decisionPower=${p.decisionPower} | pains=${(p.painPoints || []).slice(0, 3).join('; ')} | objections=${(p.objections || []).slice(0, 3).join('; ')} | triggers=${(p.buyingTriggers || []).slice(0, 3).join('; ')}`)
    .join('\n');
}

function transcriptsBlock(input: VentureLabInput): string {
  const blob = JSON.stringify({
    interviews: input.interviews ?? [],
    focusGroups: input.focusGroups ?? [],
  });
  // Cap to keep the prompt within reasonable token bounds.
  return blob.slice(0, 6000);
}

function committeeBlock(input: VentureLabInput): string {
  if (!input.committee) return '(no buying committee output available)';
  const c = input.committee;
  const d = c.deliberation;
  const summary = {
    decision: c.decision,
    decisionRationale: c.decisionRationale,
    members: c.members.map((m) => ({ id: m.personaId, stance: m.stance, role: m.committeeRole })),
    deliberation: d ? {
      consensusLevel: d.consensusLevel,
      confidenceScore: d.confidenceScore,
      initialPositions: d.phases.initialPositions.map((o) => ({ id: o.personaId, position: o.position, enthusiasm: o.enthusiasm })),
      consensus: d.phases.consensus.map((o) => ({ id: o.personaId, position: o.position, enthusiasm: o.enthusiasm })),
      opinionChanges: d.opinionChanges,
      unresolvedObjections: d.unresolvedObjections,
      strongestSupportingArguments: d.strongestSupportingArguments,
      strongestOpposingArguments: d.strongestOpposingArguments,
      whatWouldChangeMinds: d.whatWouldChangeMinds,
    } : null,
  };
  return JSON.stringify(summary).slice(0, 4000);
}

function notesBlock(input: VentureLabInput): string {
  if (!input.notes || input.notes.length === 0) return '';
  return 'Founder/user notes:\n' + input.notes.map((n) => `- ${n}`).join('\n').slice(0, 2000);
}

const EVIDENCE_SHAPE = [
  '  {',
  '    "kind": "persona" | "interview" | "focus_group" | "committee" | "brief" | "note",',
  '    "source": "string (stable id: persona id, \'committee.unresolvedObjections[0]\', \'brief.founderAssumptions[2]\', etc.)",',
  '    "quote": "string (short verbatim or near-verbatim excerpt)",',
  '    "weight": 0.0,',
  '    "confidence": "low" | "medium" | "high"',
  '  }',
].join('\n');

export function signalsPrompt(input: VentureLabInput): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: [
        briefBlock(input),
        '',
        'Personas:',
        personasBlock(input),
        '',
        'Transcripts (JSON, may be truncated):',
        transcriptsBlock(input),
        '',
        'Buying committee summary (JSON):',
        committeeBlock(input),
        '',
        notesBlock(input),
        '',
        'TASK — extract evidence per dimension. Each evidence item must be tied to a SPECIFIC source',
        'and must include a short quote. Do NOT score. Do NOT recommend. If there is no real evidence,',
        'return an empty array for that dimension.',
        '',
        'Produce JSON shaped EXACTLY like:',
        '{',
        '  "problemEvidence":             [' + EVIDENCE_SHAPE + '],',
        '  "urgencyEvidence":             [/* same shape */],',
        '  "willingnessToPayEvidence":    [/* same shape */],',
        '  "differentiationEvidence":     [/* same shape */],',
        '  "adoptionFrictionEvidence":    [/* same shape */],',
        '  "executionRiskEvidence":       [/* same shape */],',
        '  "marketClarityEvidence":       [/* same shape */]',
        '}',
        '',
        'Rules:',
        '- Use "kind": "committee" for anything from the buying committee deliberation.',
        '- Use "kind": "brief" for explicit founder assumptions in the brief.',
        '- Use "kind": "persona" for persona pains/objections/triggers.',
        '- Use "kind": "interview" / "focus_group" for transcript turns.',
        '- The same evidence may appear under multiple dimensions if it genuinely supports each.',
        '- For each dimension, prefer 3-6 strong items over a long list of weak ones.',
      ].filter(Boolean).join('\n'),
    },
  ];
}

export function assumptionsPrompt(input: VentureLabInput): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: [
        briefBlock(input),
        '',
        'Personas:',
        personasBlock(input),
        '',
        'Buying committee summary (JSON):',
        committeeBlock(input),
        '',
        notesBlock(input),
        '',
        'TASK — list the assumptions this venture relies on. Cover all four types:',
        '  - "explicit": stated outright in the brief or by founders.',
        '  - "implicit": required for the plan to work but not stated.',
        '  - "risky":    plausibly false, would invalidate the venture if wrong.',
        '  - "dependency": relies on an external system, partner, or condition.',
        '',
        'For each assumption, propose a concrete, low-cost validation strategy.',
        '',
        'Produce JSON shaped EXACTLY like:',
        '{',
        '  "assumptions": [',
        '    {',
        '      "id": "a1",',
        '      "text": "string",',
        '      "type": "explicit" | "implicit" | "risky" | "dependency",',
        '      "confidence": "low" | "medium" | "high",',
        '      "riskLevel": "low" | "medium" | "high" | "critical",',
        '      "validationStrategy": "string (one concrete action — interview N users, run pricing test, etc.)",',
        '      "evidence": [' + EVIDENCE_SHAPE + ']',
        '    }',
        '  ]',
        '}',
        '',
        'Stable ids a1, a2, a3 ... Keep `text` under 240 chars. 6-15 assumptions is the sweet spot.',
      ].filter(Boolean).join('\n'),
    },
  ];
}
