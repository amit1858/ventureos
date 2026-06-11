import { describe, expect, it, vi } from 'vitest';

import {
  PersonaLab,
  evaluatePersonaSet,
  evaluateBuyingCommittee,
  PersonaLabParseError,
} from '../src/index';
import type {
  PersonaLabPersona,
  PersonaLabBrief,
  BuyingCommitteeDeliberation,
} from '../src/types';
import type { ChatRequest, ChatResponse } from '@ventureos/contracts';

const BRIEF: PersonaLabBrief = {
  businessIdea: 'Faceless CRM for SMB',
  targetMarket: 'Small and medium businesses',
  customerType: 'Owner-led sales teams',
  region: 'India',
  businessSize: '5 to 50 employees',
  additionalContext: 'B2B SaaS, monthly subscription',
};

function ok(content: unknown): ChatResponse {
  return {
    content: typeof content === 'string' ? content : JSON.stringify(content),
    finishReason: 'stop',
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    cost: { usd: 0.001, provider: 'openai', model: 'gpt-4o-mini' },
    cached: false,
  };
}

const baseOpts = {
  model: 'gpt-4o-mini',
  ctx: { tenantId: 't', traceId: 'tr' },
};

const FAKE_PERSONA_PAYLOAD = {
  personas: [
    {
      id: 'p1', name: 'Ravi Kumar', role: 'SMB Owner',
      businessContext: 'Runs a 12-person distribution business in Pune',
      goals: ['Grow revenue 30% YoY', 'Reduce CRM admin time'],
      painPoints: ['Manual lead tracking eats two hours per day across the team', 'Sales reps forget follow-ups'],
      motivations: ['Save time', 'Look professional to clients'],
      objections: ['Worried about data security', 'Hates long onboarding'],
      buyingTriggers: ['Sees a competitor close a deal he lost', 'End of fiscal year budget freeze'],
      decisionPower: 'high',
      quote: 'I just want a CRM that does not waste my reps time.',
      confidenceScore: 0.8,
      evidenceNotes: ['Pattern common to Indian SMB owners'],
    },
    {
      id: 'p2', name: 'Aditi Sharma', role: 'Sales Representative',
      businessContext: 'Inside sales rep at the same firm; handles 40 leads weekly',
      goals: ['Close more deals', 'Avoid double-entry into spreadsheets'],
      painPoints: ['Switches between WhatsApp, email, and a notebook to track leads daily'],
      motivations: ['Hit quota'],
      objections: ['Worried CRM will be used to micromanage her'],
      buyingTriggers: ['Manager mandates CRM use'],
      decisionPower: 'low',
      quote: 'If it adds five clicks per lead, I will not use it.',
      confidenceScore: 0.7,
      evidenceNotes: [],
    },
  ],
};

describe('PersonaLab.generatePersonas', () => {
  it('parses a well-formed JSON response into typed personas', async () => {
    const chat = vi.fn(async () => ok(FAKE_PERSONA_PAYLOAD));
    const lab = new PersonaLab(chat, baseOpts);
    const personas = await lab.generatePersonas({ brief: BRIEF, n: 2 });
    expect(personas).toHaveLength(2);
    expect(personas[0]?.role).toBe('SMB Owner');
    expect(personas[1]?.decisionPower).toBe('low');
    expect(chat).toHaveBeenCalledOnce();
    // Ensure no secret-looking field made it into the prompt.
    const sent = chat.mock.calls[0]?.[0] as ChatRequest;
    expect(JSON.stringify(sent)).not.toMatch(/sk-/);
  });

  it('tolerates ```json fences around the payload', async () => {
    const chat = vi.fn(async () => ok('```json\n' + JSON.stringify(FAKE_PERSONA_PAYLOAD) + '\n```'));
    const lab = new PersonaLab(chat, baseOpts);
    const personas = await lab.generatePersonas({ brief: BRIEF, n: 2 });
    expect(personas).toHaveLength(2);
  });

  it('throws PersonaLabParseError on non-JSON output', async () => {
    const chat = vi.fn(async () => ok('I am sorry, I cannot comply.'));
    const lab = new PersonaLab(chat, baseOpts);
    await expect(lab.generatePersonas({ brief: BRIEF })).rejects.toBeInstanceOf(PersonaLabParseError);
  });

  it('coerces missing fields to safe defaults', async () => {
    const chat = vi.fn(async () => ok({ personas: [{ name: 'X' }] }));
    const lab = new PersonaLab(chat, baseOpts);
    const personas = await lab.generatePersonas({ brief: BRIEF });
    expect(personas[0]?.id).toBe('p1');
    expect(personas[0]?.decisionPower).toBe('medium');
    expect(personas[0]?.confidenceScore).toBeGreaterThanOrEqual(0);
  });
});

describe('PersonaLab.runInterview', () => {
  it('parses turns and summary', async () => {
    const chat = vi.fn(async () =>
      ok({
        personaId: 'p1',
        topic: 'CRM frustrations',
        turns: [
          { speaker: 'interviewer', content: 'What is your biggest CRM frustration?' },
          { speaker: 'persona', content: 'Reps copy-paste into spreadsheets.' },
        ],
        summary: 'Owner is frustrated by manual workflows.',
      }),
    );
    const lab = new PersonaLab(chat, baseOpts);
    const t = await lab.runInterview({
      persona: FAKE_PERSONA_PAYLOAD.personas[0] as unknown as PersonaLabPersona,
      brief: BRIEF,
      topic: 'CRM frustrations',
      questions: ['What is your biggest CRM frustration?'],
    });
    expect(t.turns).toHaveLength(2);
    expect(t.summary).toMatch(/manual/i);
  });
});

describe('PersonaLab.runFocusGroup', () => {
  it('filters turns to known persona ids', async () => {
    const personas = FAKE_PERSONA_PAYLOAD.personas as unknown as PersonaLabPersona[];
    const chat = vi.fn(async () =>
      ok({
        topic: 'pricing',
        turns: [
          { speakerPersonaId: 'p1', content: 'Twenty dollars is fine.' },
          { speakerPersonaId: 'unknown', content: 'I am not part of this group.' },
          { speakerPersonaId: 'p2', content: 'Make sure exports are free.' },
        ],
        summary: 'Mixed views on pricing tiers.',
        agreements: ['Want a free trial'],
        disagreements: ['Annual vs monthly billing'],
      }),
    );
    const lab = new PersonaLab(chat, baseOpts);
    const fg = await lab.runFocusGroup({ personas, brief: BRIEF, topic: 'pricing' });
    expect(fg.turns).toHaveLength(2);
    expect(fg.participantIds).toEqual(['p1', 'p2']);
  });
});

describe('PersonaLab.runBuyingCommittee (phased deliberation)', () => {
  const personas = FAKE_PERSONA_PAYLOAD.personas as unknown as PersonaLabPersona[];

  // Helper: build a 4-phase mock that returns one payload per call, in order.
  function phasedChat(phases: [unknown, unknown, unknown, unknown]) {
    return vi
      .fn<(req: ChatRequest) => Promise<ChatResponse>>()
      .mockResolvedValueOnce(ok(phases[0]))
      .mockResolvedValueOnce(ok(phases[1]))
      .mockResolvedValueOnce(ok(phases[2]))
      .mockResolvedValueOnce(ok(phases[3]));
  }

  const PHASE1_DISAGREE = {
    initialPositions: [
      {
        personaId: 'p1', position: 'support', enthusiasm: 0.9,
        concerns: ['Need clear ROI proof within 90 days for the leadership review'],
        willingnessToAdopt: 'Will sign if the pilot proves out.', rationale: 'High decision power, sees revenue upside.',
      },
      {
        personaId: 'p2', position: 'reject', enthusiasm: 0.2,
        concerns: ['Adds five clicks per lead and slows down my daily flow'],
        willingnessToAdopt: 'Will refuse if it slows me down.', rationale: 'Sales rep fears micromanagement.',
      },
    ],
  };

  const PHASE2_CHALLENGES = {
    challenges: [
      {
        fromPersonaId: 'p1', toPersonaId: 'p2', topic: 'workflow',
        argument: 'You are assuming the new CRM adds clicks but the demo showed inline entry from WhatsApp which actually removes the spreadsheet duplication you do today.',
      },
      {
        fromPersonaId: 'p2', toPersonaId: 'p1', topic: 'roi',
        argument: 'You are projecting 90-day ROI but our last tool also promised that and we still cannot show pipeline improvement after six months in production.',
      },
    ],
  };

  const PHASE3_RESPONSES_WITH_CHANGE = {
    responses: [
      {
        fromPersonaId: 'p2', challengeIndex: 0,
        argument: 'Fair point — the WhatsApp inline entry actually removes my biggest pain. I am willing to pilot it.',
        changedOpinion: true,
      },
      {
        fromPersonaId: 'p1', challengeIndex: 1,
        argument: 'We will set a tighter ROI gate with pipeline velocity as the kill metric.',
        changedOpinion: false,
      },
    ],
  };

  const PHASE4_CONSENSUS_PILOT = {
    consensus: [
      {
        personaId: 'p1', position: 'support_with_concerns', enthusiasm: 0.8,
        concerns: ['Wants a 90-day kill metric on pipeline velocity'],
        willingnessToAdopt: 'Will fund a 90-day pilot.', rationale: 'Shifted slightly after seeing rep concerns.',
      },
      {
        personaId: 'p2', position: 'pilot_first', enthusiasm: 0.55,
        concerns: ['Wants a workflow walkthrough before rollout to the team'],
        willingnessToAdopt: 'Willing to trial it for 30 days.', rationale: 'Moved from reject after the WhatsApp clarification.',
      },
    ],
    opinionChanges: [
      { personaId: 'p2', fromPosition: 'reject', toPosition: 'pilot_first', reason: 'WhatsApp inline entry removed her biggest objection.' },
    ],
    unresolvedObjections: [
      'No agreed-upon ROI kill metric beyond pipeline velocity has been formalised',
    ],
    strongestSupportingArguments: [
      'Inline WhatsApp entry removes existing duplication',
    ],
    strongestOpposingArguments: [
      'Previous tools failed to demonstrate pipeline lift',
    ],
    whatWouldChangeMinds: [
      'A live pilot showing pipeline velocity lift inside 30 days',
    ],
    consensusLevel: 'weak',
    confidenceScore: 0.6,
    decision: 'pilot',
    decisionRationale: 'Both sides converged on a 30-day pilot with a defined kill metric.',
    nextSteps: ['Run a 30-day workflow pilot with pipeline velocity as the success metric'],
  };

  it('issues exactly four sequential chat calls (one per phase)', async () => {
    const chat = phasedChat([PHASE1_DISAGREE, PHASE2_CHALLENGES, PHASE3_RESPONSES_WITH_CHANGE, PHASE4_CONSENSUS_PILOT]);
    const lab = new PersonaLab(chat, baseOpts);
    await lab.runBuyingCommittee({ personas, brief: BRIEF, offerSummary: 'Pilot of CRM for 30 days, free.' });
    expect(chat).toHaveBeenCalledTimes(4);
  });

  it('captures genuine disagreement in the initial-positions phase', async () => {
    const chat = phasedChat([PHASE1_DISAGREE, PHASE2_CHALLENGES, PHASE3_RESPONSES_WITH_CHANGE, PHASE4_CONSENSUS_PILOT]);
    const lab = new PersonaLab(chat, baseOpts);
    const r = await lab.runBuyingCommittee({ personas, brief: BRIEF, offerSummary: 'Pilot of CRM for 30 days, free.' });
    const positions = new Set(r.deliberation!.phases.initialPositions.map((o) => o.position));
    expect(positions.size).toBeGreaterThanOrEqual(2);
    expect(positions.has('support')).toBe(true);
    expect(positions.has('reject')).toBe(true);
  });

  it('passes previous-phase output into the next phase prompt', async () => {
    const chat = phasedChat([PHASE1_DISAGREE, PHASE2_CHALLENGES, PHASE3_RESPONSES_WITH_CHANGE, PHASE4_CONSENSUS_PILOT]);
    const lab = new PersonaLab(chat, baseOpts);
    await lab.runBuyingCommittee({ personas, brief: BRIEF, offerSummary: 'Pilot of CRM for 30 days, free.' });
    // Phase 2 prompt must reference Phase 1's initial positions.
    const phase2Req = chat.mock.calls[1]?.[0] as ChatRequest;
    const phase2Body = JSON.stringify(phase2Req.messages);
    expect(phase2Body).toMatch(/position.{1,5}support/);
    expect(phase2Body).toMatch(/position.{1,5}reject/);
    // Phase 3 prompt must reference Phase 2's challenges.
    const phase3Body = JSON.stringify((chat.mock.calls[2]?.[0] as ChatRequest).messages);
    expect(phase3Body).toMatch(/inline entry from WhatsApp/);
    // Phase 4 prompt must reference Phase 3's responses.
    const phase4Body = JSON.stringify((chat.mock.calls[3]?.[0] as ChatRequest).messages);
    expect(phase4Body).toMatch(/willing to pilot it/);
  });

  it('tracks opinion changes across phases', async () => {
    const chat = phasedChat([PHASE1_DISAGREE, PHASE2_CHALLENGES, PHASE3_RESPONSES_WITH_CHANGE, PHASE4_CONSENSUS_PILOT]);
    const lab = new PersonaLab(chat, baseOpts);
    const r = await lab.runBuyingCommittee({ personas, brief: BRIEF, offerSummary: 'Pilot of CRM for 30 days, free.' });
    const changes = r.deliberation!.opinionChanges;
    expect(changes).toHaveLength(1);
    expect(changes[0]?.personaId).toBe('p2');
    expect(changes[0]?.fromPosition).toBe('reject');
    expect(changes[0]?.toPosition).toBe('pilot_first');
  });

  it('surfaces unresolved objections and what-would-change-minds in the final output', async () => {
    const chat = phasedChat([PHASE1_DISAGREE, PHASE2_CHALLENGES, PHASE3_RESPONSES_WITH_CHANGE, PHASE4_CONSENSUS_PILOT]);
    const lab = new PersonaLab(chat, baseOpts);
    const r = await lab.runBuyingCommittee({ personas, brief: BRIEF, offerSummary: 'Pilot of CRM for 30 days, free.' });
    expect(r.deliberation!.unresolvedObjections.length).toBeGreaterThan(0);
    expect(r.deliberation!.whatWouldChangeMinds.length).toBeGreaterThan(0);
    expect(r.deliberation!.strongestSupportingArguments.length).toBeGreaterThan(0);
    expect(r.deliberation!.strongestOpposingArguments.length).toBeGreaterThan(0);
  });

  it('decision comes from the consensus phase, not from member-stance keyword scoring', async () => {
    const chat = phasedChat([PHASE1_DISAGREE, PHASE2_CHALLENGES, PHASE3_RESPONSES_WITH_CHANGE, PHASE4_CONSENSUS_PILOT]);
    const lab = new PersonaLab(chat, baseOpts);
    const r = await lab.runBuyingCommittee({ personas, brief: BRIEF, offerSummary: 'Pilot of CRM for 30 days, free.' });
    expect(r.decision).toBe('pilot');
    expect(r.decisionRationale).toMatch(/30-day pilot/);
    expect(r.nextSteps[0]).toMatch(/pilot/);
  });

  it('back-compat: legacy members[] is derived from the final consensus', async () => {
    const chat = phasedChat([PHASE1_DISAGREE, PHASE2_CHALLENGES, PHASE3_RESPONSES_WITH_CHANGE, PHASE4_CONSENSUS_PILOT]);
    const lab = new PersonaLab(chat, baseOpts);
    const r = await lab.runBuyingCommittee({ personas, brief: BRIEF, offerSummary: 'Pilot of CRM for 30 days, free.' });
    expect(r.members).toHaveLength(2);
    const p1Member = r.members.find((m) => m.personaId === 'p1');
    const p2Member = r.members.find((m) => m.personaId === 'p2');
    // p1 final position: support_with_concerns → supporter
    expect(p1Member?.stance).toBe('supporter');
    // p2 final position: pilot_first → neutral
    expect(p2Member?.stance).toBe('neutral');
  });

  it('drops challenges and responses that reference unknown persona ids', async () => {
    const dirtyPhase2 = {
      challenges: [
        { fromPersonaId: 'p1', toPersonaId: 'ghost', topic: 'roi', argument: 'phantom challenge' },
        { fromPersonaId: 'p1', toPersonaId: 'p1', topic: 'roi', argument: 'self-challenge' },
        { fromPersonaId: 'p1', toPersonaId: 'p2', topic: 'workflow', argument: 'real challenge here' },
      ],
    };
    const chat = phasedChat([PHASE1_DISAGREE, dirtyPhase2, { responses: [] }, PHASE4_CONSENSUS_PILOT]);
    const lab = new PersonaLab(chat, baseOpts);
    const r = await lab.runBuyingCommittee({ personas, brief: BRIEF, offerSummary: 'Pilot.' });
    expect(r.deliberation!.phases.challenges).toHaveLength(1);
  });

  it('derives consensus level when the model omits it', async () => {
    const phase4NoLevel: Record<string, unknown> = { ...PHASE4_CONSENSUS_PILOT };
    delete phase4NoLevel['consensusLevel'];
    const chat = phasedChat([PHASE1_DISAGREE, PHASE2_CHALLENGES, PHASE3_RESPONSES_WITH_CHANGE, phase4NoLevel]);
    const lab = new PersonaLab(chat, baseOpts);
    const r = await lab.runBuyingCommittee({ personas, brief: BRIEF, offerSummary: 'Pilot.' });
    // Two distinct positions (support_with_concerns + pilot_first), 50/50 split → weak
    expect(r.deliberation!.consensusLevel).toBe('weak');
  });

  it('strong consensus when all participants align in the consensus phase', async () => {
    const phase4Strong = {
      consensus: [
        { personaId: 'p1', position: 'support', enthusiasm: 0.9, concerns: [], willingnessToAdopt: 'now', rationale: 'aligned' },
        { personaId: 'p2', position: 'support', enthusiasm: 0.8, concerns: [], willingnessToAdopt: 'now', rationale: 'aligned' },
      ],
      decision: 'buy', decisionRationale: 'Unanimous.', nextSteps: ['Sign'],
      consensusLevel: 'strong', confidenceScore: 0.9,
    };
    const chat = phasedChat([PHASE1_DISAGREE, PHASE2_CHALLENGES, PHASE3_RESPONSES_WITH_CHANGE, phase4Strong]);
    const lab = new PersonaLab(chat, baseOpts);
    const r = await lab.runBuyingCommittee({ personas, brief: BRIEF, offerSummary: 'Pilot.' });
    expect(r.deliberation!.consensusLevel).toBe('strong');
    expect(r.decision).toBe('buy');
  });
});

describe('evaluateBuyingCommittee', () => {
  const personas = FAKE_PERSONA_PAYLOAD.personas as unknown as PersonaLabPersona[];

  function makeDeliberation(overrides: Partial<BuyingCommitteeDeliberation> = {}): BuyingCommitteeDeliberation {
    return {
      phases: {
        initialPositions: [
          { personaId: 'p1', position: 'support', enthusiasm: 0.9, concerns: ['Concrete ROI question about the offer'], willingnessToAdopt: 'yes', rationale: 'high power' },
          { personaId: 'p2', position: 'reject', enthusiasm: 0.2, concerns: ['Slows down my daily workflow significantly'], willingnessToAdopt: 'no', rationale: 'fears micromanagement' },
        ],
        challenges: [
          { fromPersonaId: 'p1', toPersonaId: 'p2', topic: 'workflow', argument: 'The new CRM removes the spreadsheet duplication step you do every morning so it should actually save time rather than add clicks.' },
        ],
        responses: [
          { fromPersonaId: 'p2', challengeIndex: 0, argument: 'Fair point, I had not seen that.', changedOpinion: true },
        ],
        consensus: [
          { personaId: 'p1', position: 'support_with_concerns', enthusiasm: 0.8, concerns: ['Wants 90-day kill metric'], willingnessToAdopt: 'pilot', rationale: 'aligned' },
          { personaId: 'p2', position: 'pilot_first', enthusiasm: 0.55, concerns: ['Wants workflow walkthrough'], willingnessToAdopt: 'pilot', rationale: 'moved' },
        ],
      },
      opinionChanges: [
        { personaId: 'p2', fromPosition: 'reject', toPosition: 'pilot_first', reason: 'workflow clarified' },
      ],
      unresolvedObjections: ['ROI kill metric not yet defined formally'],
      strongestSupportingArguments: ['Removes spreadsheet duplication'],
      strongestOpposingArguments: ['Previous tools failed'],
      whatWouldChangeMinds: ['Live pilot showing pipeline lift'],
      consensusLevel: 'moderate',
      confidenceScore: 0.7,
      ...overrides,
    };
  }

  it('produces all scores in [0,1] and an overall score', () => {
    const e = evaluateBuyingCommittee(makeDeliberation());
    for (const s of [
      e.diversityOfViewpoints,
      e.challengeQuality,
      e.objectionQuality,
      e.opinionMovement,
      e.consensusStrength,
      e.overallScore,
    ]) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('rewards diverse starting positions', () => {
    const diverse = evaluateBuyingCommittee(makeDeliberation());
    const flat = evaluateBuyingCommittee(
      makeDeliberation({
        phases: {
          ...makeDeliberation().phases,
          initialPositions: [
            { personaId: 'p1', position: 'support', enthusiasm: 0.9, concerns: ['same concern shared'], willingnessToAdopt: 'yes', rationale: '' },
            { personaId: 'p2', position: 'support', enthusiasm: 0.9, concerns: ['same concern shared'], willingnessToAdopt: 'yes', rationale: '' },
          ],
        },
      }),
    );
    expect(diverse.diversityOfViewpoints).toBeGreaterThan(flat.diversityOfViewpoints);
  });

  it('warns when challenges have no responses', () => {
    const e = evaluateBuyingCommittee(
      makeDeliberation({
        phases: { ...makeDeliberation().phases, responses: [] },
      }),
    );
    expect(e.warnings.join('\n')).toMatch(/no responses/);
  });

  // Suppress unused-import lint by referencing the type.
  it('matches the BuyingCommitteeDeliberation contract shape', () => {
    const d = makeDeliberation();
    const _check: BuyingCommitteeDeliberation = d;
    expect(_check.phases.initialPositions.length).toBeGreaterThan(0);
  });
});

describe('PersonaLab.extractInsights', () => {
  it('clamps confidence and asStringArray-defaults missing fields', async () => {
    const chat = vi.fn(async () =>
      ok({
        topPainPoints: ['Manual entry'],
        topBuyingTriggers: ['Manager mandate'],
        recommendedPositioning: 'Faceless, time-saving CRM for SMB owners.',
        confidence: 5,
      }),
    );
    const lab = new PersonaLab(chat, baseOpts);
    const insights = await lab.extractInsights({
      personas: FAKE_PERSONA_PAYLOAD.personas as unknown as PersonaLabPersona[],
      transcripts: [],
    });
    expect(insights.confidence).toBe(1);
    expect(insights.topObjections).toEqual([]);
    expect(insights.riskFlags).toEqual([]);
  });
});

describe('evaluatePersonaSet', () => {
  const personas = FAKE_PERSONA_PAYLOAD.personas as unknown as PersonaLabPersona[];

  it('produces scores within [0,1]', () => {
    const r = evaluatePersonaSet(personas);
    for (const score of [
      r.diversityScore,
      r.consistencyScore,
      r.roleRealismScore,
      r.painPointSpecificityScore,
      r.buyingTriggerQualityScore,
      r.overallScore,
    ]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('flags contradictory decision power vs role title', () => {
    const cheaters: PersonaLabPersona[] = [
      { ...(personas[0] as PersonaLabPersona), id: 'a', decisionPower: 'low' },
      { ...(personas[1] as PersonaLabPersona), id: 'b', role: 'Junior Sales Intern', decisionPower: 'high' },
    ];
    const r = evaluatePersonaSet(cheaters);
    expect(r.contradictionCount).toBeGreaterThanOrEqual(2);
  });

  it('warns about missing fields', () => {
    const broken: PersonaLabPersona[] = [
      { ...(personas[0] as PersonaLabPersona), painPoints: [], buyingTriggers: [], quote: '' },
    ];
    const r = evaluatePersonaSet(broken);
    expect(r.warnings.join('\n')).toMatch(/no pain points/);
    expect(r.warnings.join('\n')).toMatch(/no buying triggers/);
  });
});

describe('PersonaLab provider safety', () => {
  it('does not include any secret-looking string in chat requests', async () => {
    const seen: ChatRequest[] = [];
    const chat = vi.fn(async (req: ChatRequest) => {
      seen.push(req);
      return ok(FAKE_PERSONA_PAYLOAD);
    });
    const lab = new PersonaLab(chat, baseOpts);
    await lab.generatePersonas({ brief: BRIEF });
    const dump = JSON.stringify(seen);
    expect(dump).not.toMatch(/sk-[A-Za-z0-9]{20,}/);
    expect(dump).not.toMatch(/Bearer /);
    expect(dump).not.toMatch(/api[_-]?key/i);
  });

  it('propagates provider failures', async () => {
    const chat = vi.fn(async () => { throw new Error('rate limit'); });
    const lab = new PersonaLab(chat, baseOpts);
    await expect(lab.generatePersonas({ brief: BRIEF })).rejects.toThrow(/rate limit/);
  });
});
