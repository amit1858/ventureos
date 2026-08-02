'use client';

/**
 * Create Venture (Sprint 2A.5).
 *
 * Minimal form that POSTs to /api/ventures and redirects to the new
 * Venture's workspace on success.
 */
import { useState } from 'react';

import type { Venture } from '@foundry/contracts';

export default function NewVenturePage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [targetMarket, setTargetMarket] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [region, setRegion] = useState('');
  const [businessSize, setBusinessSize] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/ventures', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, description, problemStatement, targetMarket, customerType, region, businessSize }),
      });
      const body = (await r.json()) as { ok: boolean; venture?: Venture; reason?: string };
      if (!body.ok || !body.venture) { setError(body.reason ?? 'Failed.'); return; }
      window.location.href = `/ventures/${body.venture.ventureId}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem' }}>
      <h1 style={{ marginTop: 0 }}>Create venture</h1>
      <p style={{ color: '#9aa0a6' }}>
        Name your venture. You can fill in the rest of the brief later — every persona,
        research note, recommendation and BuildSquad pack will attach here.
      </p>
      <Field label="Title *" value={title} onChange={setTitle} />
      <Field label="Description" value={description} onChange={setDescription} multi />
      <Field label="Problem statement" value={problemStatement} onChange={setProblemStatement} multi />
      <Field label="Target market" value={targetMarket} onChange={setTargetMarket} />
      <Field label="Customer type" value={customerType} onChange={setCustomerType} />
      <Field label="Region" value={region} onChange={setRegion} />
      <Field label="Business size" value={businessSize} onChange={setBusinessSize} />

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button onClick={submit} disabled={busy || title.trim().length === 0} style={primaryBtn}>
          {busy ? 'Creating…' : 'Create venture'}
        </button>
        <a href="/ventures" style={ghostBtn}>Cancel</a>
      </div>
      {error && <p style={{ color: '#ef6a6a', marginTop: '0.75rem' }}>{error}</p>}
    </section>
  );
}

function Field({ label, value, onChange, multi }: { label: string; value: string; onChange: (v: string) => void; multi?: boolean }) {
  return (
    <label style={{ display: 'block', marginTop: '0.75rem', color: '#e8e8ea', fontSize: '0.9rem' }}>
      <div style={{ color: '#9aa0a6', marginBottom: 4 }}>{label}</div>
      {multi
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={inputStyle} />
        : <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.6rem', background: '#101015', color: '#e8e8ea',
  border: '1px solid #2a2a2a', borderRadius: 6, fontSize: '0.9rem', fontFamily: 'inherit',
};
const primaryBtn: React.CSSProperties = {
  padding: '0.55rem 1rem', background: '#7aa3ff', color: '#0b0b0e',
  border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
};
const ghostBtn: React.CSSProperties = {
  padding: '0.55rem 1rem', background: 'transparent', color: '#9aa0a6',
  border: '1px solid #2a2a2a', borderRadius: 6, fontSize: '0.9rem', textDecoration: 'none',
};
