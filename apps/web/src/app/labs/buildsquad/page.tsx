'use client';

/**
 * Build Planning (BuildSquad) lab — venture-scoped (rebuilt for the venture-context repair).
 *
 * Bound to the active venture via `?ventureId=`. It AUTO-CONSUMES the venture's
 * latest persisted `venture_recommendation` (and, when present, `research_graph`)
 * — no pasted JSON. If validation hasn't run yet it explains the precondition and
 * links back to the Validation lab for this same venture. Running build planning
 * persists the `buildsquad_pack` artifact through the JobOrchestrator and renders
 * through the shared design-system `BuildPlanView` (PROCEED / PIVOT / KILL aware).
 */
import { useCallback, useState } from 'react';

import type { BuildSquadArtifactPack, BuildSquadInput } from '@foundry/buildsquad';

import { BuildPlanView } from '../../../components/artifacts';
import {
  LabFrame,
  labUi,
  useElapsedSeconds,
  useVentureLab,
  type VentureLab,
} from '../../../components/labs/LabFrame';

const LAB_PATH = '/labs/buildsquad';

interface Envelope<T> { ok: boolean; data?: T; reason?: string }

export default function BuildSquadPage() {
  const lab = useVentureLab();
  return (
    <LabFrame
      lab={lab}
      labPath={LAB_PATH}
      title="Build Planning"
      description="Turn this venture's validated recommendation into a build-ready artifact pack — product vision, PRD, MVP scope, user stories, architecture, roadmap, and prototype brief — plus cross-agent critique. Pivot and Kill decisions get their own outputs."
      authMessage="Sign in to run build planning for this venture using your own provider key."
    >
      <BuildSquadBody lab={lab} />
    </LabFrame>
  );
}

function BuildSquadBody({ lab }: { lab: VentureLab }) {
  const ctx = lab.context;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pack, setPack] = useState<BuildSquadArtifactPack | null>(null);
  const elapsed = useElapsedSeconds(busy);

  const recommendation = ctx?.recommendation ?? null;
  const researchGraph = ctx?.researchGraph ?? null;
  const hasRecommendation = Boolean(recommendation);
  const canRun = Boolean(lab.selectedProviderId && lab.selectedModel && hasRecommendation && !busy);

  const run = useCallback(async () => {
    if (!recommendation) return;
    setError(null);
    setBusy(true);
    try {
      const payload: BuildSquadInput = researchGraph
        ? { recommendation, researchGraph }
        : { recommendation };
      const r = await fetch('/api/buildsquad', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerCredentialId: lab.selectedProviderId,
          modelId: lab.selectedModel,
          payload,
        }),
      });
      const body = (await r.json()) as Envelope<BuildSquadArtifactPack>;
      if (!body.ok || !body.data) {
        setError(body.reason ?? 'Build planning failed.');
        return;
      }
      setPack(body.data);
      void lab.reloadContext();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Build planning failed.');
    } finally {
      setBusy(false);
    }
  }, [lab, recommendation, researchGraph]);

  if (!ctx) return null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section style={labUi.card}>
        <h3 style={{ marginTop: 0 }}>Inputs for this venture</h3>
        {hasRecommendation ? (
          <ul style={{ ...labUi.muted, margin: '0 0 0.75rem', paddingLeft: '1.1rem', fontSize: '0.88rem' }}>
            <li>Validation decision: <strong style={{ color: '#e8e8ea' }}>{recommendation?.decision}</strong></li>
            <li>{researchGraph ? 'Research graph available (used to enrich the plan)' : 'No research graph yet (optional)'}</li>
          </ul>
        ) : (
          <div style={{ ...labUi.muted, fontSize: '0.9rem' }}>
            <p style={{ marginTop: 0 }}>
              Build planning starts from this venture&rsquo;s validation recommendation. None exists yet.
            </p>
            <a
              href={`/labs/venture?ventureId=${encodeURIComponent(lab.ventureId ?? '')}`}
              style={labUi.primaryBtn}
            >
              Run validation first →
            </a>
          </div>
        )}

        {hasRecommendation ? (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void run()}
              disabled={!canRun}
              style={{ ...labUi.primaryBtn, opacity: canRun ? 1 : 0.6, cursor: canRun ? 'pointer' : 'not-allowed' }}
            >
              {busy ? `Planning… ${elapsed}s` : pack ? 'Re-run build planning' : 'Run build planning'}
            </button>
            {busy ? <span style={{ ...labUi.muted, fontSize: '0.85rem' }}>Assembling the build pack with {lab.selectedModel}. This can take a minute or two.</span> : null}
          </div>
        ) : null}
        {error ? <p style={{ ...labUi.error, margin: '0.75rem 0 0' }}>{error}</p> : null}
      </section>

      {pack ? (
        <section style={labUi.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Build artifact pack</h3>
            <a href={`/ventures/${encodeURIComponent(lab.ventureId ?? '')}`} style={labUi.link}>
              View in venture workspace →
            </a>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <BuildPlanView pack={pack} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
