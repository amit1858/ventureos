/**
 * Prompts for BuildSquad's at-most-two LLM calls per PROCEED run plus the
 * single PIVOT prompt. Everything else is deterministic.
 */
import type { BuildSquadInput } from './types';
import { BUILDSQUAD_AGENTS } from './agents';

const SECTION_KEYS = [
  'productVision',
  'prd',
  'mvpScope',
  'userStories',
  'architectureBrief',
  'roadmap',
  'prototypeBrief',
];

interface ChatMessage { role: 'system' | 'user'; content: string }

export function draftPrompt(input: BuildSquadInput): ChatMessage[] {
  const personas = (input.personas ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    painPoints: (p as { painPoints?: string[] }).painPoints ?? [],
  }));
  const graph = input.researchGraph
    ? {
        godNodes: input.researchGraph.godNodes ?? [],
        contradictions: input.researchGraph.contradictions ?? [],
        topNodes: (input.researchGraph.nodes ?? []).slice(0, 18).map((n) => ({
          id: n.id,
          type: n.type,
          label: n.label,
          confidence: n.confidence,
        })),
      }
    : null;

  const system = `You are BuildSquad: a coordinated team of product, UX, architecture and GTM agents.
Produce a JSON planning pack for a venture that has been recommended PROCEED.
Use ONLY the provided brief, personas, research graph, evidence, assumptions and risks.
Do NOT invent personas, do NOT invent metrics. Quote-style ids must reference real persona ids.

Output JSON with these top-level keys: ${SECTION_KEYS.join(', ')}.

Section shapes (TypeScript):
  productVision: { problem, productPromise, whyNow, targetUsers[], differentiation[], successMetrics[] }
  prd: { overview, goals[], nonGoals[], personas[{id,name,summary}], requirements[{id,text,type,rationale}],
         userJourneys[{id,personaId?,title,steps[]}], metrics[], risks[] }
    - requirement.type ∈ {functional, non_functional}
  mvpScope: { mustHave[], shouldHave[], later[], explicitCuts[{item,reason}] }
  userStories: [{id,title,personaId?,story,acceptanceCriteria[],priority}]
    - priority ∈ {must, should, later}
    - story format: "As a <persona> I want <capability> so that <outcome>."
    - every must-priority story MUST have at least 2 acceptance criteria.
  architectureBrief: { components[{name,responsibility}], dataFlow[], integrations[],
                       storage[], security[], scalabilityAssumptions[] }
  roadmap: { weeks:[{week,theme,deliverables[]}], futureBacklog[] }   // week ∈ {1,2,3,4}
  prototypeBrief: { pages[{name,purpose}], flows[{name,steps[]}], uiComponents[], demoScenario }

Constraints:
  - MVP scope MUST include at least one explicit cut.
  - Roadmap MUST cover weeks 1..4.
  - At least 3 user stories at "must" priority.
  - Do NOT produce code.
  - Do NOT include keys other than those listed.

Return raw JSON only.`;

  const user = JSON.stringify({
    brief: input.brief ?? null,
    recommendation: {
      decision: input.recommendation.decision,
      overallScore: input.recommendation.overallScore,
      executiveSummary: input.recommendation.executiveSummary,
      scores: input.recommendation.scores.map((s) => ({
        dimension: s.dimension,
        score: s.score,
        higherIsBetter: s.higherIsBetter,
        explanation: s.explanation,
      })),
      assumptions: input.recommendation.assumptions.map((a) => ({
        id: a.id,
        text: a.text,
        confidence: a.confidence,
        riskLevel: a.riskLevel,
      })),
      risks: input.recommendation.risks.map((r) => ({
        id: r.id,
        risk: r.risk,
        impact: r.impact,
        likelihood: r.likelihood,
        mitigation: r.mitigation,
      })),
      nextSteps: input.recommendation.nextSteps.map((s) => ({
        id: s.id,
        title: s.title,
        priority: s.priority,
      })),
    },
    personas,
    researchGraph: graph,
  }, null, 2);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function critiquePrompt(input: BuildSquadInput, draft: unknown): ChatMessage[] {
  const charters = BUILDSQUAD_AGENTS.map((a) => ({
    role: a.role,
    displayName: a.displayName,
    reviewsSections: a.reviewsSections,
    checklist: a.checklist,
  }));

  const system = `You are the BuildSquad cross-agent review.
Produce JSON with one top-level key "critiques", an array of items shaped:
  { role, targetSection, severity, comment, suggestion? }
  - role ∈ {pm, ux, architect, backend, frontend, qa, gtm}
  - targetSection ∈ {product_vision, prd, mvp_scope, user_stories, architecture_brief, roadmap, prototype_brief}
  - severity ∈ {info, warning, blocker}
  - comment: one short sentence, specific to the draft. No platitudes.
  - suggestion (optional): one short sentence suggesting a concrete change.

Each agent reviews only the sections in its 'reviewsSections' list.
Aim for 1-2 critiques per agent, AT LEAST 5 total, AT MOST 14.
Do NOT rewrite the draft. Return raw JSON only.`;

  const user = JSON.stringify({
    decision: input.recommendation.decision,
    charters,
    draft,
  }, null, 2);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function pivotPrompt(input: BuildSquadInput): ChatMessage[] {
  const system = `You are BuildSquad operating in PIVOT mode.
The venture should NOT be built as currently framed. Produce a JSON pivot brief shaped:
  { pivotBrief, revisedProblemStatement, revisedMvpDirection,
    validationPlan: [{id,title,rationale}] }
  - validationPlan: 3-5 concrete experiments to test the new direction.
  - Do NOT propose architectural details, code, or roadmaps.
Return raw JSON only.`;

  const user = JSON.stringify({
    brief: input.brief ?? null,
    decision: input.recommendation.decision,
    executiveSummary: input.recommendation.executiveSummary,
    decisionRationale: input.recommendation.decisionRationale,
    counterSignals: input.recommendation.counterSignals.slice(0, 6),
    risks: input.recommendation.risks.slice(0, 6),
  }, null, 2);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
