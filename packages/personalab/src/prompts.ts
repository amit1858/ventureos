/**
 * Prompt builders for PersonaLab.
 *
 * Every builder returns a `ChatMessage[]` that asks the LLM to produce a
 * single JSON object that conforms to the documented shape. Keep prompts
 * deterministic and explicit so cheap models can comply.
 */
import type { ChatMessage } from '@foundry/contracts';

import type {
  PersonaLabBrief,
  PersonaLabPersona,
  InterviewTranscript,
  FocusGroupTranscript,
} from './types';

const SYSTEM_BASE = [
  'You are PersonaLab, a persona-simulation engine for Foundry.',
  'You always reply with a SINGLE JSON object that matches the requested schema.',
  'Output ONLY the JSON object. Do not include any text before or after the JSON.',
  'Do not wrap the JSON in markdown fences (no ```json, no ```).',
  'When asked to produce dialogue, write realistic but concise turns (1-3 sentences each).',
  'Persona traits must be plausible for the given business context and region.',
].join(' ');

function briefBlock(b: PersonaLabBrief): string {
  return [
    `Business idea: ${b.businessIdea}`,
    `Target market: ${b.targetMarket}`,
    `Customer type: ${b.customerType}`,
    `Region: ${b.region}`,
    `Business size: ${b.businessSize}`,
    b.additionalContext ? `Additional context: ${b.additionalContext}` : '',
  ].filter(Boolean).join('\n');
}

function personaBlock(p: PersonaLabPersona): string {
  return [
    `id=${p.id}`,
    `name=${p.name}`,
    `role=${p.role}`,
    `context=${p.businessContext}`,
    `goals=${p.goals.join('; ')}`,
    `pains=${p.painPoints.join('; ')}`,
    `motivations=${p.motivations.join('; ')}`,
    `objections=${p.objections.join('; ')}`,
    `triggers=${p.buyingTriggers.join('; ')}`,
    `decisionPower=${p.decisionPower}`,
  ].join(' | ');
}

export function generatePersonasPrompt(brief: PersonaLabBrief, n: number): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: [
        briefBlock(brief),
        '',
        `Generate ${n} distinct stakeholder personas relevant to this venture.`,
        'Cover diverse roles, decision power, and viewpoints (buyers, blockers, end users).',
        'Reply with JSON shaped exactly like:',
        '{',
        '  "personas": [',
        '    {',
        '      "id": "p1",',
        '      "name": "string",',
        '      "role": "string",',
        '      "businessContext": "string",',
        '      "goals": ["string"],',
        '      "painPoints": ["string"],',
        '      "motivations": ["string"],',
        '      "objections": ["string"],',
        '      "buyingTriggers": ["string"],',
        '      "decisionPower": "low" | "medium" | "high",',
        '      "quote": "string",',
        '      "confidenceScore": 0.0-1.0,',
        '      "evidenceNotes": ["string"]',
        '    }',
        '  ]',
        '}',
        'Use stable ids p1, p2, p3 ... Quotes must sound like the persona speaking in first person.',
      ].join('\n'),
    },
  ];
}

export function interviewPrompt(
  persona: PersonaLabPersona,
  brief: PersonaLabBrief,
  topic: string,
  questions: string[],
): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: [
        briefBlock(brief),
        '',
        `Run a 1:1 interview with this persona about: ${topic}`,
        `Persona: ${personaBlock(persona)}`,
        '',
        'Interviewer questions:',
        ...questions.map((q, i) => `${i + 1}. ${q}`),
        '',
        'Produce a JSON transcript shaped like:',
        '{',
        `  "personaId": "${persona.id}",`,
        `  "topic": "${topic.replace(/"/g, '\\"')}",`,
        '  "turns": [ { "speaker": "interviewer" | "persona", "content": "string" } ],',
        '  "summary": "string (max 3 sentences)"',
        '}',
        'Stay in character for the persona. Each turn 1-3 sentences. Cover every question.',
      ].join('\n'),
    },
  ];
}

export function focusGroupPrompt(
  personas: PersonaLabPersona[],
  brief: PersonaLabBrief,
  topic: string,
  rounds: number,
): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: [
        briefBlock(brief),
        '',
        `Moderate a focus group of ${personas.length} participants on: ${topic}.`,
        'Each participant must speak at least once. Hold roughly the same number of turns per persona.',
        `Run ${rounds} rounds of discussion.`,
        '',
        'Participants:',
        ...personas.map(personaBlock),
        '',
        'Produce JSON shaped like:',
        '{',
        `  "topic": "${topic.replace(/"/g, '\\"')}",`,
        `  "participantIds": ${JSON.stringify(personas.map((p) => p.id))},`,
        '  "turns": [ { "speakerPersonaId": "p1", "content": "string" } ],',
        '  "summary": "string",',
        '  "agreements": ["string"],',
        '  "disagreements": ["string"]',
        '}',
      ].join('\n'),
    },
  ];
}

export function buyingCommitteePrompt(
  personas: PersonaLabPersona[],
  brief: PersonaLabBrief,
  offerSummary: string,
): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: [
        briefBlock(brief),
        '',
        `Simulate a B2B buying committee evaluating this offer:\n${offerSummary}`,
        '',
        'Participants (the committee):',
        ...personas.map(personaBlock),
        '',
        'Produce JSON shaped like:',
        '{',
        `  "offerSummary": "${offerSummary.replace(/"/g, '\\"').slice(0, 200)}",`,
        '  "members": [',
        '    {',
        '      "personaId": "p1",',
        '      "committeeRole": "Economic Buyer" | "Technical Buyer" | "Champion" | "User" | "Influencer" | "Blocker",',
        '      "stance": "champion" | "supporter" | "neutral" | "skeptic" | "blocker",',
        '      "rationale": "string",',
        '      "blockingObjections": ["string"]',
        '    }',
        '  ],',
        '  "decision": "buy" | "pilot" | "defer" | "reject",',
        '  "decisionRationale": "string",',
        '  "nextSteps": ["string"]',
        '}',
      ].join('\n'),
    },
  ];
}

// ──────────── Phased buying-committee deliberation (Sprint 1D.5) ────────────
//
// Four sequential calls. Each call consumes the output of the previous one so
// the model must actually reason across phases rather than emit a single
// pre-baked verdict. Every prompt asks for a SINGLE JSON object and lists the
// exact keys to emit — cheap models comply more reliably with explicit shapes.

const DELIBERATION_SYSTEM = [
  SYSTEM_BASE,
  'You are also a multi-agent deliberation engine: stay strictly in character for each persona,',
  'name participants by their persona id (p1, p2, ...), and never invent ids that are not in the participant list.',
  'Positions MUST be one of: "support", "support_with_concerns", "pilot_first", "reject".',
].join(' ');

function offerBlock(offerSummary: string, brief: PersonaLabBrief): string {
  return [
    briefBlock(brief),
    '',
    `Offer under evaluation:`,
    offerSummary,
  ].join('\n');
}

export function bcInitialPositionsPrompt(
  personas: PersonaLabPersona[],
  brief: PersonaLabBrief,
  offerSummary: string,
): ChatMessage[] {
  return [
    { role: 'system', content: DELIBERATION_SYSTEM },
    {
      role: 'user',
      content: [
        offerBlock(offerSummary, brief),
        '',
        'Phase 1 — INITIAL POSITIONS. Each participant must state, in their own voice:',
        '  1. their enthusiasm (0..1),',
        '  2. their concerns (3-6 short bullets, specific to their role and context),',
        '  3. their willingness to adopt (one sentence),',
        '  4. their starting position.',
        '',
        'Participants:',
        ...personas.map(personaBlock),
        '',
        'Produce JSON shaped EXACTLY like:',
        '{',
        '  "initialPositions": [',
        '    {',
        '      "personaId": "p1",',
        '      "position": "support" | "support_with_concerns" | "pilot_first" | "reject",',
        '      "enthusiasm": 0.0,',
        '      "concerns": ["string"],',
        '      "willingnessToAdopt": "string",',
        '      "rationale": "string"',
        '    }',
        '  ]',
        '}',
        'Do not omit any participant. Concerns must be specific (not generic words like "bad" or "slow").',
      ].join('\n'),
    },
  ];
}

export function bcChallengePrompt(
  personas: PersonaLabPersona[],
  brief: PersonaLabBrief,
  offerSummary: string,
  initialPositions: unknown,
): ChatMessage[] {
  return [
    { role: 'system', content: DELIBERATION_SYSTEM },
    {
      role: 'user',
      content: [
        offerBlock(offerSummary, brief),
        '',
        'Phase 2 — CHALLENGES. Given each participant\'s initial position below,',
        'have participants challenge ONE ANOTHER. A challenge is a direct, specific',
        'question or objection from one participant to another about a stated position.',
        'Cover a mix of topics: assumption, pricing, onboarding, roi, workflow, trust.',
        'Aim for at least 1 challenge per participant either as sender or recipient.',
        'Do NOT have participants challenge themselves.',
        '',
        'Participants:',
        ...personas.map(personaBlock),
        '',
        'Initial positions (Phase 1 output):',
        JSON.stringify(initialPositions).slice(0, 4000),
        '',
        'Produce JSON shaped EXACTLY like:',
        '{',
        '  "challenges": [',
        '    {',
        '      "fromPersonaId": "p1",',
        '      "toPersonaId": "p2",',
        '      "topic": "assumption" | "pricing" | "onboarding" | "roi" | "workflow" | "trust" | "other",',
        '      "argument": "string (one paragraph, specific, addressed to the other persona)"',
        '    }',
        '  ]',
        '}',
      ].join('\n'),
    },
  ];
}

export function bcResponsePrompt(
  personas: PersonaLabPersona[],
  brief: PersonaLabBrief,
  offerSummary: string,
  initialPositions: unknown,
  challenges: unknown,
): ChatMessage[] {
  return [
    { role: 'system', content: DELIBERATION_SYSTEM },
    {
      role: 'user',
      content: [
        offerBlock(offerSummary, brief),
        '',
        'Phase 3 — RESPONSES. For every challenge in the list below, the recipient',
        'persona must respond IN CHARACTER. They may defend their position OR change',
        'their mind if the argument is strong. Mark `changedOpinion: true` if the',
        'recipient\'s position would shift as a result of this challenge.',
        '',
        'Participants:',
        ...personas.map(personaBlock),
        '',
        'Initial positions (Phase 1):',
        JSON.stringify(initialPositions).slice(0, 3000),
        '',
        'Challenges (Phase 2):',
        JSON.stringify(challenges).slice(0, 4000),
        '',
        'Produce JSON shaped EXACTLY like:',
        '{',
        '  "responses": [',
        '    {',
        '      "fromPersonaId": "p1",',
        '      "challengeIndex": 0,',
        '      "argument": "string",',
        '      "changedOpinion": true | false',
        '    }',
        '  ]',
        '}',
        '`challengeIndex` is the 0-based index into the Phase 2 challenges array.',
      ].join('\n'),
    },
  ];
}

export function bcConsensusPrompt(
  personas: PersonaLabPersona[],
  brief: PersonaLabBrief,
  offerSummary: string,
  initialPositions: unknown,
  challenges: unknown,
  responses: unknown,
): ChatMessage[] {
  return [
    { role: 'system', content: DELIBERATION_SYSTEM },
    {
      role: 'user',
      content: [
        offerBlock(offerSummary, brief),
        '',
        'Phase 4+5 — CONSENSUS AND DECISION. Given the full deliberation history,',
        'state each participant\'s FINAL position (which may differ from their initial),',
        'list which positions actually moved, and synthesise a committee-level decision.',
        'The decision must be a direct consequence of the deliberation, not pre-existing bias.',
        '',
        'Participants:',
        ...personas.map(personaBlock),
        '',
        'Initial positions:',
        JSON.stringify(initialPositions).slice(0, 2500),
        '',
        'Challenges:',
        JSON.stringify(challenges).slice(0, 2500),
        '',
        'Responses:',
        JSON.stringify(responses).slice(0, 2500),
        '',
        'Produce JSON shaped EXACTLY like:',
        '{',
        '  "consensus": [',
        '    {',
        '      "personaId": "p1",',
        '      "position": "support" | "support_with_concerns" | "pilot_first" | "reject",',
        '      "enthusiasm": 0.0,',
        '      "concerns": ["string"],',
        '      "willingnessToAdopt": "string",',
        '      "rationale": "string"',
        '    }',
        '  ],',
        '  "opinionChanges": [',
        '    { "personaId": "p1", "fromPosition": "support_with_concerns", "toPosition": "pilot_first", "reason": "string" }',
        '  ],',
        '  "unresolvedObjections": ["string"],',
        '  "strongestSupportingArguments": ["string"],',
        '  "strongestOpposingArguments": ["string"],',
        '  "whatWouldChangeMinds": ["string"],',
        '  "consensusLevel": "strong" | "moderate" | "weak" | "split",',
        '  "confidenceScore": 0.0,',
        '  "decision": "buy" | "pilot" | "defer" | "reject",',
        '  "decisionRationale": "string",',
        '  "nextSteps": ["string"]',
        '}',
      ].join('\n'),
    },
  ];
}

export function insightsPrompt(
  personas: PersonaLabPersona[],
  transcripts: Array<InterviewTranscript | FocusGroupTranscript>,
): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: [
        'Extract insights from the following persona set and transcripts.',
        '',
        'Personas:',
        ...personas.map(personaBlock),
        '',
        'Transcripts (JSON):',
        JSON.stringify(transcripts).slice(0, 8000),
        '',
        'Produce JSON shaped like:',
        '{',
        '  "topPainPoints": ["string"],',
        '  "topBuyingTriggers": ["string"],',
        '  "topObjections": ["string"],',
        '  "recommendedPositioning": "string",',
        '  "riskFlags": ["string"],',
        '  "confidence": 0.0-1.0',
        '}',
      ].join('\n'),
    },
  ];
}
