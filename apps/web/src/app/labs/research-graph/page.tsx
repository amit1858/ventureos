'use client';

/**
 * Research Graph page (Sprint 1F).
 *
 * Users select a BYOK provider, paste research notes / sources, and produce a
 * deterministic ResearchGraph from the Graphify adapter. The graph is shown
 * as a structured panel (stats, sources, top god-nodes, contradictions, full
 * nodes/edges tables) with a keyword query box and a JSON export. Visual
 * canvas rendering is intentionally out-of-scope for this sprint.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  GraphifyInput,
  ResearchGraph,
  ResearchGraphEdge,
  ResearchGraphNode,
  ResearchGraphQueryResult,
} from '@ventureos/adapter-graphify';
import { queryGraph } from '@ventureos/adapter-graphify';

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

const FACELESS_NOTES = [
  'Solo consultants report abandoning HubSpot Free within 30 days due to manual data entry; they prefer WhatsApp follow-ups over structured pipelines.',
  'Micro-agency owners complain that pipeline hygiene erodes after two weeks because their team forgets to update stages — workflow disruption is the #1 reason cited.',
  'Existing competitors: HubSpot Free, Folk, Attio, Pipedrive. All require structured forms. Folk leans into Gmail integration but still asks for stages.',
  'Market signal: r/sales and Indie Hackers threads report >40% CRM abandonment in <90 days for solo operators on $0–$30/mo plans.',
  'Risk: BYOK + inbox read permission is a high-trust posture. Two design-partner candidates declined a 15-minute call when "we will read your sent items" was mentioned.',
].join('\n\n');

const BRIEF = {
  businessIdea: 'Faceless CRM — an AI-first CRM for solo operators and AI-first agencies who never want to see a contact record.',
  targetMarket: 'Solo founders, indie consultants, micro-agencies (1-5 people) running on Gmail/Outlook + a notes app.',
  customerType: 'Owner-led / solo operator',
  region: 'Global (English-speaking)',
  businessSize: '1 to 5 employees',
  additionalContext: 'Zero forms, zero pipeline stages, zero required fields. AI drafts the next reply; the user edits it.',
};

export default function ResearchGraphPage() {
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [providerError, setProviderError] = useState<string | null>(null);

  const [ventureId, setVentureId] = useState('v-faceless-crm');

  // Initialise ventureId from ?ventureId=X when opened from a Venture workspace.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = new URLSearchParams(window.location.search).get('ventureId');
    if (fromUrl) setVentureId(fromUrl);
  }, []);
  const [notes, setNotes] = useState<string>(FACELESS_NOTES);
  const [sourcesJson, setSourcesJson] = useState<string>('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<ResearchGraph | null>(null);

  const [question, setQuestion] = useState('');
  const [queryResult, setQueryResult] = useState<ResearchGraphQueryResult | null>(null);

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

  const build = useCallback(async () => {
    setError(null);
    setBusy(true);
    setGraph(null);
    setQueryResult(null);
    try {
      const noteList = notes.split(/\n\s*\n/).map((s) => s.trim()).filter((s) => s.length > 0);
      let extraSources: GraphifyInput['sources'];
      if (sourcesJson.trim().length > 0) {
        try {
          const parsed = JSON.parse(sourcesJson) as unknown;
          if (!Array.isArray(parsed)) throw new Error('sources JSON must be an array.');
          extraSources = parsed as GraphifyInput['sources'];
        } catch (e) {
          setError(`Sources JSON is invalid: ${e instanceof Error ? e.message : 'parse failed'}`);
          setBusy(false);
          return;
        }
      }

      const payload: GraphifyInput = {
        ventureId,
        brief: BRIEF,
        notes: noteList,
        ...(extraSources ? { sources: extraSources } : {}),
      };
      const r = await fetch('/api/graphify/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerCredentialId: selectedProviderId,
          modelId: selectedModel,
          payload,
        }),
      });
      const body = (await r.json()) as Envelope<ResearchGraph>;
      if (!body.ok || !body.data) {
        setError(body.reason ?? 'Graphify build failed.');
        return;
      }
      setGraph(body.data);
    } finally {
      setBusy(false);
    }
  }, [notes, sourcesJson, selectedModel, selectedProviderId, ventureId]);

  const runQuery = useCallback(() => {
    if (!graph || question.trim().length === 0) return;
    setQueryResult(queryGraph(graph, question, 8));
  }, [graph, question]);

  const downloadJson = useCallback(() => {
    if (!graph) return;
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.graphId ?? 'research-graph'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [graph]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Research Graph</h1>
        <p className="text-sm text-gray-600">
          Transform research notes into a structured graph of problems, segments, competitors, market signals,
          features and opportunities. Used by VentureLab to ground assumption confidence and competitive risk.
        </p>
      </header>

      {providerError && (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          <div>{providerError}</div>
          <div className="mt-2 text-rose-700">
            <a href="/signin?next=/labs/research-graph" className="underline">Sign in with Google</a>
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
            <select className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" value={selectedProviderId} onChange={(e) => setSelectedProviderId(e.target.value)}>
              <option value="">— select —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName} ({p.maskedPreview})</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Model</span>
            <select className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              {(selectedProvider?.availableModels ?? []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="mb-3 text-lg font-medium">Research input</h2>
        <label className="block">
          <span className="text-sm text-gray-700">Venture ID</span>
          <input className="mt-1 w-full rounded border border-gray-300 p-2 text-sm" value={ventureId} onChange={(e) => setVentureId(e.target.value)} />
        </label>
        <label className="mt-3 block">
          <span className="text-sm text-gray-700">Notes (blank line between sources)</span>
          <textarea className="mt-1 w-full rounded border border-gray-300 p-2 font-mono text-xs" rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="mt-3 block">
          <span className="text-sm text-gray-700">Additional sources (optional JSON array of {`{ label, text, kind?, uri? }`})</span>
          <textarea className="mt-1 w-full rounded border border-gray-300 p-2 font-mono text-xs" rows={4} value={sourcesJson} onChange={(e) => setSourcesJson(e.target.value)} placeholder='[{ "label": "Customer interview - Maya", "text": "...", "kind": "interview" }]' />
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={() => void build()} disabled={busy || !selectedProviderId || !selectedModel} className="rounded bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'Building…' : 'Build graph'}
        </button>
        {graph && (
          <button onClick={downloadJson} className="rounded border border-gray-300 px-4 py-2 text-sm">
            Export JSON
          </button>
        )}
        {error && <span className="text-sm text-rose-700">{error}</span>}
      </div>

      {graph && <GraphView graph={graph} />}

      {graph && (
        <section className="rounded border border-gray-200 p-4">
          <h2 className="mb-3 text-lg font-medium">Query</h2>
          <div className="flex gap-2">
            <input className="flex-1 rounded border border-gray-300 p-2 text-sm" placeholder="e.g. pipeline hygiene erodes" value={question} onChange={(e) => setQuestion(e.target.value)} />
            <button onClick={runQuery} className="rounded bg-black px-3 py-2 text-sm text-white">Query</button>
          </div>
          {queryResult && (
            <div className="mt-3 text-sm">
              <div className="mb-1 text-xs text-gray-500">{queryResult.matches.length} match(es)</div>
              <ul className="space-y-1">
                {queryResult.matches.map((n) => (
                  <li key={n.id} className="rounded border border-gray-100 p-2">
                    <div className="font-medium">{n.label} <span className="text-xs text-gray-500">· {n.type}</span></div>
                    {n.summary && <div className="text-xs text-gray-600">{n.summary}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function GraphView({ graph }: { graph: ResearchGraph }) {
  const nodesById = useMemo(() => new Map((graph.nodes ?? []).map((n) => [n.id, n] as const)), [graph]);

  return (
    <article className="space-y-6 rounded border border-gray-300 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Graph</h2>
          <p className="text-xs text-gray-500">{graph.graphId} · {graph.createdAt ? new Date(graph.createdAt).toLocaleString() : ''}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-5">
          <Stat label="Nodes" value={graph.stats.nodes} />
          <Stat label="Edges" value={graph.stats.edges} />
          <Stat label="Communities" value={graph.stats.communities} />
          <Stat label="High-conf" value={graph.stats.confidence.EXTRACTED} />
          <Stat label="Sources" value={graph.sources?.length ?? 0} />
        </div>
      </header>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-600">Strongest signals (god-nodes)</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {graph.godNodes.length === 0 && <li className="text-gray-500">No god-nodes computed.</li>}
          {graph.godNodes.map((g, i) => (
            <li key={i}>{g.label} <span className="text-xs text-gray-500">· degree {g.degree} · community {g.community}</span></li>
          ))}
        </ol>
      </section>

      {graph.contradictions && graph.contradictions.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-rose-700">Contradictions</h3>
          <ul className="space-y-1 text-sm">
            {graph.contradictions.map((c, i) => <li key={i} className="rounded border border-rose-200 bg-rose-50 p-2">{c}</li>)}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-600">Nodes</h3>
        <NodeTable nodes={graph.nodes ?? []} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-600">Edges</h3>
        <EdgeTable edges={graph.edges ?? []} nodesById={nodesById} />
      </section>

      {graph.sources && graph.sources.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-600">Sources</h3>
          <ul className="space-y-1 text-xs">
            {graph.sources.map((s) => (
              <li key={s.id} className="rounded border border-gray-100 p-2">
                <div className="font-medium">{s.label} <span className="text-[10px] uppercase text-gray-500">· {s.kind}</span></div>
                {s.excerpt && <div className="mt-1 text-gray-600">{s.excerpt.slice(0, 220)}{s.excerpt.length > 220 ? '…' : ''}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-200 p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function NodeTable({ nodes }: { nodes: ResearchGraphNode[] }) {
  if (nodes.length === 0) return <p className="text-sm text-gray-500">No nodes.</p>;
  return (
    <table className="w-full table-fixed text-left text-xs">
      <thead className="text-gray-500">
        <tr>
          <th className="w-1/6 py-1">Type</th>
          <th className="w-2/5 py-1">Label</th>
          <th className="w-1/6 py-1">Confidence</th>
          <th className="w-1/4 py-1">Evidence</th>
        </tr>
      </thead>
      <tbody>
        {nodes.map((n) => (
          <tr key={n.id} className="border-t border-gray-100 align-top">
            <td className="py-2 pr-2">{n.type}</td>
            <td className="py-2 pr-2"><div className="font-medium">{n.label}</div>{n.summary && <div className="text-[11px] text-gray-500">{n.summary}</div>}</td>
            <td className="py-2 pr-2">{n.confidence.toFixed(2)}</td>
            <td className="py-2"><div className="text-gray-700">{(n.evidence ?? []).slice(0, 2).join(' · ') || '—'}</div></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EdgeTable({ edges, nodesById }: { edges: ResearchGraphEdge[]; nodesById: Map<string, ResearchGraphNode> }) {
  if (edges.length === 0) return <p className="text-sm text-gray-500">No edges.</p>;
  return (
    <table className="w-full table-fixed text-left text-xs">
      <thead className="text-gray-500">
        <tr>
          <th className="w-1/3 py-1">From</th>
          <th className="w-1/6 py-1">Type</th>
          <th className="w-1/3 py-1">To</th>
          <th className="w-1/6 py-1">Confidence</th>
        </tr>
      </thead>
      <tbody>
        {edges.map((e) => (
          <tr key={e.id} className="border-t border-gray-100">
            <td className="py-1 pr-2">{nodesById.get(e.from)?.label ?? e.from}</td>
            <td className="py-1 pr-2">{e.type}</td>
            <td className="py-1 pr-2">{nodesById.get(e.to)?.label ?? e.to}</td>
            <td className="py-1">{e.confidence.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
