import type { ChatMessage } from '@ventureos/contracts';

import { EDGE_TYPES, NODE_TYPES } from './types';
import type { GraphifyInput } from './types';

const SYSTEM = `You are a research-graph extraction engine for VentureOS Graphify.

OUTPUT CONTRACT (NON-NEGOTIABLE):
- Return a SINGLE JSON object — no prose, no markdown fences.
- Shape: { "nodes": [...], "edges": [...] }
- Every node: { "id": string, "type": <one of NODE_TYPES>, "label": string, "summary"?: string, "confidence": 0..1, "evidence": [string, ...], "sourceIds": [string, ...] }
- Every edge: { "from": <nodeId>, "to": <nodeId>, "type": <one of EDGE_TYPES>, "confidence": 0..1, "evidence": [string, ...], "sourceIds": [string, ...] }

EXTRACTION RULES:
- ONLY extract claims that are present in the supplied research text. Do not invent.
- "evidence" must be verbatim short quotes (≤200 chars) from the source. No paraphrase.
- "sourceIds" must reference IDs from the supplied SOURCES section.
- Allowed node types: ${NODE_TYPES.join(', ')}.
- Allowed edge types: ${EDGE_TYPES.join(', ')}.
- NEVER produce nodes of type "decision", "score", or "recommendation".
- If two sources contradict each other on the same claim, emit BOTH claims as separate nodes and connect them with a "contradicts" edge.
- Edges must point between nodes you actually emitted.
- Prefer fewer high-quality nodes/edges over many speculative ones.`;

export function extractGraphPrompt(input: GraphifyInput, sources: Array<{ id: string; label: string; text: string }>): ChatMessage[] {
  const briefBlock = input.brief
    ? [
        '## BRIEF',
        `Business idea: ${input.brief.businessIdea}`,
        `Target market: ${input.brief.targetMarket}`,
        `Customer type: ${input.brief.customerType}`,
        `Business size: ${input.brief.businessSize}`,
        input.brief.additionalContext ? `Context: ${input.brief.additionalContext}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const personasBlock = (input.personas ?? []).slice(0, 10).map((p) => (
    `- ${p.id} | ${p.name} | role: ${p.role ?? 'n/a'} | pains: ${(p.painPoints ?? []).join(' | ')} | objections: ${(p.objections ?? []).join(' | ')}`
  )).join('\n');

  const assumptionsBlock = (input.assumptions ?? []).slice(0, 20).map((a) => (
    `- ${a.id} | ${a.type} | ${a.riskLevel} risk | ${a.text}`
  )).join('\n');

  const risksBlock = (input.risks ?? []).slice(0, 20).map((r) => (
    `- ${r.id} | impact:${r.impact} likelihood:${r.likelihood} | ${r.risk}`
  )).join('\n');

  const sourcesBlock = sources
    .map((s) => `### source:${s.id} — ${s.label}\n${truncate(s.text, 3000)}`)
    .join('\n\n');

  const user = [
    '# RESEARCH INPUT',
    briefBlock,
    personasBlock ? `## PERSONAS (Sprint 1D)\n${personasBlock}` : '',
    assumptionsBlock ? `## EXISTING ASSUMPTIONS (Sprint 1E)\n${assumptionsBlock}` : '',
    risksBlock ? `## EXISTING RISKS (Sprint 1E)\n${risksBlock}` : '',
    '## SOURCES',
    sourcesBlock || '(no source text provided)',
    '',
    'Return ONLY the JSON object with "nodes" and "edges".',
  ].filter(Boolean).join('\n\n');

  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ];
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[truncated ${s.length - max} chars]`;
}
