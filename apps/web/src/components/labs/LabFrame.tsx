'use client';

/**
 * LabFrame — the shared shell every workflow lab (personas / research /
 * validation / build plan) renders inside. It guarantees the three invariants
 * the venture-context repair depends on:
 *
 *   1. A lab is ALWAYS bound to an explicit `?ventureId=`. Opened without one,
 *      it redirects to `/ventures` (pick a venture) instead of falling back to
 *      demo/sample content.
 *   2. The active venture's real brief + latest artifacts are loaded up-front
 *      via `loadVentureContext`, so no lab ever fabricates a brief.
 *   3. Navigation always carries the venture: a "back to venture" banner and a
 *      consistent provider picker keep the user inside one coherent journey.
 *
 * Visual language matches the (already correct) PersonaLab inline-style palette
 * so every lab is consistent with the dark design system — no Tailwind (which
 * is not configured in this app).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { SignInNotice } from '../SignInNotice';
import { providerLabel } from '../../lib/labels';
import {
  loadVentureContext,
  ventureIdFromLocation,
  type VentureContext,
} from '../../lib/venture-context';

export interface ProviderProfile {
  id: string;
  providerType: string;
  displayName: string;
  maskedPreview: string;
  validationStatus: 'pending' | 'active' | 'invalid' | 'revoked';
  availableModels: string[];
  isDefault: boolean;
}

type Phase = 'loading' | 'redirecting' | 'needsAuth' | 'error' | 'ready';

export interface VentureLab {
  phase: Phase;
  ventureId: string | null;
  context: VentureContext | null;
  loadError: string | null;
  providers: ProviderProfile[];
  selectedProviderId: string;
  setSelectedProviderId: (id: string) => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  selectedProvider: ProviderProfile | null;
  /** Re-fetch the venture + latest artifacts (e.g. after a run persists one). */
  reloadContext: () => Promise<void>;
}

/**
 * Binds the current lab page to its active venture. `labPath` is the lab's own
 * route (used for the sign-in return URL).
 */
export function useVentureLab(): VentureLab {
  const [phase, setPhase] = useState<Phase>('loading');
  const [ventureId, setVentureId] = useState<string | null>(null);
  const [context, setContext] = useState<VentureContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  const didInit = useRef(false);

  const loadProviders = useCallback(async (): Promise<'ok' | 'auth' | 'error'> => {
    try {
      const r = await fetch('/api/byok/providers', { cache: 'no-store' });
      if (r.status === 401) return 'auth';
      if (!r.ok) return 'error';
      const body = (await r.json()) as { profiles?: ProviderProfile[] };
      const list = (body.profiles ?? []).filter((p) => p.validationStatus === 'active');
      setProviders(list);
      const def = list.find((p) => p.isDefault) ?? list[0];
      if (def) {
        setSelectedProviderId(def.id);
        setSelectedModel(def.availableModels[0] ?? '');
      }
      return 'ok';
    } catch {
      return 'error';
    }
  }, []);

  const reloadContext = useCallback(async () => {
    if (!ventureId) return;
    const res = await loadVentureContext(ventureId);
    if (res.ok) setContext(res.context);
  }, [ventureId]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const vid = ventureIdFromLocation();
    if (!vid) {
      // No active venture → this lab has nothing to operate on. Send the user
      // to their ventures list rather than showing demo/sample content.
      setPhase('redirecting');
      if (typeof window !== 'undefined') window.location.replace('/ventures');
      return;
    }
    setVentureId(vid);

    void (async () => {
      const provStatus = await loadProviders();
      if (provStatus === 'auth') {
        setPhase('needsAuth');
        return;
      }

      const res = await loadVentureContext(vid);
      if (!res.ok) {
        if (res.status === 401) {
          setPhase('needsAuth');
        } else {
          setLoadError(res.reason);
          setPhase('error');
        }
        return;
      }
      setContext(res.context);
      setPhase('ready');
    })();
  }, [loadProviders]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  );

  // Keep the model valid whenever the provider changes.
  useEffect(() => {
    if (!selectedProvider) return;
    if (!selectedProvider.availableModels.includes(selectedModel)) {
      setSelectedModel(selectedProvider.availableModels[0] ?? '');
    }
  }, [selectedProvider, selectedModel]);

  return {
    phase,
    ventureId,
    context,
    loadError,
    providers,
    selectedProviderId,
    setSelectedProviderId,
    selectedModel,
    setSelectedModel,
    selectedProvider,
    reloadContext,
  };
}

/** Seconds elapsed while `active` is true — powers a non-static busy indicator. */
export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

// ── shared dark palette (matches PersonaLab) ────────────────────────────────

export const labUi = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' } as CSSProperties,
  card: {
    padding: '1rem 1.25rem', border: '1px solid var(--border)',
    borderRadius: 8, background: 'var(--surface)',
  } as CSSProperties,
  input: {
    display: 'block', width: '100%', marginTop: '0.25rem',
    padding: '0.5rem 0.75rem', background: 'var(--surface-2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 6,
  } as CSSProperties,
  primaryBtn: {
    padding: '0.5rem 0.9rem', background: 'var(--accent)', color: 'var(--on-accent)',
    border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 600,
  } as CSSProperties,
  /** Spread over primaryBtn when an action can't run — clearly inert. */
  primaryBtnDisabled: {
    opacity: 0.45, cursor: 'not-allowed',
  } as CSSProperties,
  secondaryBtn: {
    padding: '0.45rem 0.8rem', background: 'var(--surface-3)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
    textDecoration: 'none', display: 'inline-block',
  } as CSSProperties,
  muted: { color: 'var(--muted)' } as CSSProperties,
  error: { color: 'var(--danger)' } as CSSProperties,
  link: { color: 'var(--accent)' } as CSSProperties,
} as const;

// ── shell ───────────────────────────────────────────────────────────────────

export interface LabFrameProps {
  lab: VentureLab;
  labPath: string;
  title: string;
  description: string;
  /** Optional signed-in-notice copy shown when unauthenticated. */
  authMessage: string;
  children: ReactNode;
}

/**
 * Renders the standard lab chrome. Only renders `children` once the venture
 * context is `ready`, so labs can safely assume `lab.context` is non-null.
 */
export function LabFrame({ lab, labPath, title, description, authMessage, children }: LabFrameProps) {
  const venture = lab.context?.venture ?? null;

  return (
    <div style={labUi.page}>
      <header style={{ marginBottom: '1rem' }}>
        {lab.ventureId ? (
          <a href={`/ventures/${encodeURIComponent(lab.ventureId)}`} style={{ ...labUi.link, fontSize: '0.85rem', textDecoration: 'none' }}>
            ◀ {venture ? venture.title : 'Back to venture'}
          </a>
        ) : null}
        <h1 style={{ margin: '0.4rem 0 0.25rem', fontSize: '1.6rem' }}>{title}</h1>
        <p style={{ ...labUi.muted, margin: 0, maxWidth: 720 }}>{description}</p>
      </header>

      {lab.phase === 'loading' ? (
        <div aria-busy="true" aria-label="Loading venture">
          <div style={{ ...labUi.card, marginBottom: '1rem' }}>
            <div className="fdry-skeleton fdry-skeleton--text" style={{ width: 110 }} />
            <div className="fdry-skeleton fdry-skeleton--title" style={{ width: '45%', marginTop: '0.5rem' }} />
          </div>
          <div style={{ ...labUi.card }}>
            <div className="fdry-skeleton fdry-skeleton--text" style={{ width: 80 }} />
            <div className="fdry-skeleton fdry-skeleton--line" style={{ width: '60%', marginTop: '0.75rem', height: 34 }} />
          </div>
        </div>
      ) : null}

      {lab.phase === 'redirecting' ? (
        <div style={{ ...labUi.card }}>
          <p style={{ margin: 0 }}>
            No venture selected. Redirecting to{' '}
            <a href="/ventures" style={labUi.link}>your ventures</a>…
          </p>
        </div>
      ) : null}

      {lab.phase === 'needsAuth' ? (
        <SignInNotice next={labPath} message={authMessage} />
      ) : null}

      {lab.phase === 'error' ? (
        <div style={{ ...labUi.card }}>
          <p style={{ ...labUi.error, margin: 0 }}>{lab.loadError ?? 'Failed to load the venture.'}</p>
          <p style={{ ...labUi.muted, margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
            <a href="/ventures" style={labUi.link}>Back to your ventures</a>
          </p>
        </div>
      ) : null}

      {lab.phase === 'ready' ? (
        <>
          <VentureContextBanner lab={lab} />
          <ProviderPicker lab={lab} />
          {children}
        </>
      ) : null}
    </div>
  );
}

function VentureContextBanner({ lab }: { lab: VentureLab }) {
  const v = lab.context?.venture;
  if (!v) return null;
  return (
    <div style={{ ...labUi.card, marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', ...labUi.muted }}>
            Active venture
          </p>
          <p style={{ margin: '0.15rem 0 0', fontWeight: 600 }}>{v.title}</p>
        </div>
        <a href={`/ventures/${encodeURIComponent(v.ventureId)}`} style={labUi.secondaryBtn}>
          Open workspace
        </a>
      </div>
      {v.description ? (
        <p style={{ ...labUi.muted, margin: '0.6rem 0 0', fontSize: '0.85rem' }}>{v.description}</p>
      ) : null}
    </div>
  );
}

function ProviderPicker({ lab }: { lab: VentureLab }) {
  const { providers, selectedProviderId, setSelectedProviderId, selectedModel, setSelectedModel, selectedProvider } = lab;
  return (
    <div style={{ ...labUi.card, marginBottom: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Provider</h3>
      {providers.length === 0 ? (
        <p style={labUi.muted}>
          No active providers found. Add and validate a key on{' '}
          <a href="/settings/byok" style={labUi.link}>/settings/byok</a>.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <label>
            Credential
            <select value={selectedProviderId} onChange={(e) => setSelectedProviderId(e.target.value)} style={labUi.input}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {providerLabel(p.providerType)} — {p.displayName} ({p.maskedPreview})
                </option>
              ))}
            </select>
          </label>
          <label>
            Model
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={labUi.input}>
              {(selectedProvider?.availableModels ?? []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
