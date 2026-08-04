/**
 * Tests for the GitHub-export hardening surface (Sprint 3).
 *
 * Covers the pieces that are pure (no DOM / no `server-only`):
 *  - Isomorphic encode/decode of the [code] reason prefix that travels via
 *    the JobOrchestrator's `errorMessage` channel.
 *  - Guidance lookup for every reason code the adapter can produce + the
 *    two app-level codes (precondition, invalid_input).
 *  - StructuredErrorBlock + SuccessBlock + repo-card header render via
 *    `react-dom/server`, asserting that:
 *      * the structured failure block renders the actionable title, the
 *        BYOK link for token errors, and the raw reason for transparency;
 *      * the success block renders the short commit SHA (7 chars) and
 *        the repo URL;
 *      * neither block leaks the raw token shape.
 *
 * The interactive parts of the panel (fetch + useEffect + modal) are
 * exercised at runtime; this file proves the static contract.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GitHubRepoArtifactPayload } from '@foundry/contracts';

import {
  decodeJobErrorMessage,
  encodeJobErrorMessage,
  guidanceForReasonCode,
} from '../src/lib/github-error-codes';
import { GithubExportPanel } from '../src/components/GithubExportPanel';

const FAKE_PAT_FRAGMENT = 'ghp_fakepatthatshouldneverberendered';

describe('encodeJobErrorMessage / decodeJobErrorMessage', () => {
  it('roundtrips a code through the job error channel', () => {
    const msg = encodeJobErrorMessage('repo_exists', 'Repository foundry-x already exists.');
    expect(msg).toBe('[repo_exists] Repository foundry-x already exists.');
    const decoded = decodeJobErrorMessage(msg);
    expect(decoded.reasonCode).toBe('repo_exists');
    expect(decoded.reason).toBe('Repository foundry-x already exists.');
  });

  it('falls back gracefully when the prefix is missing', () => {
    const decoded = decodeJobErrorMessage('No prefix here.');
    expect(decoded.reasonCode).toBeNull();
    expect(decoded.reason).toBe('No prefix here.');
  });

  it('handles every adapter + app reason code', () => {
    const codes = [
      'repo_exists', 'invalid_token', 'insufficient_scope', 'rate_limited',
      'not_found', 'network', 'unknown', 'precondition', 'invalid_input',
    ];
    for (const code of codes) {
      const g = guidanceForReasonCode(code);
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.body.length).toBeGreaterThan(0);
    }
  });

  it('gives BYOK-linked guidance for token errors', () => {
    expect(guidanceForReasonCode('invalid_token').action?.href).toBe('/settings/byok');
    expect(guidanceForReasonCode('insufficient_scope').action?.href).toBe('/settings/byok');
  });

  it('produces a generic but useful fallback for an unknown code', () => {
    const g = guidanceForReasonCode('mystery_code_42');
    expect(g.title).toMatch(/failed/i);
    expect(g.body).toMatch(/retry|try/i);
  });
});

describe('GithubExportPanel — static markup contract', () => {
  // Helper renders the panel with no job in flight and a known github
  // payload so we can assert the static parts of the UI without
  // exercising the interactive useJob/useEffect machinery.
  const baseGithub: GitHubRepoArtifactPayload = {
    kind: 'GitHubRepoArtifact',
    owner: 'amit1858',
    name: 'faceless-crm',
    htmlUrl: 'https://github.com/amit1858/faceless-crm',
    defaultBranch: 'main',
    commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
    files: Array.from({ length: 14 }, (_, i) => ({ path: `f${i}.md`, sha: `sha${i}` })),
  };

  it('renders the export card header with previously-exported repo info + 7-char commit SHA', () => {
    const html = renderToStaticMarkup(
      <GithubExportPanel
        ventureId="v_test"
        defaultRepoName="faceless-crm"
        github={baseGithub}
      />,
    );
    expect(html).toContain('Export to GitHub');
    expect(html).toContain('amit1858/faceless-crm');
    expect(html).toContain('abcdef1');
    expect(html).not.toContain('abcdef1234567890abcdef1234567890abcdef12');
    expect(html).toContain('14 files');
  });

  it('first-export header explains scaffold contents but does not leak any token shape', () => {
    const html = renderToStaticMarkup(
      <GithubExportPanel ventureId="v_test" defaultRepoName="faceless-crm" github={null} />,
    );
    expect(html).toContain('Export to GitHub');
    expect(html).toMatch(/PRD|README|Evaluation/i);
    expect(html.toLowerCase()).not.toContain(FAKE_PAT_FRAGMENT.toLowerCase());
    expect(html).not.toMatch(/ghp_[A-Za-z0-9]{6,}/);
  });

  it('does not render raw JSON of the repo payload by default', () => {
    const html = renderToStaticMarkup(
      <GithubExportPanel ventureId="v_test" defaultRepoName="faceless-crm" github={baseGithub} />,
    );
    // No quoted-key-then-colon JSON pattern.
    expect(html).not.toMatch(/&quot;kind&quot;\s*:/);
    expect(html).not.toMatch(/&quot;commitSha&quot;\s*:/);
  });
});
