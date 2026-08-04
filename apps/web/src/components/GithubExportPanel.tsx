'use client';

/**
 * GitHub Export Panel — workspace surface for exporting a Venture's
 * BuildSquad pack + Evaluation Report to a real GitHub repo via the user's
 * BYOK PAT (Sprint 3: GitHub Export Hardening).
 *
 * Capabilities:
 *  - Lists active GitHub PATs from /api/byok/providers (no secrets in browser).
 *  - "Preview files" modal calls GET /api/ventures/{id}/export/github/preview
 *    and shows the exact 14-file scaffold that will be committed, with byte
 *    counts and a collapsible content preview per file (read-only, no PAT).
 *  - Submit POSTs to /api/ventures/{id}/export/github and polls the resulting
 *    VentureJob via <JobProgress />.
 *  - On terminal failure, decodes the job's `[code] reason` message and
 *    renders structured guidance (Open BYOK, pick a different name, etc.).
 *  - On success, renders owner/name/branch/commit SHA (short) + Open repo +
 *    Copy URL, and calls `onJobChange` so the workspace refetches artifacts.
 *
 * Everything goes through Next.js route handlers — Octokit never reaches
 * the client bundle (import boundaries are enforced separately).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GitHubRepoArtifactPayload } from '@foundry/contracts';

import { cx, styles } from './artifacts';
import { JobProgress, useJob } from './JobProgress';
import {
  decodeJobErrorMessage,
  guidanceForReasonCode,
  type ExportFailureGuidance,
} from '../lib/github-error-codes';

interface GithubProfileLite {
  id: string;
  providerType: string;
  displayName: string;
  validationStatus: string;
}

interface PreviewFile {
  path: string;
  bytes: number;
  preview: string;
}

interface PreviewResponse {
  ok: boolean;
  files?: PreviewFile[];
  totalBytes?: number;
  reason?: string;
  reasonCode?: string;
}

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);

export interface GithubExportPanelProps {
  ventureId: string;
  /** Default repo name suggestion (slugified venture title). */
  defaultRepoName: string;
  /** Latest exported repo, if any — drives the re-export and success states. */
  github: GitHubRepoArtifactPayload | null;
  /** Called when the export job transitions to a terminal state so the parent
   *  workspace can refetch artifacts/timeline. */
  onJobChange?: () => void;
}

export function GithubExportPanel({
  ventureId, defaultRepoName, github, onJobChange,
}: GithubExportPanelProps) {
  const [profiles, setProfiles] = useState<GithubProfileLite[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [credId, setCredId] = useState<string>('');
  const [repoName, setRepoName] = useState<string>(github?.name ?? defaultRepoName);
  const [org, setOrg] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<{ reason: string; reasonCode: string | null } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

  const { job } = useJob(jobId);
  const lastNotifiedJob = useRef<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/byok/providers', { cache: 'no-store' });
        const body = (await r.json()) as { profiles?: GithubProfileLite[] };
        const gh = (body.profiles ?? []).filter(
          (p) => p.providerType === 'github' && p.validationStatus === 'active',
        );
        setProfiles(gh);
        if (gh.length > 0) setCredId(gh[0]!.id);
      } catch {
        setProfiles([]);
      } finally {
        setProfilesLoaded(true);
      }
    })();
  }, []);

  // When the polled job hits terminal state, notify the parent exactly once
  // so the workspace can refetch artifacts (and pick up the new github_repo).
  useEffect(() => {
    if (!job) return;
    if (!TERMINAL.has(job.status)) return;
    if (lastNotifiedJob.current === job.jobId) return;
    lastNotifiedJob.current = job.jobId;
    onJobChange?.();
  }, [job, onJobChange]);

  const openPreview = useCallback(async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const r = await fetch(
        `/api/ventures/${encodeURIComponent(ventureId)}/export/github/preview`,
        { cache: 'no-store' },
      );
      const body = (await r.json()) as PreviewResponse;
      setPreviewData(body);
    } catch (e) {
      setPreviewData({
        ok: false,
        reason: e instanceof Error ? e.message : 'Failed to load preview.',
      });
    } finally {
      setPreviewLoading(false);
    }
  }, [ventureId]);

  const submit = useCallback(async () => {
    setSubmitError(null);
    if (!credId) {
      setSubmitError({ reason: 'Add a GitHub PAT in Settings → BYOK first.', reasonCode: 'invalid_input' });
      return;
    }
    if (!repoName) {
      setSubmitError({ reason: 'Repo name is required.', reasonCode: 'invalid_input' });
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch(`/api/ventures/${encodeURIComponent(ventureId)}/export/github`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerCredentialId: credId,
          repoName,
          ...(org ? { org } : {}),
          private: isPrivate,
        }),
      });
      const body = (await resp.json()) as { ok: boolean; jobId?: string; reason?: string; reasonCode?: string };
      if (!body.ok) {
        setSubmitError({
          reason: body.reason ?? 'Export failed.',
          reasonCode: body.reasonCode ?? null,
        });
        return;
      }
      setJobId(body.jobId ?? null);
    } catch (e) {
      setSubmitError({
        reason: e instanceof Error ? e.message : 'Export request failed.',
        reasonCode: 'network',
      });
    } finally {
      setBusy(false);
    }
  }, [credId, repoName, org, isPrivate, ventureId]);

  // Structured failure block (decoded from the polled job's errorMessage).
  const decodedFailure = useMemo<{ guidance: ExportFailureGuidance; reason: string; reasonCode: string | null } | null>(() => {
    if (!job || job.status !== 'failed' || !job.errorMessage) return null;
    const { reasonCode, reason } = decodeJobErrorMessage(job.errorMessage);
    return { guidance: guidanceForReasonCode(reasonCode), reason, reasonCode };
  }, [job]);

  const exportedSuccess = job?.status === 'succeeded' && github;

  return (
    <div className={cx(styles.card)}>
      <p className={cx(styles.cardTitle)}>Export to GitHub</p>

      {github ? (
        <p className={cx(styles.muted)} style={{ margin: '0 0 0.6rem', fontSize: '0.85rem' }}>
          Last exported to <strong style={{ color: '#e8e8ea' }}>{github.owner}/{github.name}</strong>
          {' · '}<code className={cx(styles.mono)}>{github.defaultBranch}</code>
          {' · commit '}<code className={cx(styles.mono)}>{github.commitSha.slice(0, 7)}</code>
          {' · '}{github.files.length} files. Re-exporting overwrites with the latest artifacts.
        </p>
      ) : (
        <p className={cx(styles.muted)} style={{ margin: '0 0 0.6rem', fontSize: '0.85rem' }}>
          Push a repo-ready scaffold (README, PRD, Architecture, Roadmap, User Stories, Risks, Evaluation Report, persona &amp; research docs, .gitignore) to a real GitHub repository using your BYOK PAT — your token never reaches the browser.
        </p>
      )}

      {!profilesLoaded ? (
        <p className={cx(styles.muted)} style={{ fontSize: '0.85rem' }}>Loading GitHub credentials…</p>
      ) : profiles.length === 0 ? (
        <p style={{ color: '#f3b350', fontSize: '0.85rem', margin: 0 }}>
          No active GitHub PAT. <a href="/settings/byok" style={{ color: 'var(--accent)' }}>Add one in BYOK</a>
          {' '}— scopes needed: <code className={cx(styles.mono)}>repo</code> (or fine-grained: Contents read/write, Administration read/write).
        </p>
      ) : (
        <>
          <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 460 }}>
            <label style={{ fontSize: '0.85rem' }}>
              Credential
              <select value={credId} onChange={(e) => setCredId(e.target.value)} style={selectStyle}>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.85rem' }}>
              Repo name
              <input value={repoName} onChange={(e) => setRepoName(e.target.value)} style={selectStyle} placeholder="venture-export" />
            </label>
            <label style={{ fontSize: '0.85rem' }}>
              Org (optional — leave blank for personal account)
              <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="my-org" style={selectStyle} />
            </label>
            <label style={{ fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              Private repo
            </label>
          </div>

          {submitError ? (
            <div style={{ marginTop: '0.6rem' }}>
              <StructuredErrorBlock reason={submitError.reason} reasonCode={submitError.reasonCode} />
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void openPreview()}
              className={cx(styles.btn, styles.btnGhost)}
              data-testid="github-preview-button"
            >
              Preview files
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className={cx(styles.btn, styles.btnPrimary)}
              data-testid="github-export-button"
            >
              {busy ? 'Enqueuing…' : github ? 'Re-export repo →' : 'Create repo →'}
            </button>
          </div>

          {jobId ? (
            <div style={{ marginTop: '0.75rem' }}>
              <JobProgress jobId={jobId} />
            </div>
          ) : null}

          {decodedFailure ? (
            <div style={{ marginTop: '0.75rem' }} data-testid="github-export-failure">
              <StructuredErrorBlock
                reason={decodedFailure.reason}
                reasonCode={decodedFailure.reasonCode}
              />
            </div>
          ) : null}

          {exportedSuccess ? (
            <div style={{ marginTop: '0.75rem' }} data-testid="github-export-success">
              <SuccessBlock github={github} />
            </div>
          ) : null}
        </>
      )}

      {previewOpen ? (
        <PreviewModal
          loading={previewLoading}
          data={previewData}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}

/* ---------- Structured error block ---------- */

function StructuredErrorBlock({ reason, reasonCode }: { reason: string; reasonCode: string | null }) {
  const guidance = guidanceForReasonCode(reasonCode);
  return (
    <div
      role="alert"
      style={{
        border: '1px solid #5a2c2c',
        background: 'rgba(239, 106, 106, 0.08)',
        borderRadius: 8,
        padding: '0.75rem 0.9rem',
      }}
    >
      <p style={{ margin: '0 0 0.25rem', fontWeight: 700, color: '#f3aaaa', fontSize: '0.88rem' }}>
        {guidance.title}{reasonCode ? <span style={{ marginLeft: 6, color: '#9aa0a6', fontWeight: 500, fontSize: '0.78rem' }}>· {reasonCode}</span> : null}
      </p>
      <p style={{ margin: '0 0 0.35rem', fontSize: '0.84rem', color: '#e8e8ea' }}>{guidance.body}</p>
      <p style={{ margin: '0 0 0.45rem', fontSize: '0.78rem', color: '#9aa0a6' }}>
        Details: {reason}
      </p>
      {guidance.action ? (
        <a className={cx(styles.btn, styles.btnGhost)} href={guidance.action.href}>{guidance.action.label} →</a>
      ) : null}
    </div>
  );
}

/* ---------- Success block ---------- */

function SuccessBlock({ github }: { github: GitHubRepoArtifactPayload }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(github.htmlUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  }, [github.htmlUrl]);

  return (
    <div
      style={{
        border: '1px solid #2c5a45',
        background: 'rgba(86, 197, 150, 0.08)',
        borderRadius: 8,
        padding: '0.75rem 0.9rem',
      }}
    >
      <p style={{ margin: '0 0 0.4rem', fontWeight: 700, color: '#7fd5b0', fontSize: '0.88rem' }}>
        Export succeeded
      </p>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.86rem', color: '#e8e8ea' }}>
        Pushed <strong>{github.files.length} files</strong> to{' '}
        <strong>{github.owner}/{github.name}</strong> on{' '}
        <code className={cx(styles.mono)}>{github.defaultBranch}</code> at commit{' '}
        <code className={cx(styles.mono)} data-testid="github-export-commit">{github.commitSha.slice(0, 7)}</code>.
      </p>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <a className={cx(styles.btn, styles.btnPrimary)} href={github.htmlUrl} target="_blank" rel="noreferrer">
          Open repository →
        </a>
        <button type="button" onClick={() => void copy()} className={cx(styles.btn, styles.btnGhost)}>
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
      </div>
    </div>
  );
}

/* ---------- Preview modal ---------- */

function PreviewModal({
  loading, data, onClose,
}: {
  loading: boolean;
  data: PreviewResponse | null;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-modal-title"
        style={{
          width: 'min(820px, calc(100vw - 3rem))',
          maxHeight: 'calc(100vh - 4rem)',
          background: '#16161a', color: '#e8e8ea', border: '1px solid #2a2a30',
          borderRadius: 10, padding: '1rem 1.1rem',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <h3 id="preview-modal-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700, flex: 1 }}>
            Files that will be pushed to GitHub
          </h3>
          <button onClick={onClose} className={cx(styles.btn, styles.btnGhost)}>Close</button>
        </div>

        {loading ? (
          <p className={cx(styles.muted)} style={{ fontSize: '0.85rem' }}>Rendering scaffold…</p>
        ) : !data ? (
          <p className={cx(styles.muted)} style={{ fontSize: '0.85rem' }}>No data.</p>
        ) : !data.ok ? (
          <StructuredErrorBlock reason={data.reason ?? 'Preview failed.'} reasonCode={data.reasonCode ?? null} />
        ) : (
          <>
            <p className={cx(styles.muted)} style={{ margin: 0, fontSize: '0.82rem' }}>
              {data.files?.length ?? 0} files · {fmtBytes(data.totalBytes ?? 0)} total. Nothing is sent to GitHub yet.
            </p>
            <div
              style={{
                overflowY: 'auto',
                border: '1px solid #2a2a30',
                borderRadius: 8,
                background: '#101015',
              }}
              data-testid="github-preview-list"
            >
              {(data.files ?? []).map((f) => (
                <details key={f.path} style={{ borderBottom: '1px solid #1f1f25' }}>
                  <summary
                    style={{
                      padding: '0.55rem 0.75rem', cursor: 'pointer',
                      display: 'flex', gap: '0.6rem', alignItems: 'center',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span style={{ flex: 1, color: '#cfd2d6' }}>{f.path}</span>
                    <span style={{ color: '#71767d', fontSize: '0.76rem' }}>{fmtBytes(f.bytes)}</span>
                  </summary>
                  <pre
                    style={{
                      margin: 0, padding: '0.75rem',
                      background: '#0a0a0d', color: '#cdd1d6',
                      fontSize: '0.78rem', lineHeight: 1.45,
                      overflowX: 'auto', whiteSpace: 'pre-wrap',
                      borderTop: '1px solid #1f1f25',
                    }}
                  >{f.preview}</pre>
                </details>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

const selectStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.4rem 0.5rem',
  background: '#1a1a1f', color: '#e7e7ea', border: '1px solid #2a2a30', borderRadius: 4, fontSize: '0.85rem',
};
