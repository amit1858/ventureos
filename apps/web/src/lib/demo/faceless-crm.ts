/**
 * Faceless CRM — the canonical Demo Mode venture.
 *
 * A complete, deterministic end-to-end snapshot: idea → personas → buying
 * committee → research graph → validation → build plan → evaluation → export.
 * No API keys, Supabase project or GitHub token are required to view it.
 *
 * The numbers in `summary` are asserted against the real scoring engine
 * (`calculateVentureReadiness` / `calculateVentureProgress`) in
 * `tests/demo-faceless-crm.test.ts`, so this fixture cannot silently drift.
 */
import type {
  BuildSquadArtifactPack,
  BuyingCommitteeTranscript,
  GitHubRepoArtifactPayload,
  IdeaBrief,
  PersonaLabPersona,
  ResearchGraph,
  Venture,
  VentureArtifact,
  VentureRecommendation,
  VentureSummary,
  VentureTimelineEvent,
} from '@foundry/contracts';

import type { DemoVenture } from './types';

const OWNER = 'demo-user';
const VENTURE_ID = 'demo-faceless-crm';
const REC_ID = 'rec_demo_faceless_crm';
const GRAPH_ID = 'graph_demo_faceless_crm';
const PERSONA_SET_ID = 'art_demo_personas';

const brief: IdeaBrief = {
  kind: 'IdeaBrief',
  title: 'Faceless CRM for SMB',
  summary:
    'A CRM for small and mid-sized businesses that runs without a sales team. ' +
    'Relationship hygiene, follow-ups, deal-stage advancement and pipeline ' +
    'reporting are all driven by AI agents working from the inbox and calendar. ' +
    'The owner reviews and approves; the CRM does the work.',
  targetMarket: 'SMB owner-operators and 1–10 person revenue teams in services and prosumer software',
  wedge:
    "Replace 'CRM hygiene' (the part nobody does) with autonomous agents that " +
    'keep records clean and proactively act on the pipeline.',
  businessModelHypothesis: '$29/seat/mo solo · $79/seat/mo team SaaS',
  founderAssumptions: [
    'SMBs want to spend zero time on CRM data entry.',
    'SMBs trust AI to draft follow-ups if they can approve before send.',
    'Incumbents (HubSpot, Pipedrive, Salesforce SMB) are too heavy and too manual.',
    "There is a non-trivial 'CRM grave' market — businesses that bought CRM and abandoned it.",
  ],
  tags: ['B2B SaaS', 'SMB', 'CRM', 'agentic'],
};

const venture: Venture = {
  kind: 'Venture',
  ventureId: VENTURE_ID,
  ownerId: OWNER,
  title: 'Faceless CRM for SMB',
  description:
    'An AI-run CRM that keeps itself clean and advances the pipeline from the ' +
    'inbox — built for owner-operators who bought a CRM and abandoned it.',
  problemStatement:
    'Owner-operators pay for CRMs they never update; follow-ups slip and ' +
    'winnable deals decay because the person who sells is also the person who delivers.',
  targetMarket: 'SMB owner-operators in services, consulting and prosumer SaaS',
  customerType: 'B2B',
  region: 'US / EU',
  businessSize: '1–10 employees',
  status: 'building',
  createdAt: '2025-05-12T09:00:00.000Z',
  updatedAt: '2025-05-12T09:42:00.000Z',
};

// ──────────── Personas (PersonaLab) ────────────────────────────────────────

const personas: PersonaLabPersona[] = [
  {
    id: 'p_maya',
    name: 'Maya Okafor',
    role: 'Independent brand consultant',
    businessContext: 'Solo consultant, 6 years independent, Brooklyn NY. Runs everything from Gmail.',
    goals: [
      'Never lose a warm lead to a forgotten follow-up.',
      'Spend zero evenings on admin.',
      'Keep client relationships warm without a "system".',
    ],
    painPoints: [
      'Loses the thread of 40+ active client conversations.',
      'Bounced off HubSpot and Pipedrive after a week each.',
      'Manual data entry eats ~30 minutes a day.',
    ],
    motivations: ['Protect revenue', 'Look responsive and professional', 'Reclaim time'],
    objections: ['"I refuse to fill in another form."', '"Will it email clients without me seeing it?"'],
    buyingTriggers: ['Lost a $12k retainer because she forgot to follow up.'],
    decisionPower: 'high',
    quote: 'CRM is where my leads go to die. I want something that just does the chasing for me.',
    confidenceScore: 0.86,
    evidenceNotes: ['Self-pay, decides in <1 hour', 'Already uses ChatGPT daily', 'Ceiling ~$50/mo'],
  },
  {
    id: 'p_diego',
    name: 'Diego Marín',
    role: 'Owner, 4-person AI marketing agency',
    businessContext: 'Austin TX. Team of four. Tried to run a CRM out of Airtable.',
    goals: ['Make pipeline reviews real, not fiction', 'Stop deals slipping between team members'],
    painPoints: ['Airtable CRM rotted', 'Team forgets to log calls', 'No single source of truth'],
    motivations: ['Forecast accuracy', 'Team accountability', 'Grow without hiring an ops person'],
    objections: ['"I need a data-residency story for client emails."', '"Per-seat pricing adds up fast."'],
    buyingTriggers: ['Blew a quarterly forecast because three deals were invisible.'],
    decisionPower: 'high',
    quote: "If it keeps the pipeline honest without my team touching it, I'll pay per seat tomorrow.",
    confidenceScore: 0.78,
    evidenceNotes: ['Decides for team', 'Comfortable at $200–$400/mo total', 'Needs SSO eventually'],
  },
  {
    id: 'p_priya',
    name: 'Priya Raman',
    role: 'Freelance technical writer',
    businessContext: 'Bengaluru IN. 3 years independent. Lives in Gmail + Docs.',
    goals: ['Get gentle reminders', 'Avoid "software"'],
    painPoints: ["Doesn't believe she has a 'sales process'", 'Just wants nudges, not a dashboard'],
    motivations: ['Low effort', 'Privacy'],
    objections: [
      "\"I don't trust an LLM to read my inbox, even in my own tenant.\"",
      '"My emails must never be used for model training."',
    ],
    buyingTriggers: ['Would switch only if a peer she trusts vouches for the privacy model.'],
    decisionPower: 'medium',
    quote: 'I want reminders, not another tool — and I really do not want my inbox feeding a model.',
    confidenceScore: 0.44,
    evidenceNotes: ['Self-pay, ceiling ~$15/mo', 'Privacy-first', 'Represents the skeptic edge of the market'],
  },
  {
    id: 'p_sam',
    name: 'Sam Whitfield',
    role: 'Fractional VP Sales (3 SMB clients)',
    businessContext: 'Works across three small B2B companies; introduces tools as a consultant.',
    goals: ['Standardise follow-up across clients', 'Show ROI fast to renew engagements'],
    painPoints: ['Re-builds the same spreadsheet process at every client', 'No leverage between accounts'],
    motivations: ['Repeatable playbook', 'Visible wins', 'Referral pipeline'],
    objections: ['"I need to trust the AI before I stake my name on it with a client."'],
    buyingTriggers: ['A tool that makes a client say "where did all these follow-ups come from?" in week one.'],
    decisionPower: 'high',
    quote: 'I influence what three companies buy. Make me look good in week one and I bring you all of them.',
    confidenceScore: 0.81,
    evidenceNotes: ['Channel/influence persona', 'Cares about time-to-value', 'High lifetime value if won'],
  },
  {
    id: 'p_nadia',
    name: 'Nadia Petrova',
    role: 'Operations manager at a 9-person studio',
    businessContext: 'Gatekeeper for new tools; owns the "do we really need this?" decision.',
    goals: ['Avoid tool sprawl', 'Make sure anything new is auditable'],
    painPoints: ['Owner keeps buying tools nobody adopts', 'No audit trail when something goes wrong'],
    motivations: ['Control', 'Compliance', 'Predictable cost'],
    objections: [
      '"If the AI sends something wrong under our name, who is accountable?"',
      '"Show me the log of every action."',
    ],
    buyingTriggers: ['A complete, replayable audit log of every AI action.'],
    decisionPower: 'medium',
    quote: 'I will block anything I can\u2019t audit. Show me the log of every action and we can talk.',
    confidenceScore: 0.62,
    evidenceNotes: ['Classic blocker role', 'Auditability is the unlock', 'Speaks for risk/compliance'],
  },
];

// ──────────── Buying committee (PersonaLab — agentic deliberation) ──────────

const committee: BuyingCommitteeTranscript = {
  offerSummary:
    'Faceless CRM: an AI-run CRM that captures contacts and deals from your inbox with zero forms, ' +
    'drafts every follow-up for one-click approval, and logs every action to a replayable audit trail. ' +
    'BYOK — your key, your tenant. $29/mo solo, $79/seat team.',
  members: [
    {
      personaId: 'p_maya',
      committeeRole: 'Champion / economic buyer',
      stance: 'champion',
      rationale: 'Feels the follow-up pain daily and already trusts AI for drafting.',
      blockingObjections: [],
    },
    {
      personaId: 'p_sam',
      committeeRole: 'Influencer (channel)',
      stance: 'supporter',
      rationale: 'Sees a repeatable playbook across his three clients if time-to-value is real.',
      blockingObjections: ['Needs a credible week-one win to stake his reputation.'],
    },
    {
      personaId: 'p_diego',
      committeeRole: 'Economic buyer (team)',
      stance: 'supporter',
      rationale: 'Wants honest pipeline; fine with per-seat if the team never has to log calls.',
      blockingObjections: ['Data-residency story for client emails.'],
    },
    {
      personaId: 'p_nadia',
      committeeRole: 'Blocker (ops / compliance)',
      stance: 'blocker',
      rationale: 'Will not approve anything without an audit trail and clear accountability.',
      blockingObjections: ['Replayable audit log', 'Accountability for wrong sends'],
    },
    {
      personaId: 'p_priya',
      committeeRole: 'Skeptic (end user edge)',
      stance: 'skeptic',
      rationale: 'Distrusts inbox access on principle; represents the privacy-sensitive tail.',
      blockingObjections: ['Inbox privacy', 'No training on her data'],
    },
  ],
  decision: 'pilot',
  decisionRationale:
    'Strong champion pull and clear willingness-to-pay, but the blocker’s audit/accountability ' +
    'requirement and the skeptic’s privacy concern must be retired first. The committee converges on a ' +
    'paid pilot gated on a human-approval inbox and a replayable audit log.',
  nextSteps: [
    'Ship human-approval inbox + replayable audit log before general availability.',
    'Publish a "your tenant, your key, no training" trust page.',
    'Run a 5-design-partner paid pilot with written BYOK acceptance.',
  ],
  deliberation: {
    phases: {
      initialPositions: [
        {
          personaId: 'p_maya',
          position: 'support',
          enthusiasm: 0.9,
          concerns: ['Must see every email before it sends.'],
          willingnessToAdopt: 'Would switch this week and cancel HubSpot.',
          rationale: 'This is the only feature she actually wants: the chasing, done for her.',
        },
        {
          personaId: 'p_sam',
          position: 'support_with_concerns',
          enthusiasm: 0.72,
          concerns: ['Time-to-value must be days, not weeks.'],
          willingnessToAdopt: 'Will pilot at one client, then roll to three if week-one lands.',
          rationale: 'A repeatable follow-up engine is leverage across his portfolio.',
        },
        {
          personaId: 'p_diego',
          position: 'support_with_concerns',
          enthusiasm: 0.66,
          concerns: ['Data residency for client emails', 'Per-seat cost at team scale'],
          willingnessToAdopt: 'Team tier if the team never has to log a call.',
          rationale: 'Honest pipeline without behaviour change is the dream.',
        },
        {
          personaId: 'p_nadia',
          position: 'reject',
          enthusiasm: 0.3,
          concerns: ['No audit trail = no approval', 'Unclear accountability for bad sends'],
          willingnessToAdopt: 'Blocks until auditability exists.',
          rationale: 'Owns the "do we really need this, and is it safe?" gate.',
        },
        {
          personaId: 'p_priya',
          position: 'reject',
          enthusiasm: 0.2,
          concerns: ['Inbox privacy', 'Training on her data'],
          willingnessToAdopt: 'Out unless privacy is provably airtight.',
          rationale: 'Distrusts inbox-reading AI on principle.',
        },
      ],
      challenges: [
        {
          fromPersonaId: 'p_nadia',
          toPersonaId: 'p_maya',
          topic: 'trust',
          argument:
            'You love the auto-drafts, but if the AI sends the wrong thing under your name, who is accountable and how do we prove what happened?',
        },
        {
          fromPersonaId: 'p_priya',
          toPersonaId: 'p_diego',
          topic: 'trust',
          argument:
            'You want it reading the whole team\u2019s inbox. How is that not a privacy and training-data nightmare for client emails?',
        },
        {
          fromPersonaId: 'p_diego',
          toPersonaId: 'p_maya',
          topic: 'pricing',
          argument:
            'Solo at $29 is easy. At team scale per-seat gets expensive fast — does the value hold for a 4-person team?',
        },
        {
          fromPersonaId: 'p_sam',
          toPersonaId: 'p_nadia',
          topic: 'workflow',
          argument:
            'If every send is human-approved and every action is logged and replayable, does that retire your accountability objection?',
        },
      ],
      responses: [
        {
          fromPersonaId: 'p_maya',
          challengeIndex: 0,
          argument:
            'Agreed — I never want it to send unapproved. A one-click approval inbox plus a log of every action actually makes me more comfortable, not less.',
          changedOpinion: false,
        },
        {
          fromPersonaId: 'p_diego',
          challengeIndex: 1,
          argument:
            'Fair. BYOK in our own tenant with an explicit "no training on your data" guarantee is exactly the residency story I need to bring this in.',
          changedOpinion: false,
        },
        {
          fromPersonaId: 'p_maya',
          challengeIndex: 2,
          argument:
            'For a team it should be priced on outcomes, but even per-seat pays for itself the first time it saves a deal everyone forgot about.',
          changedOpinion: false,
        },
        {
          fromPersonaId: 'p_nadia',
          challengeIndex: 3,
          argument:
            'A replayable audit log plus mandatory human approval is most of what I need. Give me that and I move from block to a gated pilot.',
          changedOpinion: true,
        },
      ],
      consensus: [
        {
          personaId: 'p_maya',
          position: 'support',
          enthusiasm: 0.92,
          concerns: [],
          willingnessToAdopt: 'Adopts immediately at GA.',
          rationale: 'Approval inbox removes her only worry.',
        },
        {
          personaId: 'p_sam',
          position: 'support',
          enthusiasm: 0.8,
          concerns: ['Wants a week-one win metric.'],
          willingnessToAdopt: 'Pilots now, expands to three clients on success.',
          rationale: 'Audit + approval makes it safe to put his name on.',
        },
        {
          personaId: 'p_diego',
          position: 'support_with_concerns',
          enthusiasm: 0.74,
          concerns: ['Team pricing clarity'],
          willingnessToAdopt: 'Team pilot with BYOK in own tenant.',
          rationale: 'Residency story satisfied; pricing to be validated.',
        },
        {
          personaId: 'p_nadia',
          position: 'pilot_first',
          enthusiasm: 0.58,
          concerns: ['Wants to inspect the audit log in the pilot.'],
          willingnessToAdopt: 'Approves a gated pilot.',
          rationale: 'Auditability moved her off a hard block.',
        },
        {
          personaId: 'p_priya',
          position: 'reject',
          enthusiasm: 0.25,
          concerns: ['Still uncomfortable with inbox access.'],
          willingnessToAdopt: 'Stays out for now.',
          rationale: 'Represents the privacy tail the wedge intentionally does not chase first.',
        },
      ],
    },
    opinionChanges: [
      {
        personaId: 'p_nadia',
        fromPosition: 'reject',
        toPosition: 'pilot_first',
        reason: 'Replayable audit log + mandatory human approval retired the accountability objection.',
      },
    ],
    unresolvedObjections: [
      'Privacy-sensitive users (Priya) will not grant inbox access regardless of guarantees.',
      'Team per-seat pricing is unproven at 4+ seats.',
    ],
    strongestSupportingArguments: [
      'The follow-up pain is daily and universally felt by owner-operators.',
      'Human-approval inbox turns the scariest feature into the most reassuring one.',
      'BYOK in the customer’s own tenant is a credible, differentiated trust story.',
    ],
    strongestOpposingArguments: [
      'Inbox access is a hard no for the privacy tail.',
      'Per-seat economics may not hold for small teams.',
    ],
    whatWouldChangeMinds: [
      'A live, inspectable audit log during the pilot.',
      'A published "no training on your data" guarantee.',
      'A week-one quantified win (deals revived / time saved).',
    ],
    consensusLevel: 'moderate',
    confidenceScore: 0.82,
  },
};

// ──────────── Research graph (VentureLab / Graphify) ────────────────────────

const research: ResearchGraph = {
  kind: 'ResearchGraph',
  graphId: GRAPH_ID,
  ventureId: VENTURE_ID,
  createdAt: '2025-05-12T09:08:00.000Z',
  stats: {
    nodes: 13,
    edges: 15,
    communities: 5,
    confidence: { EXTRACTED: 0.61, INFERRED: 0.37, AMBIGUOUS: 0.02 },
  },
  godNodes: [
    { label: 'Replace, don’t augment, the abandoned CRM', degree: 9, community: 1 },
    { label: 'HubSpot Free / Starter', degree: 7, community: 2 },
    { label: 'CRM hygiene is universally undone', degree: 6, community: 1 },
    { label: 'Autonomous follow-up drafting', degree: 6, community: 3 },
    { label: 'Solo owner-operators (services/consulting)', degree: 5, community: 4 },
  ],
  surprisingConnections: [
    'Spreadsheet-in-the-inbox ↔ "why we abandoned HubSpot" ↔ zero-forms wedge',
    'GDPR/CAN-SPAM consent ↔ AI-drafted outreach ↔ deliverability + reputation risk',
  ],
  contradictions: [
    'AI inbox autonomy ↔ trust & privacy concern',
    "HubSpot Free is 'good enough' ↔ high CRM abandonment rate",
  ],
  evidenceUri: 'demo://ventures/faceless-crm/research/graph.json',
  sources: [
    { id: 's1', kind: 'web', label: 'G2 reviews — HubSpot CRM (SMB)', uri: 'demo://g2/hubspot', excerpt: '“Powerful but we never kept it up to date.”', addedAt: '2025-05-12T09:02:00.000Z' },
    { id: 's2', kind: 'web', label: 'Reddit r/smallbusiness — "abandoned my CRM"', uri: 'demo://reddit/smallbusiness', excerpt: '“Bought it, used it for a month, back to my inbox.”', addedAt: '2025-05-12T09:03:00.000Z' },
    { id: 's3', kind: 'interview', label: 'Interview — Maya (solo consultant)', excerpt: '“CRM is where my leads go to die.”', addedAt: '2025-05-12T09:04:00.000Z' },
    { id: 's4', kind: 'web', label: 'Capterra — Pipedrive SMB reviews', uri: 'demo://capterra/pipedrive', excerpt: '“Too much manual stage-moving.”', addedAt: '2025-05-12T09:05:00.000Z' },
    { id: 's5', kind: 'persona_set', label: 'PersonaLab persona set v1', excerpt: 'Owner-operator archetypes and objections.', addedAt: '2025-05-12T09:06:00.000Z' },
    { id: 's6', kind: 'web', label: 'CAN-SPAM / GDPR outbound guidance', uri: 'demo://gov/can-spam', excerpt: 'Consent + opt-out requirements for outbound email.', addedAt: '2025-05-12T09:07:00.000Z' },
  ],
  nodes: [
    { id: 'n_pain_hygiene', type: 'problem', label: 'CRM hygiene is universally undone', summary: 'Owner-operators rarely keep records current.', confidence: 0.82, evidence: ['“we never kept it up to date”'], provenance: { sourceIds: ['s1', 's2'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.9 },
    { id: 'n_pain_followup', type: 'problem', label: 'Missed follow-ups lose winnable deals', confidence: 0.8, evidence: ['“lost a $12k retainer because I forgot to follow up”'], provenance: { sourceIds: ['s3', 's5'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.85 },
    { id: 'n_seg_solo', type: 'segment', label: 'Solo owner-operators (services/consulting)', confidence: 0.74, evidence: ['Self-pay, decide in <1 hour'], provenance: { sourceIds: ['s5'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.7 },
    { id: 'n_seg_agency', type: 'segment', label: 'Small agencies (2–10 people)', confidence: 0.66, evidence: ['Team forgets to log calls'], provenance: { sourceIds: ['s5'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.6 },
    { id: 'n_comp_hubspot', type: 'competitor', label: 'HubSpot Free / Starter', summary: 'Sticky free tier; the real retention moat.', confidence: 0.78, evidence: ['“Powerful but we never kept it up to date.”'], provenance: { sourceIds: ['s1'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.8 },
    { id: 'n_comp_pipedrive', type: 'competitor', label: 'Pipedrive', confidence: 0.7, evidence: ['“Too much manual stage-moving.”'], provenance: { sourceIds: ['s4'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.6 },
    { id: 'n_comp_attio', type: 'competitor', label: 'Attio (modern CRM)', confidence: 0.6, evidence: ['Data-app framing, still manual'], provenance: { sourceIds: ['s4'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.45 },
    { id: 'n_alt_spreadsheet', type: 'alternative', label: 'Spreadsheet + inbox', summary: 'The status-quo "system" most owner-operators relapse to.', confidence: 0.72, evidence: ['“back to my inbox”'], provenance: { sourceIds: ['s2'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.65 },
    { id: 'n_feat_autofollow', type: 'feature', label: 'Autonomous follow-up drafting', confidence: 0.76, evidence: ['“do the chasing for me”'], provenance: { sourceIds: ['s3'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.85 },
    { id: 'n_feat_zeroforms', type: 'feature', label: 'Zero-forms data capture', confidence: 0.74, evidence: ['“I refuse to fill in another form”'], provenance: { sourceIds: ['s3', 's5'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.78 },
    { id: 'n_risk_trust', type: 'risk', label: 'AI inbox-access trust barrier', summary: 'Privacy + accountability concerns gate adoption.', confidence: 0.69, evidence: ['“I don’t trust an LLM to read my inbox”'], provenance: { sourceIds: ['s5', 's6'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.7 },
    { id: 'n_market_grave', type: 'market_signal', label: "CRM abandonment ('CRM grave')", confidence: 0.58, evidence: ['“used it for a month, back to my inbox”'], provenance: { sourceIds: ['s2'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.6 },
    { id: 'n_opp_replace', type: 'opportunity', label: 'Replace, don’t augment, the abandoned CRM', summary: 'Wedge: kill HubSpot, do the hygiene for them.', confidence: 0.71, evidence: ['Migrate-and-replace, not add-on'], provenance: { sourceIds: ['s1', 's2', 's3'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' }, weight: 0.95 },
  ],
  edges: [
    { id: 'e1', from: 'n_seg_solo', to: 'n_pain_hygiene', type: 'experiences', confidence: 0.8, evidence: ['Owner-operators skip hygiene'], provenance: { sourceIds: ['s5'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e2', from: 'n_seg_solo', to: 'n_pain_followup', type: 'experiences', confidence: 0.82, evidence: ['Follow-ups slip'], provenance: { sourceIds: ['s3'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e3', from: 'n_seg_agency', to: 'n_pain_hygiene', type: 'experiences', confidence: 0.7, evidence: ['Team forgets to log'], provenance: { sourceIds: ['s5'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e4', from: 'n_pain_hygiene', to: 'n_feat_zeroforms', type: 'needs', confidence: 0.75, evidence: ['No forms => no relapse'], provenance: { sourceIds: ['s3'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e5', from: 'n_pain_followup', to: 'n_feat_autofollow', type: 'needs', confidence: 0.8, evidence: ['Auto-chase the pipeline'], provenance: { sourceIds: ['s3'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e6', from: 'n_comp_hubspot', to: 'n_opp_replace', type: 'competes_with', confidence: 0.72, evidence: ['Incumbent to displace'], provenance: { sourceIds: ['s1'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e7', from: 'n_comp_pipedrive', to: 'n_opp_replace', type: 'competes_with', confidence: 0.64, evidence: ['Manual incumbent'], provenance: { sourceIds: ['s4'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e8', from: 'n_alt_spreadsheet', to: 'n_comp_hubspot', type: 'substitutes', confidence: 0.6, evidence: ['Relapse target'], provenance: { sourceIds: ['s2'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e9', from: 'n_feat_autofollow', to: 'n_opp_replace', type: 'enables', confidence: 0.78, evidence: ['Core wedge capability'], provenance: { sourceIds: ['s3'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e10', from: 'n_feat_zeroforms', to: 'n_opp_replace', type: 'enables', confidence: 0.76, evidence: ['Removes the abandonment cause'], provenance: { sourceIds: ['s3'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e11', from: 'n_risk_trust', to: 'n_feat_autofollow', type: 'blocks', confidence: 0.66, evidence: ['Trust gates autonomy'], provenance: { sourceIds: ['s5'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e12', from: 'n_market_grave', to: 'n_opp_replace', type: 'validates', confidence: 0.6, evidence: ['Abandonment proves the gap'], provenance: { sourceIds: ['s2'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e13', from: 'n_comp_attio', to: 'n_seg_agency', type: 'influences', confidence: 0.5, evidence: ['Agencies eye modern CRMs'], provenance: { sourceIds: ['s4'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e14', from: 'n_risk_trust', to: 'n_feat_autofollow', type: 'contradicts', confidence: 0.55, evidence: ['Autonomy vs privacy'], provenance: { sourceIds: ['s5', 's6'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
    { id: 'e15', from: 'n_alt_spreadsheet', to: 'n_opp_replace', type: 'competes_with', confidence: 0.52, evidence: ['Status-quo to beat'], provenance: { sourceIds: ['s2'], extractor: 'llm', extractedAt: '2025-05-12T09:08:00.000Z' } },
  ],
};

// ──────────── Venture recommendation (VentureLab) ───────────────────────────

const recommendation: VentureRecommendation = {
  kind: 'VentureRecommendation',
  recommendationId: REC_ID,
  ventureId: VENTURE_ID,
  createdAt: '2025-05-12T09:20:00.000Z',
  decision: 'PROCEED',
  overallScore: 74,
  confidenceScore: 0.82,
  executiveSummary:
    'Strong, daily-felt problem and a genuinely differentiated "zero-forms, it does the chasing" wedge, ' +
    'with a clear champion and credible willingness-to-pay among solo owner-operators. The adoption-trust ' +
    'barrier is real but addressable: a human-approval inbox plus a replayable audit log convert the ' +
    'scariest feature into the most reassuring one. Proceed, anchoring v1 on Gmail-first solo consultants ' +
    'and leading with "your tenant, your key, no training".',
  scores: [
    { dimension: 'problemStrength', score: 84, higherIsBetter: true, explanation: 'Follow-up + hygiene pain is universal and recurring across personas.', supportingEvidence: [{ kind: 'persona', source: 'p_maya.painPoints', quote: 'Manual data entry eats ~30 minutes a day.', weight: 0.9, confidence: 'high' }], opposingEvidence: [] },
    { dimension: 'buyerUrgency', score: 71, higherIsBetter: true, explanation: 'Lost-revenue triggers cited, though no contractual deadline.', supportingEvidence: [{ kind: 'persona', source: 'p_maya.buyingTriggers', quote: 'Lost a $12k retainer because she forgot to follow up.', weight: 0.85, confidence: 'high' }], opposingEvidence: [] },
    { dimension: 'willingnessToPay', score: 64, higherIsBetter: true, explanation: 'Solo ceiling ~$30–$50/mo; team buyer accepts a $79 seat tier.', supportingEvidence: [{ kind: 'committee', source: 'deliberation.consensus', quote: 'Team tier if the team never has to log a call.', weight: 0.7, confidence: 'medium' }], opposingEvidence: [{ kind: 'persona', source: 'p_priya.objections', quote: 'Ceiling ~$15/mo.', weight: 0.4, confidence: 'medium' }] },
    { dimension: 'differentiation', score: 80, higherIsBetter: true, explanation: "'Zero forms, it does the chasing' is novel versus HubSpot/Pipedrive.", supportingEvidence: [{ kind: 'note', source: 'graph:n_opp_replace', quote: 'Replace, don’t augment, the abandoned CRM.', weight: 0.8, confidence: 'high' }], opposingEvidence: [] },
    { dimension: 'committeeConfidence', score: 68, higherIsBetter: true, explanation: 'Pilot with conditions; blocker moved off a hard no once auditability was on the table.', supportingEvidence: [{ kind: 'committee', source: 'deliberation.opinionChanges', quote: 'Audit log + approval moved the blocker to pilot.', weight: 0.7, confidence: 'medium' }], opposingEvidence: [] },
    { dimension: 'marketClarity', score: 66, higherIsBetter: true, explanation: 'Gmail-first solo consultants is a crisp wedge; Outlook gap deferred.', supportingEvidence: [{ kind: 'note', source: 'graph:n_seg_solo', quote: 'Solo owner-operators decide fast and self-pay.', weight: 0.6, confidence: 'medium' }], opposingEvidence: [] },
    { dimension: 'adoptionFriction', score: 58, higherIsBetter: false, explanation: 'BYOK + inbox-read is a high-trust posture, mitigated by approval + audit.', supportingEvidence: [{ kind: 'persona', source: 'p_nadia.objections', quote: 'Show me the log of every action.', weight: 0.6, confidence: 'medium' }], opposingEvidence: [] },
    { dimension: 'executionRisk', score: 52, higherIsBetter: false, explanation: 'Deliverability/sender-reputation and Gmail-only coverage are the main execution risks.', supportingEvidence: [{ kind: 'note', source: 'graph:n_risk_trust', quote: 'Trust gates autonomy.', weight: 0.6, confidence: 'medium' }], opposingEvidence: [] },
  ],
  evidence: [
    { kind: 'persona', source: 'p_maya.painPoints', quote: 'CRM is where my leads go to die.', weight: 0.9, confidence: 'high' },
    { kind: 'persona', source: 'p_maya.buyingTriggers', quote: 'Lost a $12k retainer because she forgot to follow up.', weight: 0.85, confidence: 'high' },
    { kind: 'committee', source: 'deliberation.consensus', quote: 'Approval inbox removes her only worry.', weight: 0.7, confidence: 'medium' },
    { kind: 'note', source: 'graph:n_market_grave', quote: 'Used it for a month, back to my inbox.', weight: 0.6, confidence: 'medium' },
  ],
  counterSignals: [
    { kind: 'persona', source: 'p_priya.objections', quote: 'I don’t trust an LLM to read my inbox, even in my own tenant.', weight: 0.7, confidence: 'medium' },
    { kind: 'committee', source: 'deliberation.unresolvedObjections', quote: 'Per-seat economics are unproven at 4+ seats.', weight: 0.55, confidence: 'medium' },
  ],
  assumptions: [
    { id: 'a1', text: 'Owner-operators will grant inbox access if the key stays in their tenant and every send is approved.', type: 'risky', confidence: 'low', evidence: [{ kind: 'committee', source: 'deliberation.whatWouldChangeMinds', quote: 'A live, inspectable audit log during the pilot.', weight: 0.6, confidence: 'medium' }], riskLevel: 'high', validationStrategy: '5 design partners sign written BYOK + inbox-access acceptance before GA.' },
    { id: 'a2', text: 'Pricing at $29 solo / $79 team removes the "do I need this?" objection.', type: 'explicit', confidence: 'medium', evidence: [], riskLevel: 'medium', validationStrategy: 'Smoke-test a two-price landing page; measure click-through to checkout.' },
    { id: 'a3', text: 'Gmail + Calendar coverage addresses ≥80% of the initial wedge market.', type: 'implicit', confidence: 'low', evidence: [], riskLevel: 'high', validationStrategy: 'Survey 50 design-partner prospects on email platform mix.' },
  ],
  risks: [
    { id: 'r1', risk: 'BYOK + inbox-read posture suppresses trial-to-paid conversion.', impact: 'high', likelihood: 'medium', mitigation: 'Lead with "your tenant, your key, no training"; ship approval inbox + audit log day one.', relatedAssumptionIds: ['a1'], relatedDimension: 'adoptionFriction' },
    { id: 'r2', risk: 'HubSpot Free is sticky and free — incumbent retention is the real moat.', impact: 'medium', likelihood: 'high', mitigation: 'Position against effort, not features: "0 fields to fill" and a one-click "kill HubSpot" migration.', relatedDimension: 'differentiation' },
    { id: 'r3', risk: 'Gmail-only coverage excludes ~25% of SMB (Outlook) in year one.', impact: 'medium', likelihood: 'high', mitigation: 'Narrow ICP to Gmail-first solos in v1; ship Outlook by month 6.', relatedAssumptionIds: ['a3'], relatedDimension: 'marketClarity' },
    { id: 'r4', risk: 'AI-drafted outbound harms sender reputation / deliverability.', impact: 'high', likelihood: 'low', mitigation: 'Human approval on every send; per-domain warm-up; strict opt-out hygiene (CAN-SPAM/GDPR).', relatedDimension: 'executionRisk' },
  ],
  nextSteps: [
    { id: 'n1', title: 'Sign 5 Gmail-first solo design partners with written BYOK + inbox acceptance', category: 'user_research', priority: 1, rationale: 'Validates the riskiest assumption before scaffolding.', effort: 'medium', blocksDecision: true, relatedDimension: 'adoptionFriction' },
    { id: 'n2', title: 'Smoke-test landing page at $29 solo / $79 team', category: 'pricing_test', priority: 1, rationale: 'Quantifies willingness-to-pay before committing engineering effort.', effort: 'low', blocksDecision: true, relatedDimension: 'willingnessToPay' },
    { id: 'n3', title: 'Build the "your tenant, your key, no training" trust demo + audit-log walkthrough', category: 'positioning_test', priority: 2, rationale: 'Retires the buying-committee’s accountability/privacy objection.', effort: 'low', blocksDecision: false, relatedDimension: 'committeeConfidence' },
    { id: 'n4', title: 'Email-platform survey across 50 prospects (Gmail vs Outlook vs other)', category: 'market_sizing', priority: 2, rationale: 'De-risks the Gmail-only wedge claim.', effort: 'low', blocksDecision: false, relatedDimension: 'marketClarity' },
    { id: 'n5', title: 'Competitive teardown: HubSpot Free, Folk, Attio — "zero-forms" wedge audit', category: 'competitive_analysis', priority: 3, rationale: 'Confirms differentiation is durable, not a feature war.', effort: 'low', blocksDecision: false, relatedDimension: 'differentiation' },
  ],
  decisionRationale: [
    'Composite score 74 ≥ PROCEED threshold: strong problem and differentiation outweigh adoption friction.',
    'Champion (Maya) plus an influencer (Sam) provide pull and a credible distribution path.',
    'The blocker moved from reject to pilot once auditability was on the table — the key objection is addressable, not fatal.',
    'Proceed is gated on a human-approval inbox and a replayable audit log shipping in v1.',
  ],
};

// ──────────── BuildSquad artifact pack ──────────────────────────────────────

const pack: BuildSquadArtifactPack = {
  kind: 'BuildSquadArtifactPack',
  artifactId: 'art_demo_pack',
  ventureId: VENTURE_ID,
  createdAt: '2025-05-12T09:34:00.000Z',
  mode: 'proceed',
  inputReferences: {
    ventureId: VENTURE_ID,
    recommendationId: REC_ID,
    graphId: GRAPH_ID,
    personaSetId: PERSONA_SET_ID,
  },
  productVision: {
    problem:
      'Owner-operators bought a CRM, abandoned it, and still pay for it. The follow-ups, hygiene and ' +
      'pipeline reporting it promised fall back on the founder — the worst person to do them because ' +
      'they are also delivering the work.',
    targetUsers: [
      'Gmail-first solo consultants and owner-operators (1 person)',
      'Small services/consulting teams (2–10) ready to drop a manual CRM',
      'Fractional sales leaders standardising follow-up across clients',
    ],
    productPromise: 'The CRM that fills itself in — and does the chasing for you.',
    whyNow:
      'LLMs can finally read a thread and draft a correct, in-voice follow-up; BYOK lets that happen in ' +
      'the customer’s own tenant, making inbox-grounded automation trustworthy for the first time.',
    differentiation: [
      'Zero forms: the record maintains itself from the inbox and calendar.',
      'It acts, not just stores: every winnable deal gets a drafted next step.',
      'Trust by construction: human approval on every send + replayable audit log + BYOK.',
    ],
    successMetrics: [
      '≥70% approval rate on AI-drafted outbound after week two',
      '≥60% of design partners migrate off an existing CRM',
      '≥25% week-four reduction in deal-stage decay',
    ],
  },
  prd: {
    overview:
      'Faceless CRM v1 is a Gmail-first, agent-run CRM. It ingests contacts and deals from email + ' +
      'calendar with no manual entry, surfaces decaying deals, and drafts every follow-up into an ' +
      'approval inbox. Each AI action is logged to a replayable audit trail. BYOK keeps the model key ' +
      'in the customer’s own tenant.',
    goals: [
      'Eliminate manual CRM data entry for the wedge ICP.',
      'Never let a winnable deal decay silently.',
      'Make AI outbound trustworthy via approval + audit.',
    ],
    nonGoals: [
      'Outlook/Exchange support (deferred to month 6).',
      'Voice/SMS channels (v2).',
      'Custom workflow builders and marketing automation.',
    ],
    personas: [
      { id: 'p_maya', name: 'Maya Okafor', summary: 'Solo consultant, Gmail-native champion.' },
      { id: 'p_diego', name: 'Diego Marín', summary: 'Agency owner; wants an honest team pipeline.' },
      { id: 'p_nadia', name: 'Nadia Petrova', summary: 'Ops blocker; auditability is her unlock.' },
    ],
    requirements: [
      { id: 'fr1', text: 'Ingest contacts, companies and deals from connected Gmail + Google Calendar with zero manual entry.', type: 'functional', rationale: 'Removes the cause of CRM abandonment.' },
      { id: 'fr2', text: 'Draft follow-ups into an approval inbox; nothing sends without one-click human approval.', type: 'functional', rationale: 'Core wedge + primary trust control.' },
      { id: 'fr3', text: 'Detect decaying deals and produce a daily triage digest.', type: 'functional', rationale: 'Turns hygiene into proactive action.' },
      { id: 'fr4', text: 'Record every AI action to a replayable, inspectable audit log.', type: 'functional', rationale: 'Retires the blocker’s accountability objection.' },
      { id: 'fr5', text: 'One-click migration importer from HubSpot Free (contacts, companies, deals).', type: 'functional', rationale: 'Replace, don’t augment.' },
      { id: 'nfr1', text: 'BYOK: the model key is used only in the customer’s tenant and never logged; no training on customer data.', type: 'non_functional', rationale: 'Trust posture and differentiation.' },
      { id: 'nfr2', text: 'Per-domain sending warm-up and CAN-SPAM/GDPR opt-out hygiene.', type: 'non_functional', rationale: 'Protect deliverability and reputation.' },
    ],
    userJourneys: [
      { id: 'j1', personaId: 'p_maya', title: 'Connect and see the pipeline build itself', steps: ['Connect Gmail + Calendar', 'Watch contacts and deals populate with zero forms', 'Review the first batch of suggested follow-ups'] },
      { id: 'j2', personaId: 'p_maya', title: 'Approve a follow-up', steps: ['Open the approval inbox', 'Read the drafted, in-voice follow-up with thread context', 'Edit or approve in one click', 'See it logged to the audit trail'] },
      { id: 'j3', personaId: 'p_nadia', title: 'Audit what the AI did', steps: ['Open the audit log', 'Filter by action type and date', 'Replay a specific decision with its inputs'] },
    ],
    metrics: [
      'Time-to-first-value < 10 minutes from connect.',
      '≥70% week-two approval rate on drafted outbound.',
      '≥60% design-partner migration off an existing CRM.',
    ],
    risks: [
      'Inbox-access trust barrier (mitigated by approval + audit + BYOK).',
      'Sender reputation/deliverability (mitigated by warm-up + opt-out hygiene).',
      'Gmail-only coverage in v1.',
    ],
  },
  mvpScope: {
    mustHave: [
      'Gmail + Calendar ingestion (zero-forms capture)',
      'Approval inbox for AI-drafted follow-ups',
      'Replayable audit log of every AI action',
      'Decaying-deal detection + daily digest',
    ],
    shouldHave: ['One-click HubSpot Free migration', 'Per-domain sending warm-up'],
    later: ['Outlook/Exchange support', 'Voice/SMS lanes', 'Team analytics dashboard'],
    explicitCuts: [
      { item: 'Custom workflow builder', reason: 'Re-introduces the manual effort we are eliminating.' },
      { item: 'Mobile-first app', reason: 'Web-first; mobile read-only is enough for the wedge.' },
      { item: 'Marketing automation', reason: 'Different buyer and a feature war we choose not to fight.' },
    ],
  },
  userStories: [
    { id: 'us1', title: 'Zero-forms capture', personaId: 'p_maya', story: 'As a solo consultant, I want contacts and deals captured from my inbox automatically so that I never fill in a form.', acceptanceCriteria: ['New senders become contacts within 1 minute', 'Threads map to deals with a stage guess', 'No manual entry required to get a working pipeline'], priority: 'must' },
    { id: 'us2', title: 'Approval inbox', personaId: 'p_maya', story: 'As an owner-operator, I want every AI-drafted email queued for my approval so that nothing goes out under my name without me seeing it.', acceptanceCriteria: ['List + preview of every draft with thread context', 'One-click approve / edit / reject', 'Nothing sends without explicit approval'], priority: 'must' },
    { id: 'us3', title: 'Replayable audit log', personaId: 'p_nadia', story: 'As an ops manager, I want a log of every AI action so that I can audit and replay what happened.', acceptanceCriteria: ['Every action recorded with inputs + outcome', 'Filter by type/date/deal', 'Replay a single decision'], priority: 'must' },
    { id: 'us4', title: 'Decaying-deal digest', personaId: 'p_maya', story: 'As an owner, I want a daily summary of deals that are decaying so that I can decide which to push, defer or kill.', acceptanceCriteria: ['Morning digest email + in-app feed', 'One-click triage per deal', 'Decay scored from last-touch + stage age'], priority: 'must' },
    { id: 'us5', title: 'Kill-HubSpot migration', personaId: 'p_diego', story: 'As a HubSpot Free user, I want to import my contacts, companies and deals in minutes so that I can switch.', acceptanceCriteria: ['OAuth connect', 'Dry-run import report', 'One-click commit with 7-day rollback'], priority: 'should' },
    { id: 'us6', title: 'BYOK trust controls', personaId: 'p_diego', story: 'As a team buyer, I want the model key to stay in my tenant with no training so that client emails are safe.', acceptanceCriteria: ['Key stored encrypted, used per-call only', 'No customer data used for training', 'Trust page documents the guarantee'], priority: 'should' },
    { id: 'us7', title: 'Sender warm-up', story: 'As an operator, I want per-domain sending warm-up so that approved outbound does not hurt deliverability.', acceptanceCriteria: ['Gradual volume ramp per domain', 'Opt-out honoured automatically', 'Bounce/complaint monitoring'], priority: 'later' },
  ],
  architectureBrief: {
    components: [
      { name: 'ingestion', responsibility: 'Sync Gmail + Calendar; canonicalise contacts, companies, threads.' },
      { name: 'pipeline', responsibility: 'Deals, stages, decay scoring.' },
      { name: 'agents', responsibility: 'Follow-up drafting, hygiene, deal summarisation (via provider abstraction).' },
      { name: 'approval-inbox', responsibility: 'Queue, preview and one-click approve/edit/reject of outbound.' },
      { name: 'audit', responsibility: 'Append-only, replayable log of every AI action.' },
      { name: 'migrations', responsibility: 'HubSpot/Pipedrive/CSV importers with dry-run + rollback.' },
    ],
    dataFlow: [
      'Gmail/Calendar → ingestion → contacts/deals store',
      'pipeline decay scores → agents draft follow-ups → approval-inbox',
      'approved send → provider (BYOK) → audit log',
    ],
    integrations: ['Gmail API', 'Google Calendar API', 'BYOK LLM provider (OpenAI/Anthropic/…)', 'HubSpot import API'],
    storage: ['Postgres (OLTP: contacts, deals, audit)', 'Redis (queues + cache)', 'Object store (attachments)'],
    security: [
      'BYOK key used per-call only, never logged, never sent to the browser',
      'Human approval required for every outbound send',
      'Append-only audit log; least-privilege OAuth scopes',
    ],
    scalabilityAssumptions: [
      'Per-tenant queues; ingestion is incremental/idempotent',
      'v1 modular monolith, carve services later',
    ],
  },
  roadmap: {
    weeks: [
      { week: 1, theme: 'Ingestion + data model', deliverables: ['Gmail/Calendar OAuth + sync', 'Contact/deal canonicalisation', 'Pipeline stage inference'] },
      { week: 2, theme: 'Agents + approval inbox', deliverables: ['Follow-up drafting agent', 'Approval inbox UI', 'BYOK provider wiring'] },
      { week: 3, theme: 'Trust + audit', deliverables: ['Replayable audit log', 'Decaying-deal digest', 'Trust page + no-training guarantee'] },
      { week: 4, theme: 'Migration + pilot polish', deliverables: ['HubSpot Free importer (dry-run + rollback)', 'Sender warm-up', 'Design-partner onboarding'] },
    ],
    futureBacklog: ['Outlook/Exchange support', 'Voice/SMS follow-up lanes', 'Team forecasting analytics', 'Multi-mailbox routing'],
  },
  prototypeBrief: {
    pages: [
      { name: 'Connect', purpose: 'OAuth Gmail + Calendar and watch the pipeline build itself.' },
      { name: 'Pipeline', purpose: 'Deals by stage with decay indicators.' },
      { name: 'Approval inbox', purpose: 'Review, edit and approve AI-drafted follow-ups.' },
      { name: 'Audit log', purpose: 'Inspect and replay every AI action.' },
    ],
    flows: [
      { name: 'First-run', steps: ['Connect Gmail', 'See contacts/deals populate', 'Approve the first follow-up'] },
      { name: 'Daily triage', steps: ['Open decaying-deal digest', 'Triage each deal', 'Approve drafted follow-ups'] },
    ],
    uiComponents: ['DealCard', 'ApprovalItem', 'AuditTimeline', 'DecayBadge', 'ConnectButton'],
    demoScenario:
      'Connect a Gmail account, watch three deals appear with no data entry, open the approval inbox, ' +
      'approve a drafted follow-up, then open the audit log and replay that exact action.',
  },
  agentCritiques: [
    { role: 'pm', targetSection: 'mvp_scope', severity: 'warning', comment: 'Scope is tight, but the daily digest and approval inbox must not slip — they are the wedge.', suggestion: 'Cut HubSpot migration to "should" (done) before cutting digest.' },
    { role: 'architect', targetSection: 'architecture_brief', severity: 'info', comment: 'Append-only audit log is the right call; ensure it captures model + prompt hash for replay.', suggestion: 'Store provider, model and a redacted prompt hash per action.' },
    { role: 'qa', targetSection: 'user_stories', severity: 'blocker', comment: 'Approval inbox needs an explicit "never auto-send" acceptance test.', suggestion: 'Add a test asserting zero sends without recorded human approval.' },
    { role: 'gtm', targetSection: 'product_vision', severity: 'warning', comment: 'Lead messaging with effort ("0 fields to fill"), not features, to beat sticky free incumbents.', suggestion: 'Headline the landing page on effort removed, not capabilities added.' },
  ],
  rationale: [
    'Branch: PROCEED — full artifact pack generated from the recommendation, personas and research graph.',
    'ICP narrowed to Gmail-first solo operators per the recommendation’s market-clarity note.',
    'Trust controls (approval inbox + audit log) elevated to must-have because they unblock the buying committee.',
  ],
};

// ──────────── Timeline ──────────────────────────────────────────────────────

const timeline: VentureTimelineEvent[] = [
  { kind: 'VentureTimelineEvent', eventId: 'ev1', ventureId: VENTURE_ID, ownerId: OWNER, eventKind: 'venture_created', label: 'Venture created from idea brief "Faceless CRM for SMB"', at: '2025-05-12T09:00:00.000Z' },
  { kind: 'VentureTimelineEvent', eventId: 'ev2', ventureId: VENTURE_ID, ownerId: OWNER, eventKind: 'research_graph_built', label: 'Research graph built · 13 nodes · 5 god-nodes · 2 contradictions', at: '2025-05-12T09:08:00.000Z', artifactId: 'art_demo_research', jobId: 'job_graph', metrics: { executionDurationMs: 88000, providerName: 'openai', providerModel: 'gpt-4.1-mini', estimatedCostCents: 80, artifactKind: 'research_graph', artifactVersion: 1 } },
  { kind: 'VentureTimelineEvent', eventId: 'ev3', ventureId: VENTURE_ID, ownerId: OWNER, eventKind: 'persona_set_generated', label: 'PersonaLab generated 5 personas', at: '2025-05-12T09:12:00.000Z', artifactId: PERSONA_SET_ID, jobId: 'job_personas', metrics: { executionDurationMs: 61000, providerName: 'openai', providerModel: 'gpt-4.1-mini', estimatedCostCents: 50, artifactKind: 'persona_set', artifactVersion: 1 } },
  { kind: 'VentureTimelineEvent', eventId: 'ev4', ventureId: VENTURE_ID, ownerId: OWNER, eventKind: 'buying_committee_run', label: 'Buying committee deliberated → decision: pilot (moderate consensus)', at: '2025-05-12T09:18:00.000Z', artifactId: 'art_demo_committee', jobId: 'job_committee', metrics: { executionDurationMs: 132000, providerName: 'anthropic', providerModel: 'claude-3-5-sonnet', estimatedCostCents: 120, artifactKind: 'buying_committee', artifactVersion: 1 } },
  { kind: 'VentureTimelineEvent', eventId: 'ev5', ventureId: VENTURE_ID, ownerId: OWNER, eventKind: 'recommendation_generated', label: 'VentureLab recommendation: PROCEED · score 74 · confidence 82%', at: '2025-05-12T09:20:00.000Z', artifactId: 'art_demo_rec', jobId: 'job_rec', metrics: { executionDurationMs: 58000, providerName: 'openai', providerModel: 'gpt-4.1-mini', estimatedCostCents: 40, artifactKind: 'venture_recommendation', artifactVersion: 1 } },
  { kind: 'VentureTimelineEvent', eventId: 'ev6', ventureId: VENTURE_ID, ownerId: OWNER, eventKind: 'buildsquad_pack_generated', label: 'BuildSquad pack generated · 7 user stories · 4 critiques', at: '2025-05-12T09:34:00.000Z', artifactId: 'art_demo_pack', jobId: 'job_pack', metrics: { executionDurationMs: 236000, providerName: 'anthropic', providerModel: 'claude-3-5-sonnet', estimatedCostCents: 140, artifactKind: 'buildsquad_pack', artifactVersion: 1 } },
  { kind: 'VentureTimelineEvent', eventId: 'ev7', ventureId: VENTURE_ID, ownerId: OWNER, eventKind: 'evaluation_report_generated', label: 'Evaluation report generated · readiness 97/100', at: '2025-05-12T09:40:00.000Z', jobId: 'job_eval' },
  { kind: 'VentureTimelineEvent', eventId: 'ev8', ventureId: VENTURE_ID, ownerId: OWNER, eventKind: 'buildsquad_repo_pushed', label: 'Exported to GitHub · demo-org/faceless-crm · 6 files', at: '2025-05-12T09:42:00.000Z', artifactId: 'art_demo_repo', jobId: 'job_export', metrics: { executionDurationMs: 30000, providerName: 'github', providerModel: null, estimatedCostCents: 5, artifactKind: 'github_repo', artifactVersion: 1 } },
];

// ──────────── Pre-computed dashboard summary ────────────────────────────────
// Validated against calculateVentureReadiness / calculateVentureProgress in tests.

const summary: VentureSummary = {
  venture,
  progress: { research: 60, validation: 95, planning: 100, buildReadiness: 100 },
  readiness: {
    overall: 97,
    personaCoverage: 100,
    researchCoverage: 100,
    validationConfidence: 86,
    buildsquadCompleteness: 100,
    riskCoverage: 100,
    warnings: [],
  },
  latestRecommendation: {
    recommendationId: REC_ID,
    decision: 'PROCEED',
    overallScore: 74,
    confidenceScore: 0.82,
    createdAt: '2025-05-12T09:20:00.000Z',
  },
  artifactCount: 6,
  lastEventAt: '2025-05-12T09:42:00.000Z',
};

// ──────────── Artifact ledger (drives readiness/progress) ───────────────────

const artifacts: VentureArtifact[] = [
  { kind: 'VentureArtifact', artifactId: 'art_demo_research', ventureId: VENTURE_ID, ownerId: OWNER, artifactKind: 'research_graph', version: 1, createdAt: '2025-05-12T09:08:00.000Z', summary: '13 nodes · 15 edges · 5 god-nodes · 2 contradictions', payload: research },
  { kind: 'VentureArtifact', artifactId: PERSONA_SET_ID, ventureId: VENTURE_ID, ownerId: OWNER, artifactKind: 'persona_set', version: 1, createdAt: '2025-05-12T09:12:00.000Z', summary: '5 personas · champion, supporters, blocker, skeptic', payload: personas },
  { kind: 'VentureArtifact', artifactId: 'art_demo_committee', ventureId: VENTURE_ID, ownerId: OWNER, artifactKind: 'buying_committee', version: 1, createdAt: '2025-05-12T09:18:00.000Z', summary: 'Decision: pilot · moderate consensus · 1 opinion change', payload: committee },
  { kind: 'VentureArtifact', artifactId: 'art_demo_rec', ventureId: VENTURE_ID, ownerId: OWNER, artifactKind: 'venture_recommendation', version: 1, createdAt: '2025-05-12T09:20:00.000Z', summary: 'PROCEED · 74/100 · confidence 82%', payload: recommendation },
  { kind: 'VentureArtifact', artifactId: 'art_demo_pack', ventureId: VENTURE_ID, ownerId: OWNER, artifactKind: 'buildsquad_pack', version: 1, createdAt: '2025-05-12T09:34:00.000Z', summary: 'proceed · PRD, MVP, 7 stories, architecture, 4-week roadmap, prototype', payload: pack },
  {
    kind: 'VentureArtifact',
    artifactId: 'art_demo_repo',
    ventureId: VENTURE_ID,
    ownerId: OWNER,
    artifactKind: 'github_repo',
    version: 1,
    createdAt: '2025-05-12T09:42:00.000Z',
    summary: 'Exported to demo-org/faceless-crm · 6 files',
    payload: {
      kind: 'GitHubRepoArtifact',
      owner: 'demo-org',
      name: 'faceless-crm',
      htmlUrl: 'https://github.com/demo-org/faceless-crm',
      defaultBranch: 'main',
      commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      files: [
        { path: 'README.md', sha: 'b1a1f0' },
        { path: 'PRD.md', sha: 'b1a1f1' },
        { path: 'ARCHITECTURE.md', sha: 'b1a1f2' },
        { path: 'ROADMAP.md', sha: 'b1a1f3' },
        { path: 'USER_STORIES.md', sha: 'b1a1f4' },
        { path: 'EVALUATION_REPORT.md', sha: 'b1a1f5' },
      ],
    } satisfies GitHubRepoArtifactPayload,
  },
];

const demoExport: DemoVenture['export'] = {
  owner: 'demo-org',
  repo: 'faceless-crm',
  fullName: 'demo-org/faceless-crm',
  htmlUrl: 'https://github.com/demo-org/faceless-crm',
  visibility: 'private',
  defaultBranch: 'main',
  commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
  credentialHint: 'In Real Mode this uses your BYOK GitHub PAT and creates a real repository.',
};

export const facelessCrmDemo: DemoVenture = {
  slug: 'faceless-crm',
  tagline: 'An AI-run CRM that fills itself in — the M0 reference venture, end to end.',
  brief,
  venture,
  personas,
  committee,
  research,
  recommendation,
  pack,
  timeline,
  summary,
  artifacts,
  export: demoExport,
};
