'use client';

/**
 * VentureLab (Sprint 1E).
 *
 * Decision-making and venture validation surface. Consumes a brief + personas
 * + (optional) buying-committee transcript and renders a single auditable
 * recommendation: PROCEED | PIVOT | KILL with scorecard, evidence,
 * counter-signals, assumptions, risks, and a prioritised next-steps roadmap.
 *
 * The browser never sees the decrypted BYOK secret. Personas + committee
 * are typically pasted from the PersonaLab page (or loaded as the bundled
 * Faceless CRM defaults) so VentureLab can run end-to-end without manual
 * persona generation.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  BuyingCommitteeTranscript,
  PersonaLabBrief,
  PersonaLabPersona,
  VentureRecommendation,
} from '@ventureos/contracts';

interface ProviderProfile {
  id: string;
  providerType: string;
  displayName: string;
  maskedPreview: string;
  validationStatus: 'pending' | 'active' | 'invalid' | 'revoked';
  availableModels: string[];
  isDefault: boolean;
}

interface Envelope<T> { ok: boolean; data?: T; reason?: string }

const FACELESS_CRM_BRIEF: PersonaLabBrief = {
  businessIdea: 'Faceless CRM — an AI-first CRM for solo operators and AI-first agencies who never want to see a contact record.',
  targetMarket: 'Solo founders, indie consultants, micro-agencies (1-5 people) running on Gmail/Outlook + a notes app.',
  customerType: 'Owner-led / solo operator',
  region: 'Global (English-speaking)',
  businessSize: '1 to 5 employees',
  additionalContext: 'Zero forms, zero pipeline stages, zero required fields. AI drafts the next reply; the user edits it.',
};

const SAMPLE_PERSONAS_JSON = JSON.stringify(
  [
    {
      id: 'p1', name: 'Maya', role: 'Solo consultant',
      businessContext: 'Independent strategy consultant, 6 active clients.',
      goals: ['Spend less time on admin', 'Never miss a follow-up'],
      painPoints: ['Manual CRM data entry kills 30 minutes a day; I abandoned the last 3 CRMs'],
      motivations: ['Stay in flow'],
      objections: ['I have tried four CRMs and abandoned every single one'],
      buyingTriggers: ['Lost a $12k retainer because I forgot to follow up'],
      decisionPower: 'high',
      quote: 'Just tell me what to say next.',
      confidenceScore: 0.85,
      evidenceNotes: [],
    },
  ],
  null,
  2,
);

const decisionColor: Record<VentureRecommendation['decision'], string> = {
  PROCEED: 'bg-green-100 text-green-800 border-green-300',
  PIVOT:   'bg-amber-100 text-amber-800 border-amber-300',
  KILL:    'bg-rose-100 text-rose-800 border-rose-300',
};

export default function VentureLabPage() {
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [providerError, setProviderError] = useState<string | null>(null);

  const [brief, setBrief] = useState<PersonaLabBrief>(FACELESS_CRM_BRIEF);
  const [ventureId, setVentureId] = useState<string>('v-faceless-crm');

  // Initialise ventureId from ?ventureId=X when opened from a Venture workspace.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = new URLSearchParams(window.location.search).get('ventureId');
    if (fromUrl) setVentureId(fromUrl);
  }, []);
  const [personasJson, setPersonasJson] = useState<string>(SAMPLE_PERSONAS_JSON);
  const [committeeJson, setCommitteeJson] = useState<string>('');

  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<VentureRecommendation | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/byok/providers', { cache: 'no-store' });
        if (r.status === 401) {
          setProviderError('Real Mode requires sign-in. Sign in with Google for a private workspace, or use Demo Mode without any keys.');
          return;
        }
        const body = await r.json() as { profiles?: ProviderProfile[] };
        const list = (body.profiles ?? []).filter((p) => p.validationStatus === 'active');
        setProviders(list);
        const def = list.find((p) => p.isDefault) ?? list[0];
        if (def) {
          setSelectedProviderId(def.id);
          setSelectedModel(def.availableModels[0] ?? '');
        }
      } catch (e) {
        setProviderError(e instanceof Error ? e.message : 'Failed to load providers.');
      }
    })();
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  );

  useEffect(() => {
    if (!selectedProvider) return;
    if (!selectedProvider.availableModels.includes(selectedModel)) {
      setSelectedModel(selectedProvider.availableModels[0] ?? '');
    }
  }, [selectedProvider, selectedModel]);

  const analyze = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      let personas: PersonaLabPersona[];
      try {
        const parsed = JSON.parse(personasJson) as unknown;
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('personas JSON must be a non-empty array.');
        }
        personas = parsed as PersonaLabPersona[];
      } catch (e) {
        setError(`Personas JSON is invalid: ${e instanceof Error ? e.message : 'parse failed'}`);
        setBusy(false);
        return;
      }

      let committee: BuyingCommitteeTranscript | undefined;
      if (committeeJson.trim().length > 0) {
        try {
          committee = JSON.parse(committeeJson) as BuyingCommitteeTranscript;
        } catch (e) {
          setError(`Committee JSON is invalid: ${e instanceof Error ? e.message : 'parse failed'}`);
          setBusy(false);
          return;
        }
      }

      const payload = {
        ventureId,
        brief,
        personas,
        ...(committee ? { committee } : {}),
      };

      const r = await fetch('/api/venturelab', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerCredentialId: selectedProviderId,
          modelId: selectedModel,
          payload,
        }),
      });
      const body = (await r.json()) as Envelope<VentureRecommendation>;
      if (!body.ok || !body.data) {
        setError(body.reason ?? 'VentureLab analyse failed.');
        return;
      }
      setRecommendation(body.data);
    } finally {
      setBusy(false);
    }
  }, [brief, committeeJson, personasJson, selectedModel, selectedProviderId, ventureId]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">VentureLab</h1>
        <p className="text-sm text-gray-600">
          Should we <strong>Proceed</strong>, <strong>Pivot</strong>, or <strong>Kill</strong>?
          Evidence-based, deterministic, explainable.
        </p>
      </header>

      {providerError && (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          <div>{providerError}</div>
          <div className="mt-2 text-rose-700">
            <a href="/signin?next=/labs/venture" className="underline">Sign in with Google</a>
            {' · '}
            <a href="/demo" className="underline">Open Demo Mode</a>
          </div>
        </div>
      )}

      <section className="rounded border border-gray-200 p-4">
        <h2 className="mb-3 text-lg font-medium">Provider</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-gray-700">BYOK provider</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
            >
              <option value="">— select —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName} ({p.maskedPreview})</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Model</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {(selectedProvider?.availableModels ?? []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="mb-3 text-lg font-medium">Brief</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-gray-700">Venture ID</span>
            <input
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              value={ventureId}
              onChange={(e) => setVentureId(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Region</span>
            <input
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              value={brief.region}
              onChange={(e) => setBrief({ ...brief, region: e.target.value })}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm text-gray-700">Business idea</span>
            <textarea
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              rows={2}
              value={brief.businessIdea}
              onChange={(e) => setBrief({ ...brief, businessIdea: e.target.value })}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm text-gray-700">Target market</span>
            <textarea
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              rows={2}
              value={brief.targetMarket}
              onChange={(e) => setBrief({ ...brief, targetMarket: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Customer type</span>
            <input
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              value={brief.customerType}
              onChange={(e) => setBrief({ ...brief, customerType: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Business size</span>
            <input
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              value={brief.businessSize}
              onChange={(e) => setBrief({ ...brief, businessSize: e.target.value })}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm text-gray-700">Additional context</span>
            <textarea
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              rows={2}
              value={brief.additionalContext ?? ''}
              onChange={(e) => setBrief({ ...brief, additionalContext: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="mb-3 text-lg font-medium">Personas (JSON)</h2>
        <p className="mb-2 text-xs text-gray-600">
          Paste the output of <code>PersonaLab.generatePersonas</code> — typed array of <code>PersonaLabPersona</code>.
        </p>
        <textarea
          className="w-full rounded border border-gray-300 p-2 font-mono text-xs"
          rows={8}
          value={personasJson}
          onChange={(e) => setPersonasJson(e.target.value)}
        />
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="mb-3 text-lg font-medium">Buying committee (optional JSON)</h2>
        <p className="mb-2 text-xs text-gray-600">
          Paste the output of <code>PersonaLab.runBuyingCommittee</code>. Leave blank to skip committee-derived signals.
        </p>
        <textarea
          className="w-full rounded border border-gray-300 p-2 font-mono text-xs"
          rows={6}
          value={committeeJson}
          onChange={(e) => setCommitteeJson(e.target.value)}
          placeholder='{ "offerSummary": "...", "members": [...], "decision": "buy", ... }'
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void analyze()}
          disabled={busy || !selectedProviderId || !selectedModel}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Analysing…' : 'Analyse venture'}
        </button>
        {error && <span className="text-sm text-rose-700">{error}</span>}
      </div>

      {recommendation && <RecommendationView rec={recommendation} />}
    </div>
  );
}

function RecommendationView({ rec }: { rec: VentureRecommendation }) {
  return (
    <article className="space-y-6 rounded border border-gray-300 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Recommendation</h2>
          <p className="text-xs text-gray-500">{rec.recommendationId} · {new Date(rec.createdAt).toLocaleString()}</p>
        </div>
        <div className={`rounded-full border px-4 py-1 text-sm font-semibold ${decisionColor[rec.decision]}`}>
          {rec.decision}
        </div>
      </header>

      <section>
        <h3 className="mb-1 text-sm font-medium uppercase tracking-wide text-gray-600">Executive summary</h3>
        <p className="text-sm">{rec.executiveSummary}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Metric label="Composite" value={`${rec.overallScore}/100`} />
          <Metric label="Confidence" value={`${Math.round(rec.confidenceScore * 100)}%`} />
          <Metric label="Evidence items" value={String(rec.evidence.length)} />
          <Metric label="Risks" value={String(rec.risks.length)} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-600">Scorecard</h3>
        <div className="space-y-2">
          {rec.scores.map((s) => (
            <ScoreBar key={s.dimension} dimension={s.dimension} score={s.score} higherIsBetter={s.higherIsBetter} explanation={s.explanation} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-600">Decision rationale</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {rec.decisionRationale.map((r, i) => <li key={i}>{r}</li>)}
        </ol>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <EvidenceList title="Supporting evidence" items={rec.evidence} emptyMessage="No supporting evidence extracted." />
        <EvidenceList title="Counter-signals" items={rec.counterSignals} emptyMessage="No counter-signals extracted." />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-600">Assumption register</h3>
        {rec.assumptions.length === 0 ? (
          <p className="text-sm text-gray-500">No assumptions surfaced.</p>
        ) : (
          <table className="w-full table-fixed text-left text-xs">
            <thead className="text-gray-500">
              <tr><th className="w-2/5 py-1">Assumption</th><th className="py-1">Type</th><th className="py-1">Risk</th><th className="py-1">Confidence</th><th className="w-1/3 py-1">Validation</th></tr>
            </thead>
            <tbody>
              {rec.assumptions.map((a) => (
                <tr key={a.id} className="border-t border-gray-100 align-top">
                  <td className="py-2 pr-2">{a.text}</td>
                  <td className="py-2 pr-2">{a.type}</td>
                  <td className="py-2 pr-2">{a.riskLevel}</td>
                  <td className="py-2 pr-2">{a.confidence}</td>
                  <td className="py-2">{a.validationStrategy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-600">Risk register</h3>
        {rec.risks.length === 0 ? (
          <p className="text-sm text-gray-500">No risks generated for this profile.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rec.risks.map((r) => (
              <li key={r.id} className="rounded border border-gray-200 p-2">
                <div className="font-medium">{r.risk}</div>
                <div className="text-xs text-gray-600">Impact: {r.impact} · Likelihood: {r.likelihood}</div>
                <div className="mt-1 text-xs"><span className="font-medium">Mitigation:</span> {r.mitigation}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-600">Validation roadmap</h3>
        <ol className="space-y-2 text-sm">
          {rec.nextSteps.map((s) => (
            <li key={s.id} className="rounded border border-gray-200 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{s.title}</div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 ${s.priority === 1 ? 'bg-rose-100 text-rose-800' : s.priority === 2 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                    P{s.priority}{s.blocksDecision ? ' · blocking' : ''}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5">{s.category}</span>
                  <span className="rounded bg-gray-100 px-2 py-0.5">effort: {s.effort}</span>
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-700">{s.rationale}</div>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 p-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function ScoreBar({
  dimension, score, higherIsBetter, explanation,
}: { dimension: string; score: number; higherIsBetter: boolean; explanation: string }) {
  // For friction/risk dimensions we visually invert (higher = worse → display as
  // shorter bar with warning colour) so the eye reads "good" left→right.
  const display = higherIsBetter ? score : 100 - score;
  const colour = display >= 70 ? 'bg-green-500' : display >= 45 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{dimension}{higherIsBetter ? '' : ' (lower is better)'}</span>
        <span className="text-gray-600">{score}/100</span>
      </div>
      <div className="mt-1 h-2 w-full rounded bg-gray-100">
        <div className={`h-2 rounded ${colour}`} style={{ width: `${display}%` }} />
      </div>
      <div className="mt-1 text-xs text-gray-600">{explanation}</div>
    </div>
  );
}

function EvidenceList({
  title, items, emptyMessage,
}: { title: string; items: VentureRecommendation['evidence']; emptyMessage: string }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-600">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {items.map((e, i) => (
            <li key={i} className="rounded border border-gray-200 p-2">
              <div className="text-gray-800">“{e.quote}”</div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                {e.kind} · {e.source} · weight {(e.weight ?? 0).toFixed(2)}
                {e.confidence ? ` · ${e.confidence} confidence` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
