/**
 * BuildSquad agent charters.
 *
 * Each agent owns one or more sections of the artifact pack. Their charters
 * are exposed both to the LLM (as system context inside the critique prompt)
 * and to the deterministic critique pass so we can attribute every comment
 * to a role with a stable checklist.
 */
import type { BuildSquadAgentRole } from './types';

export interface BuildSquadAgentCharter {
  role: BuildSquadAgentRole;
  displayName: string;
  /** What this agent is responsible for during drafting. */
  responsibilities: string[];
  /** Sections this agent reviews during the critique pass. */
  reviewsSections: string[];
  /** Stable checklist used by the deterministic critique pass. */
  checklist: string[];
}

export const BUILDSQUAD_AGENTS: BuildSquadAgentCharter[] = [
  {
    role: 'pm',
    displayName: 'PM Agent',
    responsibilities: [
      'Own product_vision, prd.overview/goals/non-goals, mvp_scope tradeoffs.',
      'Resolve disagreements between UX, Architect, and GTM.',
      'Ensure goals trace back to VentureRecommendation evidence.',
    ],
    reviewsSections: ['mvp_scope', 'roadmap', 'user_stories'],
    checklist: [
      'MVP scope has at least one explicit cut.',
      'Roadmap totals four weeks with a deliverable per week.',
      'Each must-have user story has acceptance criteria.',
    ],
  },
  {
    role: 'ux',
    displayName: 'UX Agent',
    responsibilities: [
      'Own user_journeys in PRD and prototype_brief.flows.',
      'Translate personas into named flows and page intents.',
    ],
    reviewsSections: ['user_stories', 'prototype_brief'],
    checklist: [
      'Every persona is referenced by at least one user journey.',
      'Each prototype flow names at least two steps.',
    ],
  },
  {
    role: 'architect',
    displayName: 'Architect Agent',
    responsibilities: [
      'Own architecture_brief.components, data_flow, storage, integrations.',
      'Challenge MVP scope when components imply more than four weeks of work.',
    ],
    reviewsSections: ['mvp_scope', 'architecture_brief'],
    checklist: [
      'Architecture brief lists at least three components.',
      'Architecture brief touches storage and security.',
      'No component name appears in mvp_scope.mustHave without a matching component.',
    ],
  },
  {
    role: 'backend',
    displayName: 'Backend Agent',
    responsibilities: [
      'Own non-functional requirements that relate to data, APIs, jobs.',
      'Flag missing integrations or storage assumptions.',
    ],
    reviewsSections: ['architecture_brief', 'prd'],
    checklist: [
      'Non-functional requirements list contains at least one entry.',
      'Integrations list is present (may be empty but field exists).',
    ],
  },
  {
    role: 'frontend',
    displayName: 'Frontend Agent',
    responsibilities: [
      'Own prototype_brief.pages and ui_components list.',
      'Ensure each must-have story has a corresponding page.',
    ],
    reviewsSections: ['prototype_brief', 'user_stories'],
    checklist: [
      'Prototype brief lists at least two pages.',
      'UI components list is non-empty.',
    ],
  },
  {
    role: 'qa',
    displayName: 'QA Agent',
    responsibilities: [
      'Challenge user_stories acceptance criteria for specificity.',
      'Surface missing edge cases (empty states, errors, auth).',
    ],
    reviewsSections: ['user_stories'],
    checklist: [
      'No must-have story has fewer than two acceptance criteria.',
      'Acceptance criteria avoid the word "etc".',
    ],
  },
  {
    role: 'gtm',
    displayName: 'GTM Agent',
    responsibilities: [
      'Own product_vision.successMetrics and differentiation framing.',
      'Challenge positioning vs. competitor signals in the research graph.',
    ],
    reviewsSections: ['product_vision', 'roadmap'],
    checklist: [
      'Product vision lists at least two differentiation points.',
      'Product vision lists at least two success metrics.',
    ],
  },
];

export const BUILDSQUAD_AGENT_BY_ROLE: Record<BuildSquadAgentRole, BuildSquadAgentCharter> = BUILDSQUAD_AGENTS.reduce(
  (acc, charter) => {
    acc[charter.role] = charter;
    return acc;
  },
  {} as Record<BuildSquadAgentRole, BuildSquadAgentCharter>,
);
