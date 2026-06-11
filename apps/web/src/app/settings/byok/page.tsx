'use client';

/**
 * BYOK settings page (Sprint 1C).
 *
 * Source of truth = server. The browser holds no secrets and no encrypted blobs;
 * it only renders ProviderProfile rows fetched from `/api/byok/providers`. The
 * plaintext secret lives in component state for one round-trip during create or
 * rotate, then is dropped.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProviderId } from '@ventureos/contracts';

const PROVIDERS: ProviderId[] = ['openai', 'anthropic', 'gemini', 'azure_openai', 'github'];

type ValidationStatus = 'pending' | 'active' | 'invalid' | 'revoked';

interface ProviderProfile {
  id: string;
  providerType: ProviderId;
  displayName: string;
  maskedPreview: string;
  validationStatus: ValidationStatus;
  lastValidatedAt: string | null;
  lastValidationReason: string | null;
  lastUsedAt: string | null;
  availableModels: string[];
  isDefault: boolean;
  config: { endpoint?: string; apiVersion?: string };
  createdAt: string;
  updatedAt: string;
}

interface ListResponse { profiles?: ProviderProfile[]; reason?: string }
interface MutationResponse {
  ok: boolean;
  reason?: string;
  profile?: ProviderProfile;
  content?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  costUsd?: number;
  finishReason?: string;
}

export default function ByokSettings() {
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [topError, setTopError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/byok/providers', { cache: 'no-store' });
      if (r.status === 401) {
        setTopError('Real Mode requires sign-in. Sign in with Google for a private workspace, or use Demo Mode without any keys.');
        setProfiles([]);
        return;
      }
      const body = (await r.json()) as ListResponse;
      setProfiles(body.profiles ?? []);
      setTopError(null);
    } catch (e) {
      setTopError(e instanceof Error ? e.message : 'Failed to load providers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <section>
      <h1>BYOK provider keys</h1>
      <p style={{ color: '#9aa0a6', maxWidth: 720 }}>
        Credentials are encrypted at rest with AES-256-GCM and never leave the server in
        plaintext. The browser only ever sees a masked preview plus non-sensitive metadata.
      </p>

      {topError ? (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem 1.25rem',
            border: '1px solid #2a2a2a',
            borderRadius: 8,
            background: '#15171c',
          }}
        >
          <p style={{ color: '#ef6a6a', margin: 0 }}>{topError}</p>
          <p style={{ color: '#9aa0a6', margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
            Demo Mode is available without sign-in.
          </p>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a href="/signin?next=/settings/byok" style={primaryBtn}>Sign in with Google</a>
            <a href="/demo" style={secondaryBtn}>Open Demo Mode</a>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
        <button onClick={() => setShowAdd(true)} style={primaryBtn}>+ Add provider</button>
        {loading ? <span style={{ color: '#9aa0a6' }}>loading…</span> : null}
      </div>

      {showAdd ? (
        <AddProviderForm
          onCancel={() => setShowAdd(false)}
          onAdded={async () => { setShowAdd(false); await refresh(); }}
        />
      ) : null}

      <div style={{ marginTop: '2rem', display: 'grid', gap: '1rem' }}>
        {profiles.length === 0 && !loading ? (
          <p style={{ color: '#9aa0a6' }}>No providers configured. Add one to get started.</p>
        ) : null}
        {profiles.map((p) => (
          <ProviderCard key={p.id} profile={p} onChanged={refresh} />
        ))}
      </div>
    </section>
  );
}

// ── Add form ─────────────────────────────────────────────────────────────────

function AddProviderForm({
  onCancel, onAdded,
}: {
  onCancel: () => void;
  onAdded: () => Promise<void>;
}) {
  const [providerType, setProviderType] = useState<ProviderId>('openai');
  const [displayName, setDisplayName] = useState('Personal key');
  const [secret, setSecret] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [apiVersion, setApiVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (providerType === 'azure_openai' && !endpoint) {
      setError('Azure OpenAI requires an endpoint.');
      return;
    }
    setBusy(true);
    try {
      const config: Record<string, string> = {};
      if (providerType === 'azure_openai') {
        config['endpoint'] = endpoint;
        if (apiVersion) config['apiVersion'] = apiVersion;
      }
      const resp = await fetch('/api/byok/providers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerType, displayName, secret, config }),
      });
      const result = (await resp.json()) as MutationResponse;
      // Drop the plaintext from state ASAP regardless of outcome.
      setSecret('');
      if (!result.ok) { setError(result.reason ?? 'Create failed.'); return; }
      await onAdded();
    } catch (err) {
      setSecret('');
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ ...cardStyle, marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
      <h3 style={{ margin: 0 }}>New provider</h3>
      <label>
        Provider
        <select value={providerType} onChange={(e) => setProviderType(e.target.value as ProviderId)} style={inputStyle}>
          {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label>
        Display name
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
      </label>
      {providerType === 'azure_openai' ? (
        <>
          <label>
            Endpoint
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://my-resource.openai.azure.com"
              style={inputStyle}
            />
          </label>
          <label>
            API version (optional)
            <input
              type="text"
              value={apiVersion}
              onChange={(e) => setApiVersion(e.target.value)}
              placeholder="2024-08-01-preview"
              style={inputStyle}
            />
          </label>
        </>
      ) : null}
      {providerType === 'github' ? (
        <p style={{ color: '#9aa0a6', fontSize: '0.8rem', margin: 0 }}>
          Create a fine-grained or classic PAT with <code>repo</code> (and <code>workflow</code> if you want pipelines).
          The token is validated against <code>GET /user</code> and then encrypted at rest.
        </p>
      ) : null}
      <label>
        Secret
        <input
          type="password"
          autoComplete="off"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={hintFor(providerType)}
          style={inputStyle}
        />
      </label>
      {error ? <p style={{ color: '#ef6a6a', margin: 0 }}>{error}</p> : null}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="submit" disabled={busy || !secret} style={primaryBtn}>
          {busy ? 'Validating…' : 'Validate and add'}
        </button>
        <button type="button" onClick={onCancel} style={secondaryBtn}>Cancel</button>
      </div>
    </form>
  );
}

// ── Provider card ────────────────────────────────────────────────────────────

function ProviderCard({ profile, onChanged }: { profile: ProviderProfile; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<'reval' | 'test' | 'default' | 'delete' | null>(null);
  const [testPrompt, setTestPrompt] = useState('Say "ok" in one word.');
  const [testModel, setTestModel] = useState(profile.availableModels[0] ?? '');
  const [testResult, setTestResult] = useState<MutationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusColor = useMemo(() => statusColorFor(profile.validationStatus), [profile.validationStatus]);

  async function call(path: string, init?: RequestInit): Promise<MutationResponse> {
    const r = await fetch(path, init);
    return (await r.json()) as MutationResponse;
  }

  async function revalidate() {
    setBusy('reval'); setError(null);
    try {
      const res = await call(`/api/byok/providers/${profile.id}/validate`, { method: 'POST' });
      if (!res.ok) setError(res.reason ?? 'Validation failed.');
      await onChanged();
    } finally { setBusy(null); }
  }

  async function makeDefault() {
    setBusy('default'); setError(null);
    try {
      const res = await call(`/api/byok/providers/${profile.id}/default`, { method: 'POST' });
      if (!res.ok) setError(res.reason ?? 'Could not set default.');
      await onChanged();
    } finally { setBusy(null); }
  }

  async function remove() {
    if (!confirm(`Delete "${profile.displayName}"? This soft-deletes the credential.`)) return;
    setBusy('delete'); setError(null);
    try {
      const res = await call(`/api/byok/providers/${profile.id}`, { method: 'DELETE' });
      if (!res.ok) setError(res.reason ?? 'Delete failed.');
      await onChanged();
    } finally { setBusy(null); }
  }

  async function runTest() {
    if (!testModel || !testPrompt) return;
    setBusy('test'); setError(null); setTestResult(null);
    try {
      const res = await call(`/api/byok/providers/${profile.id}/test-prompt`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modelId: testModel, prompt: testPrompt }),
      });
      setTestResult(res);
      if (!res.ok) setError(res.reason ?? 'Test prompt failed.');
    } finally { setBusy(null); }
  }

  return (
    <div style={cardStyle}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0 }}>
            {profile.providerType} <span style={{ color: '#9aa0a6', fontWeight: 'normal' }}>· {profile.displayName}</span>
            {profile.isDefault ? <span style={defaultPill}> default </span> : null}
          </h3>
          <p style={{ margin: '0.25rem 0 0', color: '#9aa0a6', fontFamily: 'monospace' }}>
            {profile.maskedPreview}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, color: statusColor }}>● {profile.validationStatus}</p>
          <p style={{ margin: 0, color: '#9aa0a6', fontSize: '0.85rem' }}>
            last validated: {profile.lastValidatedAt ? new Date(profile.lastValidatedAt).toLocaleString() : 'never'}
          </p>
          {profile.lastUsedAt ? (
            <p style={{ margin: 0, color: '#9aa0a6', fontSize: '0.85rem' }}>
              last used: {new Date(profile.lastUsedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      </header>

      {profile.lastValidationReason ? (
        <p style={{ margin: '0.5rem 0 0', color: '#ef6a6a', fontSize: '0.85rem' }}>{profile.lastValidationReason}</p>
      ) : null}

      <details style={{ marginTop: '0.75rem' }}>
        <summary style={{ cursor: 'pointer', color: '#9aa0a6' }}>Available models ({profile.availableModels.length})</summary>
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0, color: '#cbd0d4' }}>
          {profile.availableModels.map((m) => <li key={m}><code>{m}</code></li>)}
        </ul>
      </details>

      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem', maxWidth: 480 }}>
        <label>
          Test model
          <select value={testModel} onChange={(e) => setTestModel(e.target.value)} style={inputStyle}>
            {profile.availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label>
          Test prompt
          <input type="text" value={testPrompt} onChange={(e) => setTestPrompt(e.target.value)} style={inputStyle} />
        </label>
      </div>

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={revalidate} disabled={busy !== null} style={secondaryBtn}>
          {busy === 'reval' ? 'Validating…' : 'Re-validate'}
        </button>
        <button onClick={runTest} disabled={busy !== null || !testModel} style={secondaryBtn}>
          {busy === 'test' ? 'Sending…' : 'Run test prompt'}
        </button>
        {!profile.isDefault ? (
          <button onClick={makeDefault} disabled={busy !== null} style={secondaryBtn}>
            {busy === 'default' ? 'Saving…' : 'Set default'}
          </button>
        ) : null}
        <button onClick={remove} disabled={busy !== null} style={dangerBtn}>
          {busy === 'delete' ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      {error ? <p style={{ margin: '0.5rem 0 0', color: '#ef6a6a' }}>{error}</p> : null}

      {testResult?.ok ? (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#11141a', borderRadius: 6 }}>
          <p style={{ margin: 0, color: '#cbd0d4' }}><strong>Reply:</strong> {testResult.content}</p>
          <p style={{ margin: '0.25rem 0 0', color: '#9aa0a6', fontSize: '0.85rem' }}>
            tokens: {testResult.usage?.totalTokens ?? '?'} · cost: ${testResult.costUsd?.toFixed(6) ?? '?'} · finish: {testResult.finishReason}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ── helpers / styles ─────────────────────────────────────────────────────────

function hintFor(p: ProviderId): string {
  switch (p) {
    case 'openai':       return 'sk-…';
    case 'anthropic':    return 'sk-ant-…';
    case 'gemini':       return 'AIza…';
    case 'azure_openai': return '32-char Azure resource key';
    case 'github':       return 'ghp_… or github_pat_… (scopes: repo, workflow)';
    default:             return 'paste secret';
  }
}

function statusColorFor(s: ValidationStatus): string {
  switch (s) {
    case 'active':  return '#3ec47a';
    case 'invalid': return '#ef6a6a';
    case 'revoked': return '#ef6a6a';
    default:        return '#9aa0a6';
  }
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '0.25rem',
  padding: '0.5rem 0.75rem',
  background: '#1a1a1f',
  color: '#e8e8ea',
  border: '1px solid #2a2a2a',
  borderRadius: 6,
};

const cardStyle: React.CSSProperties = {
  padding: '1rem 1.25rem',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  background: '#15171c',
};

const primaryBtn: React.CSSProperties = {
  padding: '0.5rem 0.9rem', background: '#3a6bdc', color: 'white',
  border: 0, borderRadius: 6, cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  padding: '0.45rem 0.8rem', background: '#1f232b', color: '#cbd0d4',
  border: '1px solid #2a2a2a', borderRadius: 6, cursor: 'pointer',
};

const dangerBtn: React.CSSProperties = {
  ...secondaryBtn, color: '#ef6a6a', borderColor: '#3a1f24',
};

const defaultPill: React.CSSProperties = {
  marginLeft: '0.5rem', fontSize: '0.7rem', textTransform: 'uppercase',
  padding: '0.1rem 0.4rem', background: '#3a6bdc22',
  color: '#7aa3ff', borderRadius: 4, fontWeight: 'bold',
};
