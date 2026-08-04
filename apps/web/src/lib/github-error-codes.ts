/**
 * Isomorphic helpers for encoding/decoding the GitHub-export reason code
 * inside a job's `errorMessage`. Both server (job runner) and client (the
 * GithubExportPanel) need these — keep this file free of `server-only` so
 * it can be imported from React client components.
 *
 * The orchestrator surfaces `Error.message` verbatim into `VentureJob.errorMessage`,
 * so we use a `[code] reason` prefix as the only stable channel to carry a
 * machine-readable code without migrating the JobStore schema.
 */

import type { GitHubErrorCode } from '@foundry/adapter-github';

/** All reason codes the UI may receive — adapter codes plus our own validation codes. */
export type ExportReasonCode = GitHubErrorCode | 'precondition' | 'invalid_input';

/** Encode `[code] reason` into a job error message. */
export function encodeJobErrorMessage(reasonCode: string, reason: string): string {
  return `[${reasonCode}] ${reason}`;
}

const REASON_PREFIX_RE = /^\[([a-z_]+)\]\s*/;

/** Decode `[code] reason` back into its parts. Returns `reasonCode: null` if absent. */
export function decodeJobErrorMessage(message: string): { reasonCode: string | null; reason: string } {
  const m = message.match(REASON_PREFIX_RE);
  if (!m) return { reasonCode: null, reason: message };
  return { reasonCode: m[1] ?? null, reason: message.slice(m[0].length) };
}

/** Human guidance for each reason code, rendered inside the export panel's failure block. */
export interface ExportFailureGuidance {
  title: string;
  body: string;
  action?: { label: string; href: string };
}

export function guidanceForReasonCode(code: string | null): ExportFailureGuidance {
  switch (code) {
    case 'repo_exists':
      return {
        title: 'Repository name is already taken',
        body: 'A repo with this name already exists on the target account. Pick a different name or delete the existing repo on GitHub, then try again.',
      };
    case 'invalid_token':
      return {
        title: 'GitHub token is invalid or expired',
        body: 'Your GitHub PAT was rejected by GitHub. Generate a new fine-grained token with repo + contents:write scopes and re-add it under BYOK — your token never reaches the browser.',
        action: { label: 'Open BYOK settings', href: '/settings/byok' },
      };
    case 'insufficient_scope':
      return {
        title: 'GitHub token is missing required scopes',
        body: 'The PAT is valid but does not have permission to create repositories or push contents. Re-issue it with `repo` (or fine-grained: Contents=read/write, Administration=read/write) and re-add it under BYOK.',
        action: { label: 'Open BYOK settings', href: '/settings/byok' },
      };
    case 'rate_limited':
      return {
        title: 'GitHub rate limit reached',
        body: 'Your PAT has hit GitHub\'s hourly rate limit. Wait a few minutes and try again — nothing on the Foundry side was saved.',
      };
    case 'not_found':
      return {
        title: 'Target not found',
        body: 'GitHub returned 404 — usually the org you specified does not exist or your PAT cannot see it. Verify the org name and your token has access to it, then retry.',
      };
    case 'network':
      return {
        title: 'Network error reaching GitHub',
        body: 'We could not reach api.github.com. Check your internet connection and retry — nothing on Foundry changed.',
      };
    case 'precondition':
      return {
        title: 'Export is not ready yet',
        body: 'Generate a BuildSquad pack and a VentureLab recommendation first, then export — the GitHub repo needs those artifacts.',
      };
    case 'invalid_input':
      return {
        title: 'Invalid request',
        body: 'Some of the fields you supplied were invalid. Adjust them and retry.',
      };
    default:
      return {
        title: 'GitHub export failed',
        body: 'Something went wrong during the export. Verify your PAT and repo name, then retry — nothing was saved on the Foundry side.',
      };
  }
}
