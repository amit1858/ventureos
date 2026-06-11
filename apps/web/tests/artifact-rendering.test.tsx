/**
 * Proves the Real-Mode Venture Workspace renders artifacts as readable product
 * UI — never raw JSON by default. Uses the Faceless CRM demo fixture because its
 * payloads are real `@ventureos/contracts` types, identical in shape to what the
 * labs emit in Real Mode, so these components see exactly the same data live.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ArtifactsView,
  BuildPlanView,
  CommitteeView,
  EvaluationView,
  PersonaCards,
  ResearchGraphView,
  ValidationView,
} from '../src/components/artifacts';
import { facelessCrmDemo } from '../src/lib/demo';
import { buildEvaluationFromArtifacts } from '../src/lib/evaluation';

const demo = facelessCrmDemo;

/**
 * A serialized object always contains a quoted-key-then-colon pattern
 * (`"id":`). Static markup escapes the quotes to `&quot;`. Human rendering never
 * emits that pattern, so its absence proves raw JSON is not the default view.
 */
const JSON_KEY = /&quot;\w+&quot;\s*:/;

describe('Real-Mode artifact rendering', () => {
  it('renders personas as cards (role, goals, pains, triggers), not raw JSON', () => {
    const html = renderToStaticMarkup(<PersonaCards personas={demo.personas} />);
    expect(html).toContain('Maya Okafor');
    expect(html).toContain('Goals');
    expect(html).toContain('Pain points');
    expect(html).toContain('Buying triggers');
    expect(JSON_KEY.test(html)).toBe(false);
  });

  it('renders the buying committee as deliberation, not raw JSON', () => {
    const html = renderToStaticMarkup(<CommitteeView committee={demo.committee} personas={demo.personas} />);
    expect(html.length).toBeGreaterThan(200);
    expect(JSON_KEY.test(html)).toBe(false);
  });

  it('renders the validation decision and scorecard, not raw JSON', () => {
    const html = renderToStaticMarkup(<ValidationView recommendation={demo.recommendation} />);
    expect(html).toContain('PROCEED');
    expect(JSON_KEY.test(html)).toBe(false);
  });

  it('renders the build plan as product docs, not raw JSON', () => {
    const html = renderToStaticMarkup(<BuildPlanView pack={demo.pack} />);
    expect(html.length).toBeGreaterThan(400);
    expect(JSON_KEY.test(html)).toBe(false);
  });

  it('renders the evaluation report as a markdown preview, not raw JSON', () => {
    const { report, markdown } = buildEvaluationFromArtifacts({
      venture: demo.summary.venture,
      readiness: demo.summary.readiness,
      personas: demo.personas,
      graph: demo.research,
      recommendation: demo.recommendation,
      committee: demo.committee,
      pack: demo.pack,
    });
    expect(report.kind).toBe('EvaluationReport');
    const html = renderToStaticMarkup(<EvaluationView report={report} markdown={markdown} />);
    expect(html).toContain('Faceless CRM for SMB');
    expect(JSON_KEY.test(html)).toBe(false);
  });

  it('keeps raw JSON secondary (collapsed) in the research graph view', () => {
    const html = renderToStaticMarkup(<ResearchGraphView graph={demo.research} />);
    expect(html).toContain('<details'); // a raw-JSON disclosure exists…
    expect(html).not.toContain('<details open'); // …but it is collapsed by default
  });

  it('keeps raw JSON secondary (collapsed) in the artifacts view', () => {
    const html = renderToStaticMarkup(<ArtifactsView artifacts={demo.artifacts} events={demo.timeline} />);
    expect(html).toContain('<details');
    expect(html).not.toContain('<details open');
    // Readable artifact labels render before any JSON disclosure is opened.
    expect(html).toContain('Persona set');
  });
});
