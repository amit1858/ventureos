/**
 * GitHub export runner (Sprint 2A.6 / PR4 + GitHub export hardening sprint).
 *
 * Loads the latest pack + recommendation + personas + graph + committee for a
 * Venture, synthesises the EvaluationReport artifact, attaches it, then uses
 * the user's GitHub PAT (BYOK) to create a repo and push the 14-file scaffold.
 *
 * Returns the GitHubRepoArtifactPayload that the JobOrchestrator attaches as
 * the `github_repo` artifact in a single transactional step.
 *
 * Also exports `previewExportFiles` — a pure read-only helper that returns the
 * exact ScaffoldFile[] the export *would* push, with no PAT required. Used by
 * the workspace preview modal so users see what they're about to commit.
 */
import 'server-only';

import {
  renderRepoScaffold,
  renderEvaluationReport,
  type RenderedScaffoldFile,
} from '@ventureos/buildsquad';
import {
  classifyGithubError,
  GitHubExporter,
  type ClassifiedGithubError,
} from '@ventureos/adapter-github';
import type {
  BuildSquadArtifactPack,
  BuyingCommitteeTranscript,
  GitHubRepoArtifactPayload,
  PersonaLabPersona,
  ResearchGraph,
  VentureArtifact,
  VentureArtifactKind,
  VentureRecommendation,
} from '@ventureos/contracts';

import { getCredentialService } from './credentials';
import { getVentureService } from './ventures';
import type { ExportReasonCode } from './github-error-codes';
export { encodeJobErrorMessage, decodeJobErrorMessage } from './github-error-codes';

export interface GitHubExportInput {
  /** BYOK credential id of the GitHub PAT to use. */
  providerCredentialId: string;
  /** Repo name (lowercase letters, digits, dashes). */
  repoName: string;
  /** Optional GitHub org owner. When absent, the authenticated user owns the repo. */
  org?: string;
  description?: string;
  private?: boolean;
}

export interface GitHubExportSuccess {
  ok: true;
  summary: string;
  payload: GitHubRepoArtifactPayload;
}
export interface GitHubExportFailure {
  ok: false;
  reason: string;
  /** Stable code the UI can branch on. Always set. */
  reasonCode: ExportReasonCode;
  /** Optional short hint to render next to the reason. */
  hint?: string;
}
export type GitHubExportResult = GitHubExportSuccess | GitHubExportFailure;

export interface RunGitHubExportArgs {
  userId: string;
  ventureId: string;
  input: GitHubExportInput;
  /** Progress callback bridged to the orchestrator. */
  onProgress?: (progress: number, stepLabel: string) => void;
}

export async function runGitHubExport(args: RunGitHubExportArgs): Promise<GitHubExportResult> {
  const { userId, ventureId, input, onProgress } = args;

  if (!input.providerCredentialId) {
    return { ok: false, reason: 'Missing providerCredentialId.', reasonCode: 'invalid_input' };
  }
  if (!input.repoName || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(input.repoName)) {
    return {
      ok: false,
      reason: 'Invalid repoName (use letters, digits, _ . - up to 100 chars).',
      reasonCode: 'invalid_input',
      hint: 'Try a slug like "faceless-crm-mvp".',
    };
  }

  const ventures = getVentureService();

  // ── 1. Gather venture context ────────────────────────────────────────
  const ctx = await loadVentureContext(userId, ventureId);
  if (!ctx.ok) return ctx;
  const { venture, summary, artifacts, packArt, pack, recArt, personasArt, graphArt, committeeArt,
    recommendation, personas, graph, committee } = ctx;

  // ── 2. Render evaluation report and persist as its own artifact ──────
  onProgress?.(0.15, 'Rendering evaluation report');
  const sourceArtifacts: { kind: VentureArtifactKind; version: number }[] = [];
  for (const a of [packArt, recArt, personasArt, graphArt, committeeArt]) {
    if (a) sourceArtifacts.push({ kind: a.artifactKind, version: a.version });
  }
  const { artifact: evalArtifact, markdown: evalMarkdown } = renderEvaluationReport({
    venture,
    pack,
    recommendation,
    personas,
    graph,
    committee,
    readiness: summary.readiness,
    sourceArtifacts,
  });
  const evalAttached = await ventures.attachArtifact({
    ownerId: userId,
    ventureId,
    artifactKind: 'evaluation_report',
    summary: `Readiness ${evalArtifact.readinessScore.overall}/100 · ${evalArtifact.recommendation.decision ?? 'no decision'}`,
    payload: evalArtifact,
  });

  // ── 3. Build the full repo scaffold ──────────────────────────────────
  const scaffoldFiles = renderRepoScaffold({
    venture,
    pack,
    recommendation,
    personas,
    graph,
    committee,
    evaluationMarkdown: evalMarkdown,
    readiness: summary.readiness,
  });

  // ── 4. Load PAT and push to GitHub ───────────────────────────────────
  onProgress?.(0.3, 'Loading GitHub credential');
  const exportOutcome = await getCredentialService().withDecryptedSecret(
    userId,
    input.providerCredentialId,
    async ({ secret, providerType }) => {
      if (providerType !== 'github') {
        return {
          ok: false as const,
          reason: `Credential is not a GitHub PAT (${providerType}).`,
          reasonCode: 'invalid_input' as const,
        };
      }
      const exporter = new GitHubExporter({ token: secret });
      try {
        onProgress?.(0.45, `Creating GitHub repo (${scaffoldFiles.length} files)`);
        const repo = await exporter.createRepo(input.repoName, {
          ...(input.org ? { org: input.org } : {}),
          ...(input.description ? { description: input.description } : {}),
          private: input.private ?? true,
          autoInit: true,
        });
        onProgress?.(0.7, 'Pushing scaffold commit');
        const pushed = await exporter.pushScaffold(
          repo,
          scaffoldFiles,
          `chore: initial VentureOS scaffold (evaluation v${evalAttached.version})`,
        );
        return { ok: true as const, repo, pushed };
      } catch (err) {
        const cls = classifyGithubError(err);
        return { ok: false as const, reason: cls.message, reasonCode: cls.code, hint: cls.hint };
      }
    },
  );

  if (!exportOutcome.ok) {
    return { ok: false, reason: exportOutcome.reason, reasonCode: 'precondition' };
  }
  const inner = exportOutcome.value;
  if (!inner.ok) {
    return {
      ok: false,
      reason: inner.reason,
      reasonCode: inner.reasonCode,
      ...('hint' in inner && inner.hint ? { hint: inner.hint } : {}),
    };
  }

  onProgress?.(0.95, 'Recording repo artifact');
  const payload: GitHubRepoArtifactPayload = {
    kind: 'GitHubRepoArtifact',
    owner: inner.repo.owner,
    name: inner.repo.name,
    htmlUrl: inner.repo.htmlUrl,
    defaultBranch: inner.repo.defaultBranch,
    commitSha: inner.pushed.commitSha,
    files: inner.pushed.files,
  };

  return {
    ok: true,
    summary: `${inner.repo.fullName} · ${inner.pushed.files.length} files @ ${inner.pushed.commitSha.slice(0, 7)}`,
    payload,
  };
}

// ─────────────────── preview (no network, no PAT) ───────────────────────

export interface PreviewFile {
  path: string;
  bytes: number;
  /** First ~400 chars of content, for the UI to render a quick peek. */
  preview: string;
}
export interface PreviewExportSuccess {
  ok: true;
  files: PreviewFile[];
  totalBytes: number;
  evaluationMarkdown: string;
}
export interface PreviewExportFailure {
  ok: false;
  reason: string;
  reasonCode: 'precondition';
}
export type PreviewExportResult = PreviewExportSuccess | PreviewExportFailure;

/**
 * Build the exact ScaffoldFile[] the export would push. No PAT required;
 * runs entirely off venture artifacts. Used by the preview modal so users
 * see *what* will be committed before they confirm.
 */
export async function previewExportFiles(args: {
  userId: string;
  ventureId: string;
}): Promise<PreviewExportResult> {
  const ctx = await loadVentureContext(args.userId, args.ventureId);
  if (!ctx.ok) {
    return { ok: false, reason: ctx.reason, reasonCode: 'precondition' };
  }
  const { venture, summary, packArt, pack, recArt, personasArt, graphArt, committeeArt,
    recommendation, personas, graph, committee } = ctx;
  const sourceArtifacts: { kind: VentureArtifactKind; version: number }[] = [];
  for (const a of [packArt, recArt, personasArt, graphArt, committeeArt]) {
    if (a) sourceArtifacts.push({ kind: a.artifactKind, version: a.version });
  }
  const { markdown: evalMarkdown } = renderEvaluationReport({
    venture,
    pack,
    recommendation,
    personas,
    graph,
    committee,
    readiness: summary.readiness,
    sourceArtifacts,
  });
  const files: RenderedScaffoldFile[] = renderRepoScaffold({
    venture,
    pack,
    recommendation,
    personas,
    graph,
    committee,
    evaluationMarkdown: evalMarkdown,
    readiness: summary.readiness,
  });
  let totalBytes = 0;
  const preview: PreviewFile[] = files.map((f) => {
    const bytes = Buffer.byteLength(f.content, 'utf8');
    totalBytes += bytes;
    return {
      path: f.path,
      bytes,
      preview: f.content.length > 400 ? `${f.content.slice(0, 400)}…` : f.content,
    };
  });
  return { ok: true, files: preview, totalBytes, evaluationMarkdown: evalMarkdown };
}

// ─────────────────── helpers ────────────────────────────────────────────

interface LoadedContextOk {
  ok: true;
  venture: Awaited<ReturnType<ReturnType<typeof getVentureService>['getVenture']>>;
  summary: Awaited<ReturnType<ReturnType<typeof getVentureService>['getSummary']>>;
  artifacts: VentureArtifact[];
  packArt: VentureArtifact;
  pack: BuildSquadArtifactPack;
  recArt: VentureArtifact | null;
  personasArt: VentureArtifact | null;
  graphArt: VentureArtifact | null;
  committeeArt: VentureArtifact | null;
  recommendation: VentureRecommendation | null;
  personas: PersonaLabPersona[] | null;
  graph: ResearchGraph | null;
  committee: BuyingCommitteeTranscript | null;
}
interface LoadedContextErr {
  ok: false;
  reason: string;
  reasonCode: 'precondition';
}

async function loadVentureContext(
  userId: string,
  ventureId: string,
): Promise<LoadedContextOk | LoadedContextErr> {
  const ventures = getVentureService();
  const venture = await ventures.getVenture(userId, ventureId);
  const summary = await ventures.getSummary(userId, ventureId);
  const artifacts = await ventures.listArtifacts(userId, ventureId);

  const packArt = latestOf(artifacts, 'buildsquad_pack');
  if (!packArt) {
    return {
      ok: false,
      reason: 'No BuildSquad pack to export — run BuildSquad first.',
      reasonCode: 'precondition',
    };
  }
  const pack = packArt.payload as BuildSquadArtifactPack;

  const recArt = latestOf(artifacts, 'venture_recommendation');
  const personasArt = latestOf(artifacts, 'persona_set');
  const graphArt = latestOf(artifacts, 'research_graph');
  const committeeArt = latestOf(artifacts, 'buying_committee');

  return {
    ok: true,
    venture,
    summary,
    artifacts,
    packArt,
    pack,
    recArt,
    personasArt,
    graphArt,
    committeeArt,
    recommendation: (recArt?.payload as VentureRecommendation | undefined) ?? null,
    personas: (personasArt?.payload as PersonaLabPersona[] | undefined) ?? null,
    graph: (graphArt?.payload as ResearchGraph | undefined) ?? null,
    committee: (committeeArt?.payload as BuyingCommitteeTranscript | undefined) ?? null,
  };
}

function latestOf(
  artifacts: VentureArtifact[],
  kind: VentureArtifactKind,
): VentureArtifact | null {
  const filtered = artifacts.filter((a) => a.artifactKind === kind);
  if (filtered.length === 0) return null;
  return filtered.reduce((best, cur) => (cur.version > best.version ? cur : best));
}
