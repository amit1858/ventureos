'use client';

/**
 * Research Graph lab — venture-scoped (rebuilt for the venture-context repair).
 *
 * Bound to the active venture via `?ventureId=` (enforced by `useVentureLab`).
 * There is NO demo brief and NO manual "Venture ID" field: research notes are
 * pre-derived from the venture's own brief and its latest generated personas
 * (`researchNotesFrom`), the user may refine them, and building persists the
 * `research_graph` artifact back to the venture through the JobOrchestrator
 * (POST /api/graphify). The result renders through the shared design-system
 * `ResearchGraphView` — no more unstyled Tailwind, which this app doesn't ship.
 */
import { useCallback, useMemo, useState } from 'react';

import type { GraphifyInput, ResearchGraphQueryResult } from '@foundry/adapter-graphify';
import { queryGraph } from '@foundry/adapter-graphify';
import type { ResearchGraph } from '@foundry/contracts';

import { ResearchGraphView } from '../../../components/artifacts';
import {
  LabFrame,
  labUi,
  useElapsedSeconds,
  useVentureLab,
  type VentureLab,
} from '../../../components/labs/LabFrame';
import { researchNotesFrom } from '../../../lib/venture-context';

const LAB_PATH = '/labs/research-graph';

interface Envelope<T> { ok: boolean; data?: T; reason?: string }

export default function ResearchGraphPage() {
  const lab = useVentureLab();
  return (
    <LabFrame
      lab={lab}
      labPath={LAB_PATH}
      title="Research Graph"
      description="Turn this venture's brief and personas into a structured graph of problems, segments, competitors, market signals, and opportunities — the evidence base evaluation draws on."
      authMessage="Sign in to build a research graph for this venture using your own provider key."
    >
      <ResearchGraphBody lab={lab} />
    </LabFrame>
  );
}

function ResearchGraphBody({ lab }: { lab: VentureLab }) {
  const ctx = lab.context;

  const initialNotes = useMemo(
    () => (ctx ? researchNotesFrom(ctx.brief, ctx.personas).join('\n\n') : ''),
    [ctx],
  );

  const [notes, setNotes] = useState<string>(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<ResearchGraph | null>(ctx?.researchGraph ?? null);
  const [question, setQuestion] = useState('');
  const [queryResult, setQueryResult] = useState<ResearchGraphQueryResult | null>(null);
  const elapsed = useElapsedSeconds(busy);

  const canBuild = Boolean(lab.selectedProviderId && lab.selectedModel && notes.trim().length > 0 && !busy);

  const build = useCallback(async () => {
    if (!ctx || !lab.ventureId) return;
    setError(null);
    setQueryResult(null);
    const noteList = notes.split(/\n\s*\n/).map((s) => s.trim()).filter((s) => s.length > 0);
    if (noteList.length === 0) {
      setError('Add at least one research note (separate entries with a blank line).');
      return;
    }
    setBusy(true);
    try {
      const payload: GraphifyInput = {
        ventureId: lab.ventureId,
        brief: ctx.brief,
        notes: noteList,
      };
      const r = await fetch('/api/graphify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerCredentialId: lab.selectedProviderId,
          modelId: lab.selectedModel,
          payload,
        }),
      });
      const body = (await r.json()) as Envelope<ResearchGraph>;
      if (!body.ok || !body.data) {
        setError(body.reason ?? 'Research graph build failed.');
        return;
      }
      setGraph(body.data);
      void lab.reloadContext();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Research graph build failed.');
    } finally {
      setBusy(false);
    }
  }, [ctx, lab, notes]);

  const runQuery = useCallback(() => {
    if (!graph || question.trim().length === 0) return;
    setQueryResult(queryGraph(graph, question, 8));
  }, [graph, question]);

  if (!ctx) return null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section style={labUi.card}>
        <h3 style={{ marginTop: 0 }}>Research notes</h3>
        <p style={{ ...labUi.muted, marginTop: 0, fontSize: '0.85rem' }}>
          Pre-filled from this venture&rsquo;s brief{ctx.personas && ctx.personas.length > 0 ? ' and its generated personas' : ''}.
          Edit or add signals (separate entries with a blank line), then build the graph.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={10}
          style={{ ...labUi.input, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '0.82rem' }}
        />
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void build()}
            disabled={!canBuild}
            style={{ ...labUi.primaryBtn, opacity: canBuild ? 1 : 0.6, cursor: canBuild ? 'pointer' : 'not-allowed' }}
          >
            {busy ? `Building graph… ${elapsed}s` : graph ? 'Rebuild graph' : 'Build research graph'}
          </button>
          {busy ? <span style={{ ...labUi.muted, fontSize: '0.85rem' }}>Generating with {lab.selectedModel}. This can take up to a minute.</span> : null}
        </div>
        {error ? <p style={{ ...labUi.error, margin: '0.75rem 0 0' }}>{error}</p> : null}
      </section>

      {graph ? (
        <section style={labUi.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Research graph</h3>
            <a href={`/ventures/${encodeURIComponent(lab.ventureId ?? '')}`} style={labUi.link}>
              View in venture workspace →
            </a>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <ResearchGraphView graph={graph} />
          </div>

          <div style={{ marginTop: '1rem', borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem' }}>Ask the graph</h4>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. biggest adoption risk"
                style={{ ...labUi.input, maxWidth: 360, marginTop: 0 }}
                onKeyDown={(e) => { if (e.key === 'Enter') runQuery(); }}
              />
              <button type="button" onClick={runQuery} style={labUi.secondaryBtn}>Query</button>
            </div>
            {queryResult ? (
              <div style={{ marginTop: '0.75rem' }}>
                <p style={{ ...labUi.muted, margin: '0 0 0.4rem', fontSize: '0.78rem' }}>
                  {queryResult.matches.length} match(es)
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.4rem' }}>
                  {queryResult.matches.map((n) => (
                    <li key={n.id} style={{ border: '1px solid #2a2a2a', borderRadius: 6, padding: '0.5rem 0.65rem' }}>
                      <span style={{ fontWeight: 600 }}>{n.label}</span>{' '}
                      <span style={{ ...labUi.muted, fontSize: '0.78rem' }}>· {n.type}</span>
                      {n.summary ? <p style={{ ...labUi.muted, margin: '0.25rem 0 0', fontSize: '0.82rem' }}>{n.summary}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
