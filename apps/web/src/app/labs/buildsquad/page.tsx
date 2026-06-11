'use client';

/**
 * BuildSquad page (Sprint 2A).
 *
 * Users paste a VentureRecommendation (the JSON exported from the VentureLab
 * page) and run BuildSquad. The page renders the full artifact pack —
 * product vision, PRD, MVP scope, user stories, architecture, roadmap and
 * prototype brief — and the cross-agent critique table. PIVOT and KILL
 * branches render their dedicated outputs instead.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  BuildSquadArtifactPack,
  BuildSquadInput,
} from '@ventureos/buildsquad';
import type { ResearchGraph, VentureRecommendation } from '@ventureos/contracts';

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

export default function BuildSquadPage() {
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [providerError, setProviderError] = useState<string | null>(null);

  const [recommendationJson, setRecommendationJson] = useState('');
  const [researchGraphJson, setResearchGraphJson] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pack, setPack] = useState<BuildSquadArtifactPack | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/byok/providers', { cache: 'no-store' });
        if (r.status === 401) {
          setProviderError('Real Mode requires workspace access. Continue to the alpha workspace to use BuildSquad, or open Demo Mode.');
          return;
        }
        const body = (await r.json()) as { profiles?: ProviderProfile[] };
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

  // When opened from a Venture workspace (?ventureId=X), auto-load the latest
  // recommendation + research graph attached to that venture. No JSON paste.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = new URLSearchParams(window.location.search).get('ventureId');
    if (!id) return;
    void (async () => {
      try {
        const [recR, graphR] = await Promise.all([
          fetch(`/api/ventures/${encodeURIComponent(id)}/artifacts?kind=venture_recommendation&latest=1`, { cache: 'no-store' }),
          fetch(`/api/ventures/${encodeURIComponent(id)}/artifacts?kind=research_graph&latest=1`, { cache: 'no-store' }),
        ]);
        const rec = await recR.json() as { ok: boolean; artifact?: { payload: unknown } | null };
        const gr = await graphR.json() as { ok: boolean; artifact?: { payload: unknown } | null };
        if (rec.ok && rec.artifact?.payload) {
          setRecommendationJson(JSON.stringify(rec.artifact.payload, null, 2));
        }
        if (gr.ok && gr.artifact?.payload) {
          setResearchGraphJson(JSON.stringify(gr.artifact.payload, null, 2));
        }
      } catch {
        // Best-effort prefill; user can still paste manually.
      }
    })();
  }, []);

  const run = useCallback(async () => {
    setError(null);
    setBusy(true);
    setPack(null);
    try {
      let recommendation: VentureRecommendation;
      try {
        recommendation = JSON.parse(recommendationJson) as VentureRecommendation;
      } catch (e) {
        setError(`Recommendation JSON is invalid: ${e instanceof Error ? e.message : 'parse failed'}`);
        return;
      }
      let researchGraph: ResearchGraph | undefined;
      if (researchGraphJson.trim().length > 0) {
        try {
          researchGraph = JSON.parse(researchGraphJson) as ResearchGraph;
        } catch (e) {
          setError(`Research Graph JSON is invalid: ${e instanceof Error ? e.message : 'parse failed'}`);
          return;
        }
      }
      const payload: BuildSquadInput = researchGraph
        ? { recommendation, researchGraph }
        : { recommendation };
      const r = await fetch('/api/buildsquad', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerCredentialId: selectedProviderId,
          modelId: selectedModel,
          payload,
        }),
      });
      const body = (await r.json()) as Envelope<BuildSquadArtifactPack>;
      if (!body.ok || !body.data) {
        setError(body.reason ?? 'BuildSquad call failed.');
        return;
      }
      setPack(body.data);
    } finally {
      setBusy(false);
    }
  }, [recommendationJson, researchGraphJson, selectedModel, selectedProviderId]);

  const downloadJson = useCallback(() => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pack.artifactId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pack]);

  const copyMarkdown = useCallback(() => {
    if (!pack) return;
    void navigator.clipboard.writeText(packToMarkdown(pack));
  }, [pack]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">BuildSquad</h1>
        <p className="text-sm text-gray-600">
          Turn a validated VentureLab recommendation into a build-ready artifact pack
          (product vision, PRD, MVP scope, user stories, architecture, roadmap, prototype brief)
          plus cross-agent critique. PIVOT and KILL recommendations get dedicated outputs.
        </p>
      </header>

      {providerError && (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          <div>{providerError}</div>
          <div className="mt-2 text-rose-700">
            <a href="/access?next=/labs/buildsquad" className="underline">Continue to Alpha Workspace</a>
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
        <h2 className="mb-3 text-lg font-medium">Inputs</h2>
        <label className="block">
          <span className="text-sm text-gray-700">VentureRecommendation JSON (exported from /labs/venture)</span>
          <textarea className="mt-1 w-full rounded border border-gray-300 p-2 font-mono text-xs" rows={8} value={recommendationJson} onChange={(e) => setRecommendationJson(e.target.value)} placeholder='{"kind":"VentureRecommendation",...}' />
        </label>
        <label className="mt-3 block">
          <span className="text-sm text-gray-700">ResearchGraph JSON (optional, exported from /labs/research-graph)</span>
          <textarea className="mt-1 w-full rounded border border-gray-300 p-2 font-mono text-xs" rows={4} value={researchGraphJson} onChange={(e) => setResearchGraphJson(e.target.value)} placeholder='{"graphId":"g-...","nodes":[...]}' />
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={() => void run()} disabled={busy || !selectedProviderId || !selectedModel} className="rounded bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'Running…' : 'Run BuildSquad'}
        </button>
        {pack && (
          <>
            <button onClick={downloadJson} className="rounded border border-gray-300 px-4 py-2 text-sm">Export JSON</button>
            <button onClick={copyMarkdown} className="rounded border border-gray-300 px-4 py-2 text-sm">Copy Markdown</button>
          </>
        )}
        {error && <span className="text-sm text-rose-700">{error}</span>}
      </div>

      {pack && <PackView pack={pack} />}
    </div>
  );
}

function PackView({ pack }: { pack: BuildSquadArtifactPack }) {
  return (
    <article className="space-y-6 rounded border border-gray-300 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Artifact Pack</h2>
          <p className="text-xs text-gray-500">{pack.artifactId} · {new Date(pack.createdAt).toLocaleString()} · mode <ModeBadge mode={pack.mode} /></p>
        </div>
      </header>

      <Section title="Product Vision">
        <p><strong>Problem:</strong> {pack.productVision.problem || '—'}</p>
        <p><strong>Promise:</strong> {pack.productVision.productPromise || '—'}</p>
        <p><strong>Why now:</strong> {pack.productVision.whyNow || '—'}</p>
        <p><strong>Target users:</strong> {(pack.productVision.targetUsers ?? []).join(', ') || '—'}</p>
        <List label="Differentiation" items={pack.productVision.differentiation} />
        <List label="Success metrics" items={pack.productVision.successMetrics} />
      </Section>

      {pack.mode === 'kill' && pack.kill && (
        <>
          <Section title="Kill Rationale"><List items={pack.kill.killRationale} /></Section>
          <Section title="Learning Summary"><List items={pack.kill.learningSummary} /></Section>
          <Section title="Alternative Ideas">
            <ul className="space-y-2 text-sm">
              {pack.kill.alternativeIdeas.map((a, i) => (
                <li key={i} className="rounded border border-gray-100 p-2"><div className="font-medium">{a.title}</div><div className="text-xs text-gray-600">{a.rationale}</div></li>
              ))}
            </ul>
          </Section>
          <Section title="Validation Gaps"><List items={pack.kill.validationGaps} /></Section>
        </>
      )}

      {pack.mode === 'pivot' && pack.pivot && (
        <>
          <Section title="Pivot Brief"><p>{pack.pivot.pivotBrief}</p></Section>
          <Section title="Revised Problem Statement"><p>{pack.pivot.revisedProblemStatement}</p></Section>
          <Section title="Revised MVP Direction"><p>{pack.pivot.revisedMvpDirection}</p></Section>
          <Section title="Validation Plan">
            <ul className="space-y-2 text-sm">
              {pack.pivot.validationPlan.map((v) => (
                <li key={v.id} className="rounded border border-gray-100 p-2"><div className="font-medium">{v.title}</div><div className="text-xs text-gray-600">{v.rationale}</div></li>
              ))}
            </ul>
          </Section>
        </>
      )}

      {pack.mode === 'proceed' && (
        <>
          {pack.prd && (
            <Section title="PRD">
              <p>{pack.prd.overview}</p>
              <List label="Goals" items={pack.prd.goals} />
              <List label="Non-goals" items={pack.prd.nonGoals} />
              <h4 className="mt-2 text-sm font-medium">Requirements</h4>
              <ul className="space-y-1 text-sm">
                {pack.prd.requirements.map((r) => (
                  <li key={r.id} className="rounded border border-gray-100 p-2"><span className="text-[10px] uppercase text-gray-500">{r.type}</span><div>{r.text}</div></li>
                ))}
              </ul>
              <h4 className="mt-2 text-sm font-medium">User journeys</h4>
              <ul className="space-y-1 text-sm">
                {pack.prd.userJourneys.map((j) => (
                  <li key={j.id} className="rounded border border-gray-100 p-2"><div className="font-medium">{j.title}{j.personaId ? ` · ${j.personaId}` : ''}</div><ol className="ml-5 list-decimal text-xs text-gray-600">{j.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></li>
                ))}
              </ul>
              <List label="Metrics" items={pack.prd.metrics} />
              <List label="Risks" items={pack.prd.risks} />
            </Section>
          )}
          {pack.mvpScope && (
            <Section title="MVP Scope">
              <List label="Must" items={pack.mvpScope.mustHave} />
              <List label="Should" items={pack.mvpScope.shouldHave} />
              <List label="Later" items={pack.mvpScope.later} />
              <h4 className="mt-2 text-sm font-medium">Explicit cuts</h4>
              <ul className="space-y-1 text-sm">
                {pack.mvpScope.explicitCuts.map((c, i) => (
                  <li key={i} className="rounded border border-gray-100 p-2"><div className="font-medium">{c.item}</div><div className="text-xs text-gray-600">{c.reason}</div></li>
                ))}
              </ul>
            </Section>
          )}
          {pack.userStories && pack.userStories.length > 0 && (
            <Section title="User Stories">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="text-gray-500"><tr><th className="w-1/12 py-1">Pri</th><th className="w-1/4 py-1">Title</th><th className="w-1/3 py-1">Story</th><th className="w-1/3 py-1">Acceptance</th></tr></thead>
                <tbody>
                  {pack.userStories.map((s) => (
                    <tr key={s.id} className="border-t border-gray-100 align-top">
                      <td className="py-2 pr-2 uppercase">{s.priority}</td>
                      <td className="py-2 pr-2">{s.title}</td>
                      <td className="py-2 pr-2">{s.story}</td>
                      <td className="py-2"><ul className="list-disc pl-4">{s.acceptanceCriteria.map((a, i) => <li key={i}>{a}</li>)}</ul></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
          {pack.architectureBrief && (
            <Section title="Architecture Brief">
              <h4 className="text-sm font-medium">Components</h4>
              <ul className="space-y-1 text-sm">
                {pack.architectureBrief.components.map((c, i) => (
                  <li key={i} className="rounded border border-gray-100 p-2"><div className="font-medium">{c.name}</div><div className="text-xs text-gray-600">{c.responsibility}</div></li>
                ))}
              </ul>
              <List label="Data flow" items={pack.architectureBrief.dataFlow} />
              <List label="Integrations" items={pack.architectureBrief.integrations} />
              <List label="Storage" items={pack.architectureBrief.storage} />
              <List label="Security" items={pack.architectureBrief.security} />
              <List label="Scalability assumptions" items={pack.architectureBrief.scalabilityAssumptions} />
            </Section>
          )}
          {pack.roadmap && (
            <Section title="Roadmap">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                {pack.roadmap.weeks.map((w) => (
                  <div key={w.week} className="rounded border border-gray-200 p-3 text-xs"><div className="text-[10px] uppercase text-gray-500">Week {w.week}</div><div className="font-medium">{w.theme || '—'}</div><ul className="ml-4 list-disc">{w.deliverables.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
                ))}
              </div>
              <List label="Future backlog" items={pack.roadmap.futureBacklog} />
            </Section>
          )}
          {pack.prototypeBrief && (
            <Section title="Prototype Brief">
              <h4 className="text-sm font-medium">Pages</h4>
              <ul className="space-y-1 text-sm">
                {pack.prototypeBrief.pages.map((p, i) => <li key={i} className="rounded border border-gray-100 p-2"><div className="font-medium">{p.name}</div><div className="text-xs text-gray-600">{p.purpose}</div></li>)}
              </ul>
              <h4 className="mt-2 text-sm font-medium">Flows</h4>
              <ul className="space-y-1 text-sm">
                {pack.prototypeBrief.flows.map((f, i) => <li key={i} className="rounded border border-gray-100 p-2"><div className="font-medium">{f.name}</div><ol className="ml-5 list-decimal text-xs text-gray-600">{f.steps.map((s, j) => <li key={j}>{s}</li>)}</ol></li>)}
              </ul>
              <List label="UI components" items={pack.prototypeBrief.uiComponents} />
              <p className="mt-2 text-sm"><strong>Demo:</strong> {pack.prototypeBrief.demoScenario}</p>
            </Section>
          )}
        </>
      )}

      {pack.agentCritiques.length > 0 && (
        <Section title="Agent Critiques">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="text-gray-500"><tr><th className="w-1/12 py-1">Role</th><th className="w-1/6 py-1">Section</th><th className="w-1/12 py-1">Severity</th><th className="w-2/3 py-1">Comment / Suggestion</th></tr></thead>
            <tbody>
              {pack.agentCritiques.map((c, i) => (
                <tr key={i} className={`border-t border-gray-100 align-top ${c.severity === 'blocker' ? 'bg-rose-50' : c.severity === 'warning' ? 'bg-amber-50' : ''}`}>
                  <td className="py-1 pr-2 uppercase">{c.role}</td>
                  <td className="py-1 pr-2">{c.targetSection}</td>
                  <td className="py-1 pr-2 uppercase">{c.severity}</td>
                  <td className="py-1">{c.comment}{c.suggestion ? <div className="text-[11px] text-gray-600">→ {c.suggestion}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Rationale">
        <ul className="list-disc pl-5 text-xs text-gray-600">{pack.rationale.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-600">{title}</h3>
      <div className="space-y-1 text-sm">{children}</div>
    </section>
  );
}

function List({ items, label }: { items: string[]; label?: string }) {
  if (!items || items.length === 0) return label ? <p className="text-xs text-gray-500"><strong>{label}:</strong> —</p> : null;
  return (
    <div>
      {label && <h4 className="mt-2 text-sm font-medium">{label}</h4>}
      <ul className="ml-5 list-disc text-sm text-gray-700">{items.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
    </div>
  );
}

function ModeBadge({ mode }: { mode: BuildSquadArtifactPack['mode'] }) {
  const cls = mode === 'proceed' ? 'bg-emerald-100 text-emerald-800'
    : mode === 'pivot' ? 'bg-amber-100 text-amber-800'
    : 'bg-rose-100 text-rose-800';
  return <span className={`ml-1 rounded px-2 py-0.5 text-[10px] uppercase ${cls}`}>{mode}</span>;
}

function packToMarkdown(p: BuildSquadArtifactPack): string {
  const lines: string[] = [];
  lines.push(`# BuildSquad Artifact Pack — ${p.ventureId}`);
  lines.push(`Mode: **${p.mode.toUpperCase()}** · Created: ${p.createdAt}`);
  lines.push('');
  lines.push('## Product Vision');
  lines.push(`- Problem: ${p.productVision.problem}`);
  lines.push(`- Promise: ${p.productVision.productPromise}`);
  lines.push(`- Why now: ${p.productVision.whyNow}`);
  if (p.productVision.differentiation.length) lines.push(`- Differentiation: ${p.productVision.differentiation.join('; ')}`);
  if (p.productVision.successMetrics.length) lines.push(`- Success metrics: ${p.productVision.successMetrics.join('; ')}`);
  if (p.mvpScope) {
    lines.push('', '## MVP Scope');
    lines.push('### Must');
    p.mvpScope.mustHave.forEach((m) => lines.push(`- ${m}`));
    lines.push('### Should');
    p.mvpScope.shouldHave.forEach((m) => lines.push(`- ${m}`));
    lines.push('### Later');
    p.mvpScope.later.forEach((m) => lines.push(`- ${m}`));
    if (p.mvpScope.explicitCuts.length) {
      lines.push('### Explicit cuts');
      p.mvpScope.explicitCuts.forEach((c) => lines.push(`- ${c.item} — ${c.reason}`));
    }
  }
  if (p.userStories?.length) {
    lines.push('', '## User Stories');
    p.userStories.forEach((s) => {
      lines.push(`### [${s.priority.toUpperCase()}] ${s.title}`);
      lines.push(s.story);
      s.acceptanceCriteria.forEach((a) => lines.push(`- AC: ${a}`));
    });
  }
  if (p.architectureBrief) {
    lines.push('', '## Architecture Brief');
    p.architectureBrief.components.forEach((c) => lines.push(`- ${c.name} — ${c.responsibility}`));
  }
  if (p.roadmap) {
    lines.push('', '## Roadmap');
    p.roadmap.weeks.forEach((w) => {
      lines.push(`### Week ${w.week} — ${w.theme}`);
      w.deliverables.forEach((d) => lines.push(`- ${d}`));
    });
  }
  if (p.agentCritiques.length) {
    lines.push('', '## Agent Critiques');
    p.agentCritiques.forEach((c) => lines.push(`- **${c.role.toUpperCase()}** [${c.severity}] (${c.targetSection}): ${c.comment}`));
  }
  return lines.join('\n');
}
