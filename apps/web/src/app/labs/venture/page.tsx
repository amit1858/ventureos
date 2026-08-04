'use client';

/**
 * Venture Validation lab — venture-scoped (rebuilt for the venture-context repair).
 *
 * Bound to the active venture via `?ventureId=`. It AUTO-CONSUMES the venture's
 * latest persisted `persona_set` and `buying_committee` artifacts — no pasted
 * JSON, no sample personas, no "Faceless CRM" default. If personas haven't been
 * generated yet it explains the precondition and links back to the Personas lab
 * for this same venture. Running an analysis persists the `venture_recommendation`
 * artifact through the JobOrchestrator and renders through the shared design-system
 * `ValidationView`.
 */
import { useCallback, useState } from 'react';

import type { VentureRecommendation } from '@foundry/contracts';

import { ValidationView } from '../../../components/artifacts';
import {
  LabFrame,
  labUi,
  useElapsedSeconds,
  useVentureLab,
  type VentureLab,
} from '../../../components/labs/LabFrame';

const LAB_PATH = '/labs/venture';

interface Envelope<T> { ok: boolean; data?: T; reason?: string }

export default function VentureLabPage() {
  const lab = useVentureLab();
  return (
    <LabFrame
      lab={lab}
      labPath={LAB_PATH}
      title="Venture Validation"
      description="Weigh the evidence for this venture and produce one auditable recommendation — Proceed, Pivot, or Kill — with scorecard, assumptions, risks, and next steps."
      authMessage="Sign in to run validation for this venture using your own provider key."
    >
      <VentureLabBody lab={lab} />
    </LabFrame>
  );
}

function VentureLabBody({ lab }: { lab: VentureLab }) {
  const ctx = lab.context;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<VentureRecommendation | null>(
    ctx?.recommendation ?? null,
  );
  const elapsed = useElapsedSeconds(busy);

  const personas = ctx?.personas ?? null;
  const committee = ctx?.committee ?? null;
  const hasPersonas = Boolean(personas && personas.length > 0);
  const canAnalyze = Boolean(lab.selectedProviderId && lab.selectedModel && hasPersonas && !busy);

  const analyze = useCallback(async () => {
    if (!ctx || !lab.ventureId || !personas || personas.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const payload = {
        ventureId: lab.ventureId,
        brief: ctx.brief,
        personas,
        ...(committee ? { committee } : {}),
      };
      const r = await fetch('/api/venturelab', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerCredentialId: lab.selectedProviderId,
          modelId: lab.selectedModel,
          payload,
        }),
      });
      const body = (await r.json()) as Envelope<VentureRecommendation>;
      if (!body.ok || !body.data) {
        setError(body.reason ?? 'Validation failed.');
        return;
      }
      setRecommendation(body.data);
      void lab.reloadContext();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed.');
    } finally {
      setBusy(false);
    }
  }, [ctx, committee, lab, personas]);

  if (!ctx) return null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section style={labUi.card}>
        <h3 style={{ marginTop: 0 }}>Evidence for this venture</h3>
        {hasPersonas ? (
          <ul style={{ ...labUi.muted, margin: '0 0 0.75rem', paddingLeft: '1.1rem', fontSize: '0.88rem' }}>
            <li>{personas?.length} persona{(personas?.length ?? 0) === 1 ? '' : 's'} generated</li>
            <li>{committee ? 'Buying-committee transcript available' : 'No buying-committee transcript yet (optional)'}</li>
          </ul>
        ) : (
          <div style={{ ...labUi.muted, fontSize: '0.9rem' }}>
            <p style={{ marginTop: 0 }}>
              Validation reads this venture&rsquo;s personas. None have been generated yet.
            </p>
            <a
              href={`/labs/persona?ventureId=${encodeURIComponent(lab.ventureId ?? '')}`}
              style={labUi.primaryBtn}
            >
              Generate personas first →
            </a>
          </div>
        )}

        {hasPersonas ? (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void analyze()}
              disabled={!canAnalyze}
              style={{ ...labUi.primaryBtn, opacity: canAnalyze ? 1 : 0.6, cursor: canAnalyze ? 'pointer' : 'not-allowed' }}
            >
              {busy ? `Analyzing… ${elapsed}s` : recommendation ? 'Re-run validation' : 'Analyze venture'}
            </button>
            {busy ? <span style={{ ...labUi.muted, fontSize: '0.85rem' }}>Weighing evidence with {lab.selectedModel}. This can take up to a minute.</span> : null}
          </div>
        ) : null}
        {error ? <p style={{ ...labUi.error, margin: '0.75rem 0 0' }}>{error}</p> : null}
      </section>

      {recommendation ? (
        <section style={labUi.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Recommendation</h3>
            <a href={`/ventures/${encodeURIComponent(lab.ventureId ?? '')}`} style={labUi.link}>
              View in venture workspace →
            </a>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <ValidationView recommendation={recommendation} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
