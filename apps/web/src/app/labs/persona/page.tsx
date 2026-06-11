'use client';

/**
 * PersonaLab (Sprint 1D).
 *
 * Source of truth = server. The browser holds no secrets and no encrypted
 * envelopes. It only sends the user's brief + the id of a BYOK credential.
 * Every persona/transcript shown here is the JSON returned by the server.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  PersonaLabBrief,
  PersonaLabPersona,
  InterviewTranscript,
  FocusGroupTranscript,
  BuyingCommitteeTranscript,
  PersonaLabInsights,
  PersonaSetEvaluation,
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
  businessIdea: 'Faceless CRM for SMB',
  targetMarket: 'Small and medium businesses',
  customerType: 'Owner-led sales teams',
  region: 'India',
  businessSize: '5 to 50 employees',
  additionalContext: 'Mobile-first; integrates with WhatsApp Business.',
};

export default function PersonaLabPage() {
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [providerError, setProviderError] = useState<string | null>(null);

  const [tinytroupeAvailable, setTinytroupeAvailable] = useState<boolean>(false);
  const [engine, setEngine] = useState<'builtin' | 'tinytroupe'>('builtin');

  const [brief, setBrief] = useState<PersonaLabBrief>(FACELESS_CRM_BRIEF);
  const [ventureId, setVentureId] = useState<string>('');
  const [n, setN] = useState<number>(6);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [personas, setPersonas] = useState<PersonaLabPersona[]>([]);
  const [interview, setInterview] = useState<InterviewTranscript | null>(null);
  const [focusGroup, setFocusGroup] = useState<FocusGroupTranscript | null>(null);
  const [committee, setCommittee] = useState<BuyingCommitteeTranscript | null>(null);
  const [insights, setInsights] = useState<PersonaLabInsights | null>(null);
  const [evaluation, setEvaluation] = useState<PersonaSetEvaluation | null>(null);

  const [interviewPersonaId, setInterviewPersonaId] = useState<string>('');
  const [interviewTopic, setInterviewTopic] = useState<string>('Current CRM frustrations');
  const [interviewQuestions, setInterviewQuestions] = useState<string>(
    'What does your current sales workflow look like?\nWhat would make you switch CRMs?\nWhat would block adoption in your team?',
  );

  const [focusGroupTopic, setFocusGroupTopic] = useState<string>(
    'Reactions to a Rs. 999/user/month faceless CRM',
  );
  const [offerSummary, setOfferSummary] = useState<string>(
    'Faceless CRM for SMB: WhatsApp + email lead capture, AI-prioritised pipeline, Rs. 999/user/month with a 30-day pilot.',
  );

  // Initial provider list
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

  // Probe whether the TinyTroupe Python bridge is configured on the server.
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/personalab/engine', { cache: 'no-store' });
        if (!r.ok) return;
        const body = await r.json() as { ok?: boolean; engines?: { tinytroupe?: boolean } };
        if (body.ok && body.engines?.tinytroupe) {
          setTinytroupeAvailable(true);
        }
      } catch {
        // Capability probe is best-effort; default to built-in engine.
      }
    })();
  }, []);

  // Initialise ventureId from ?ventureId=X — auto-attaches results to that venture.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = new URLSearchParams(window.location.search).get('ventureId');
    if (fromUrl) setVentureId(fromUrl);
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  );

  // Keep model list aligned with selected provider.
  useEffect(() => {
    if (!selectedProvider) return;
    if (!selectedProvider.availableModels.includes(selectedModel)) {
      setSelectedModel(selectedProvider.availableModels[0] ?? '');
    }
  }, [selectedProvider, selectedModel]);

  const call = useCallback(
    async <T,>(action: string, extra: Record<string, unknown>): Promise<T | null> => {
      setError(null);
      setBusy(action);
      try {
        const payload: Record<string, unknown> = { action, brief, ...extra };
        if (ventureId) payload['ventureId'] = ventureId;
        if (action !== 'validatePersonaSet') {
          payload['providerCredentialId'] = selectedProviderId;
          payload['modelId'] = selectedModel;
          payload['engine'] = engine;
        }
        const r = await fetch('/api/personalab', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = (await r.json()) as Envelope<T>;
        if (!body.ok) {
          setError(body.reason ?? `${action} failed.`);
          return null;
        }
        return (body.data ?? null) as T | null;
      } catch (e) {
        setError(e instanceof Error ? e.message : `${action} failed.`);
        return null;
      } finally {
        setBusy(null);
      }
    },
    [brief, selectedProviderId, selectedModel, engine, ventureId],
  );

  async function generate() {
    const result = await call<PersonaLabPersona[]>('generatePersonas', { n });
    if (result) {
      setPersonas(result);
      setInterviewPersonaId(result[0]?.id ?? '');
      setInterview(null); setFocusGroup(null); setCommittee(null); setInsights(null); setEvaluation(null);
    }
  }

  async function evaluate() {
    const result = await call<PersonaSetEvaluation>('validatePersonaSet', { personas });
    if (result) setEvaluation(result);
  }

  async function interviewSelected() {
    const persona = personas.find((p) => p.id === interviewPersonaId);
    if (!persona) { setError('Select a persona to interview.'); return; }
    const questions = interviewQuestions.split('\n').map((q) => q.trim()).filter(Boolean);
    const result = await call<InterviewTranscript>('runInterview', {
      persona, topic: interviewTopic, questions,
    });
    if (result) setInterview(result);
  }

  async function focusGroupAll() {
    if (personas.length < 2) { setError('Need at least 2 personas for a focus group.'); return; }
    const result = await call<FocusGroupTranscript>('runFocusGroup', {
      personas, topic: focusGroupTopic, rounds: 3,
    });
    if (result) setFocusGroup(result);
  }

  async function committeeAll() {
    if (personas.length < 2) { setError('Need at least 2 personas for a buying committee.'); return; }
    const result = await call<BuyingCommitteeTranscript>('runBuyingCommittee', {
      personas, offerSummary,
    });
    if (result) setCommittee(result);
  }

  async function summarise() {
    if (personas.length === 0) { setError('Generate personas first.'); return; }
    const transcripts = [
      ...(interview ? [interview] : []),
      ...(focusGroup ? [focusGroup] : []),
    ];
    const result = await call<PersonaLabInsights>('extractInsights', { personas, transcripts });
    if (result) setInsights(result);
  }

  return (
    <section style={{ maxWidth: 1080 }}>
      <h1>PersonaLab</h1>
      <p style={{ color: '#9aa0a6' }}>
        Persona generation and buying-committee simulation. All model calls run through your selected
        BYOK provider on the server — the browser never sees plaintext secrets.
      </p>

      {providerError ? (
        <div style={{
          padding: '0.75rem 1rem',
          border: '1px solid #2a2a2a',
          borderRadius: 8,
          background: '#15171c',
          marginBottom: '1rem',
        }}>
          <p style={{ color: '#ef6a6a', margin: 0 }}>{providerError}</p>
          <p style={{ color: '#9aa0a6', margin: '0.5rem 0 0.75rem', fontSize: '0.85rem' }}>
            <a href="/signin?next=/labs/persona" style={{ color: '#7aa3ff' }}>Sign in with Google</a>
            {' · '}
            <a href="/demo" style={{ color: '#7aa3ff' }}>Open Demo Mode</a>
          </p>
        </div>
      ) : null}

      <div style={{ ...cardStyle, marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>1. Provider</h3>
        {providers.length === 0 ? (
          <p style={{ color: '#9aa0a6' }}>
            No active providers found. Add and validate a key on <a href="/settings/byok" style={{ color: '#7aa3ff' }}>/settings/byok</a>.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label>
              Credential
              <select value={selectedProviderId} onChange={(e) => setSelectedProviderId(e.target.value)} style={inputStyle}>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.providerType} — {p.displayName} ({p.maskedPreview})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={inputStyle}>
                {(selectedProvider?.availableModels ?? []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            {tinytroupeAvailable ? (
              <label>
                Engine
                <select
                  value={engine}
                  onChange={(e) => setEngine(e.target.value === 'tinytroupe' ? 'tinytroupe' : 'builtin')}
                  style={inputStyle}
                  title="TinyTroupe routes generate/interview/focus-group/buying-committee through a Python subprocess. Insights and evaluation always run in-process."
                >
                  <option value="builtin">Built-in (chat)</option>
                  <option value="tinytroupe">TinyTroupe (subprocess)</option>
                </select>
              </label>
            ) : null}
          </div>
        )}
      </div>

      <div style={{ ...cardStyle, marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>2. Brief</h3>
        <BriefField label="Business idea"  value={brief.businessIdea}     onChange={(v) => setBrief({ ...brief, businessIdea: v })} />
        <BriefField label="Target market"  value={brief.targetMarket}     onChange={(v) => setBrief({ ...brief, targetMarket: v })} />
        <BriefField label="Customer type"  value={brief.customerType}     onChange={(v) => setBrief({ ...brief, customerType: v })} />
        <BriefField label="Region"         value={brief.region}           onChange={(v) => setBrief({ ...brief, region: v })} />
        <BriefField label="Business size"  value={brief.businessSize}     onChange={(v) => setBrief({ ...brief, businessSize: v })} />
        <BriefField label="Additional context" value={brief.additionalContext ?? ''} onChange={(v) => setBrief({ ...brief, additionalContext: v })} />
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'baseline' }}>
          <label>
            How many personas?
            <input
              type="number" min={3} max={12} value={n}
              onChange={(e) => setN(Math.max(3, Math.min(12, Number(e.target.value) || 6)))}
              style={{ ...inputStyle, width: 80 }}
            />
          </label>
          <button onClick={generate} disabled={busy !== null || !selectedProviderId} style={primaryBtn}>
            {busy === 'generatePersonas' ? 'Generating…' : 'Generate personas'}
          </button>
        </div>
      </div>

      {error ? <p style={{ color: '#ef6a6a', marginTop: '0.75rem' }}>{error}</p> : null}

      {personas.length > 0 ? (
        <div style={{ ...cardStyle, marginTop: '1rem' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>3. Personas ({personas.length})</h3>
            <button onClick={evaluate} disabled={busy !== null} style={secondaryBtn}>
              {busy === 'validatePersonaSet' ? 'Scoring…' : 'Run evaluation'}
            </button>
          </header>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
            {personas.map((p) => <PersonaCard key={p.id} persona={p} />)}
          </div>
          {evaluation ? <EvaluationPanel ev={evaluation} /> : null}
        </div>
      ) : null}

      {personas.length > 0 ? (
        <div style={{ ...cardStyle, marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>4. Interview</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label>
              Persona
              <select value={interviewPersonaId} onChange={(e) => setInterviewPersonaId(e.target.value)} style={inputStyle}>
                {personas.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.role}</option>)}
              </select>
            </label>
            <label>
              Topic
              <input value={interviewTopic} onChange={(e) => setInterviewTopic(e.target.value)} style={inputStyle} />
            </label>
            <label>
              Questions (one per line)
              <textarea
                value={interviewQuestions}
                onChange={(e) => setInterviewQuestions(e.target.value)}
                rows={4}
                style={{ ...inputStyle, fontFamily: 'inherit' }}
              />
            </label>
            <div>
              <button onClick={interviewSelected} disabled={busy !== null} style={primaryBtn}>
                {busy === 'runInterview' ? 'Interviewing…' : 'Run interview'}
              </button>
            </div>
          </div>
          {interview ? <TranscriptPanel title="Interview transcript" turns={interview.turns.map((t) => ({ who: t.speaker, content: t.content }))} summary={interview.summary} /> : null}
        </div>
      ) : null}

      {personas.length > 1 ? (
        <div style={{ ...cardStyle, marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>5. Focus group</h3>
          <label>
            Topic
            <input value={focusGroupTopic} onChange={(e) => setFocusGroupTopic(e.target.value)} style={inputStyle} />
          </label>
          <div style={{ marginTop: '0.5rem' }}>
            <button onClick={focusGroupAll} disabled={busy !== null} style={primaryBtn}>
              {busy === 'runFocusGroup' ? 'Simulating…' : 'Run focus group'}
            </button>
          </div>
          {focusGroup ? (
            <>
              <TranscriptPanel
                title="Focus group transcript"
                turns={focusGroup.turns.map((t) => ({
                  who: personas.find((p) => p.id === t.speakerPersonaId)?.name ?? t.speakerPersonaId,
                  content: t.content,
                }))}
                summary={focusGroup.summary}
              />
              <BulletPair left={{ title: 'Agreements', items: focusGroup.agreements }} right={{ title: 'Disagreements', items: focusGroup.disagreements }} />
            </>
          ) : null}
        </div>
      ) : null}

      {personas.length > 1 ? (
        <div style={{ ...cardStyle, marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>6. Buying committee</h3>
          <label>
            Offer summary
            <textarea
              value={offerSummary}
              onChange={(e) => setOfferSummary(e.target.value)}
              rows={3}
              style={{ ...inputStyle, fontFamily: 'inherit' }}
            />
          </label>
          <div style={{ marginTop: '0.5rem' }}>
            <button onClick={committeeAll} disabled={busy !== null} style={primaryBtn}>
              {busy === 'runBuyingCommittee' ? 'Simulating…' : 'Run buying committee'}
            </button>
          </div>
          {committee ? <CommitteePanel committee={committee} personas={personas} /> : null}
        </div>
      ) : null}

      {personas.length > 0 ? (
        <div style={{ ...cardStyle, marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>7. Insights</h3>
          <button onClick={summarise} disabled={busy !== null} style={primaryBtn}>
            {busy === 'extractInsights' ? 'Summarising…' : 'Extract insights'}
          </button>
          {insights ? <InsightsPanel insights={insights} /> : null}
        </div>
      ) : null}
    </section>
  );
}

// ── widgets ──────────────────────────────────────────────────────────────────

function BriefField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block', marginTop: '0.4rem' }}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}

function PersonaCard({ persona }: { persona: PersonaLabPersona }) {
  return (
    <div style={{ ...cardStyle, background: '#11141a', padding: '0.9rem' }}>
      <h4 style={{ margin: 0 }}>
        {persona.name}
        <span style={{ color: '#9aa0a6', fontWeight: 'normal' }}> · {persona.role}</span>
      </h4>
      <p style={{ margin: '0.25rem 0', color: '#9aa0a6', fontSize: '0.85rem' }}>{persona.businessContext}</p>
      <p style={{ margin: '0.25rem 0', fontStyle: 'italic', color: '#cbd0d4' }}>&ldquo;{persona.quote}&rdquo;</p>
      <Tags label="Pains"      items={persona.painPoints} />
      <Tags label="Goals"      items={persona.goals} />
      <Tags label="Motivations" items={persona.motivations} />
      <Tags label="Objections" items={persona.objections} />
      <Tags label="Triggers"   items={persona.buyingTriggers} />
      <p style={{ margin: '0.5rem 0 0', color: '#9aa0a6', fontSize: '0.8rem' }}>
        Decision power: <strong style={{ color: '#cbd0d4' }}>{persona.decisionPower}</strong> · Confidence: {(persona.confidenceScore * 100).toFixed(0)}%
      </p>
    </div>
  );
}

function Tags({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
      <strong style={{ color: '#9aa0a6' }}>{label}:</strong>{' '}
      <span style={{ color: '#cbd0d4' }}>{items.join(' • ')}</span>
    </p>
  );
}

function TranscriptPanel({ title, turns, summary }: {
  title: string;
  turns: Array<{ who: string; content: string }>;
  summary: string;
}) {
  return (
    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#11141a', borderRadius: 6 }}>
      <h4 style={{ margin: 0 }}>{title}</h4>
      {turns.map((t, i) => (
        <p key={i} style={{ margin: '0.4rem 0', color: '#cbd0d4' }}>
          <strong style={{ color: '#7aa3ff' }}>{t.who}:</strong> {t.content}
        </p>
      ))}
      {summary ? (
        <p style={{ marginTop: '0.5rem', color: '#9aa0a6', fontStyle: 'italic' }}>Summary: {summary}</p>
      ) : null}
    </div>
  );
}

function BulletPair({ left, right }: {
  left: { title: string; items: string[] };
  right: { title: string; items: string[] };
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
      {[left, right].map((col) => (
        <div key={col.title}>
          <strong style={{ color: '#9aa0a6' }}>{col.title}</strong>
          <ul style={{ margin: '0.25rem 0 0 1.25rem', color: '#cbd0d4' }}>
            {col.items.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CommitteePanel({ committee, personas }: { committee: BuyingCommitteeTranscript; personas: PersonaLabPersona[] }) {
  return (
    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#11141a', borderRadius: 6 }}>
      <h4 style={{ margin: 0 }}>
        Decision: <span style={{ color: decisionColor(committee.decision) }}>{committee.decision.toUpperCase()}</span>
      </h4>
      <p style={{ margin: '0.25rem 0 0.75rem', color: '#9aa0a6' }}>{committee.decisionRationale}</p>
      {committee.members.map((m) => {
        const person = personas.find((p) => p.id === m.personaId);
        return (
          <div key={m.personaId} style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #2a2a2a' }}>
            <p style={{ margin: 0 }}>
              <strong>{person?.name ?? m.personaId}</strong> · {m.committeeRole} · <span style={{ color: stanceColor(m.stance) }}>{m.stance}</span>
            </p>
            <p style={{ margin: '0.25rem 0', color: '#cbd0d4' }}>{m.rationale}</p>
            {m.blockingObjections.length > 0 ? (
              <p style={{ margin: 0, color: '#ef6a6a', fontSize: '0.85rem' }}>
                Objections: {m.blockingObjections.join('; ')}
              </p>
            ) : null}
          </div>
        );
      })}
      {committee.nextSteps.length > 0 ? (
        <p style={{ marginTop: '0.75rem', color: '#9aa0a6' }}>
          <strong>Next steps:</strong> {committee.nextSteps.join(' • ')}
        </p>
      ) : null}
      {committee.deliberation ? <DeliberationPanel d={committee.deliberation} personas={personas} /> : null}
    </div>
  );
}

function DeliberationPanel({
  d,
  personas,
}: {
  d: NonNullable<BuyingCommitteeTranscript['deliberation']>;
  personas: PersonaLabPersona[];
}) {
  const nameOf = (id: string) => personas.find((p) => p.id === id)?.name ?? id;
  return (
    <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#0d1015', borderRadius: 6, border: '1px solid #2a2a2a' }}>
      <h4 style={{ margin: 0, color: '#cbd0d4' }}>
        Deliberation · {d.consensusLevel} consensus · confidence {(d.confidenceScore * 100).toFixed(0)}%
      </h4>

      <details style={{ marginTop: '0.5rem' }} open>
        <summary style={{ cursor: 'pointer', color: '#9aa0a6' }}>Phase 1 — Initial positions ({d.phases.initialPositions.length})</summary>
        <ul style={{ margin: '0.25rem 0 0 1.25rem', color: '#cbd0d4' }}>
          {d.phases.initialPositions.map((o, i) => (
            <li key={i}>
              <strong>{nameOf(o.personaId)}</strong> · <span style={{ color: positionColor(o.position) }}>{o.position}</span> · enthusiasm {(o.enthusiasm * 100).toFixed(0)}%
              {o.concerns.length > 0 ? <div style={{ color: '#9aa0a6', fontSize: '0.85rem' }}>Concerns: {o.concerns.join('; ')}</div> : null}
            </li>
          ))}
        </ul>
      </details>

      <details style={{ marginTop: '0.5rem' }}>
        <summary style={{ cursor: 'pointer', color: '#9aa0a6' }}>Phase 2 — Challenges ({d.phases.challenges.length})</summary>
        <ul style={{ margin: '0.25rem 0 0 1.25rem', color: '#cbd0d4' }}>
          {d.phases.challenges.map((c, i) => (
            <li key={i}>
              <strong>{nameOf(c.fromPersonaId)}</strong> → <strong>{nameOf(c.toPersonaId)}</strong> <em style={{ color: '#9aa0a6' }}>({c.topic})</em>
              <div>{c.argument}</div>
            </li>
          ))}
        </ul>
      </details>

      <details style={{ marginTop: '0.5rem' }}>
        <summary style={{ cursor: 'pointer', color: '#9aa0a6' }}>Phase 3 — Responses ({d.phases.responses.length})</summary>
        <ul style={{ margin: '0.25rem 0 0 1.25rem', color: '#cbd0d4' }}>
          {d.phases.responses.map((r, i) => (
            <li key={i}>
              <strong>{nameOf(r.fromPersonaId)}</strong> responds to challenge #{r.challengeIndex + 1}
              {r.changedOpinion ? <span style={{ marginLeft: '0.5rem', padding: '0 0.3rem', background: '#2a6a2a', borderRadius: 3, fontSize: '0.75rem' }}>changed mind</span> : null}
              <div>{r.argument}</div>
            </li>
          ))}
        </ul>
      </details>

      <details style={{ marginTop: '0.5rem' }} open>
        <summary style={{ cursor: 'pointer', color: '#9aa0a6' }}>Phase 4 — Consensus ({d.phases.consensus.length})</summary>
        <ul style={{ margin: '0.25rem 0 0 1.25rem', color: '#cbd0d4' }}>
          {d.phases.consensus.map((o, i) => (
            <li key={i}>
              <strong>{nameOf(o.personaId)}</strong> · <span style={{ color: positionColor(o.position) }}>{o.position}</span> · enthusiasm {(o.enthusiasm * 100).toFixed(0)}%
              <div style={{ color: '#9aa0a6', fontSize: '0.85rem' }}>{o.rationale}</div>
            </li>
          ))}
        </ul>
      </details>

      {d.opinionChanges.length > 0 ? (
        <div style={{ marginTop: '0.5rem' }}>
          <strong style={{ color: '#cbd0d4' }}>Opinion changes:</strong>
          <ul style={{ margin: '0.25rem 0 0 1.25rem', color: '#cbd0d4' }}>
            {d.opinionChanges.map((oc, i) => (
              <li key={i}>
                <strong>{nameOf(oc.personaId)}</strong>: {oc.fromPosition} → {oc.toPosition} — <span style={{ color: '#9aa0a6' }}>{oc.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {d.strongestSupportingArguments.length > 0 ? (
        <Tags label="Strongest supporting" items={d.strongestSupportingArguments} />
      ) : null}
      {d.strongestOpposingArguments.length > 0 ? (
        <Tags label="Strongest opposing" items={d.strongestOpposingArguments} />
      ) : null}
      {d.unresolvedObjections.length > 0 ? (
        <Tags label="Unresolved objections" items={d.unresolvedObjections} />
      ) : null}
      {d.whatWouldChangeMinds.length > 0 ? (
        <Tags label="What would change minds" items={d.whatWouldChangeMinds} />
      ) : null}
    </div>
  );
}

function positionColor(p: string): string {
  switch (p) {
    case 'support': return '#5fd66a';
    case 'support_with_concerns': return '#9ad66a';
    case 'pilot_first': return '#d6c46a';
    case 'reject': return '#ef6a6a';
    default: return '#cbd0d4';
  }
}

function InsightsPanel({ insights }: { insights: PersonaLabInsights }) {
  return (
    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#11141a', borderRadius: 6 }}>
      <Tags label="Top pain points"      items={insights.topPainPoints} />
      <Tags label="Top buying triggers"  items={insights.topBuyingTriggers} />
      <Tags label="Top objections"       items={insights.topObjections} />
      <Tags label="Risks"                items={insights.riskFlags} />
      <p style={{ marginTop: '0.5rem', color: '#cbd0d4' }}>
        <strong>Recommended positioning:</strong> {insights.recommendedPositioning}
      </p>
      <p style={{ margin: '0.25rem 0 0', color: '#9aa0a6', fontSize: '0.85rem' }}>
        Confidence: {(insights.confidence * 100).toFixed(0)}%
      </p>
    </div>
  );
}

function EvaluationPanel({ ev }: { ev: PersonaSetEvaluation }) {
  return (
    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#11141a', borderRadius: 6 }}>
      <h4 style={{ margin: 0 }}>
        Evaluation · overall {(ev.overallScore * 100).toFixed(0)}%
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
        <Metric label="Diversity"           value={ev.diversityScore} />
        <Metric label="Consistency"         value={ev.consistencyScore} />
        <Metric label="Role realism"        value={ev.roleRealismScore} />
        <Metric label="Pain specificity"    value={ev.painPointSpecificityScore} />
        <Metric label="Trigger quality"     value={ev.buyingTriggerQualityScore} />
      </div>
      {ev.contradictions.length > 0 ? (
        <>
          <p style={{ marginTop: '0.5rem', color: '#ef6a6a' }}>Contradictions:</p>
          <ul style={{ margin: '0 0 0 1.25rem', color: '#ef6a6a' }}>
            {ev.contradictions.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </>
      ) : null}
      {ev.warnings.length > 0 ? (
        <details style={{ marginTop: '0.5rem' }}>
          <summary style={{ color: '#9aa0a6', cursor: 'pointer' }}>Warnings ({ev.warnings.length})</summary>
          <ul style={{ margin: '0.25rem 0 0 1.25rem', color: '#9aa0a6' }}>
            {ev.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: '#15171c', padding: '0.5rem 0.75rem', borderRadius: 4 }}>
      <p style={{ margin: 0, color: '#9aa0a6', fontSize: '0.8rem' }}>{label}</p>
      <p style={{ margin: 0, color: '#cbd0d4', fontWeight: 'bold' }}>{(value * 100).toFixed(0)}%</p>
    </div>
  );
}

function decisionColor(d: string): string {
  switch (d) {
    case 'buy':    return '#3ec47a';
    case 'pilot':  return '#7aa3ff';
    case 'defer':  return '#e0a64a';
    case 'reject': return '#ef6a6a';
    default:       return '#9aa0a6';
  }
}

function stanceColor(s: string): string {
  switch (s) {
    case 'champion':  return '#3ec47a';
    case 'supporter': return '#7aa3ff';
    case 'skeptic':   return '#e0a64a';
    case 'blocker':   return '#ef6a6a';
    default:          return '#9aa0a6';
  }
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: '0.25rem',
  padding: '0.5rem 0.75rem', background: '#1a1a1f', color: '#e8e8ea',
  border: '1px solid #2a2a2a', borderRadius: 6,
};
const cardStyle: React.CSSProperties = {
  padding: '1rem 1.25rem', border: '1px solid #2a2a2a',
  borderRadius: 8, background: '#15171c',
};
const primaryBtn: React.CSSProperties = {
  padding: '0.5rem 0.9rem', background: '#3a6bdc', color: 'white',
  border: 0, borderRadius: 6, cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  padding: '0.45rem 0.8rem', background: '#1f232b', color: '#cbd0d4',
  border: '1px solid #2a2a2a', borderRadius: 6, cursor: 'pointer',
};
