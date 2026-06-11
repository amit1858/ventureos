/**
 * GitHub export runner (Sprint 2A.6 / PR4).
 *
 * Loads the latest pack + recommendation + personas + graph + committee for a
 * Venture, synthesises the EvaluationReport artifact, attaches it, then uses
 * the user's GitHub PAT (BYOK) to create a repo and push the scaffold.
 *
 * Returns the GitHubRepoArtifactPayload that the JobOrchestrator attaches as
 * the `github_repo` artifact in a single transactional step.
 */
import 'server-only';

import {
  renderPack,
  renderEvaluationReport,
} from '@ventureos/buildsquad';
import {
  GitHubExporter,
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

  if (!input.providerCredentialId) return { ok: false, reason: 'Missing providerCredentialId.' };
  if (!input.repoName || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(input.repoName)) {
    return { ok: false, reason: 'Invalid repoName (use letters, digits, _ . - up to 100 chars).' };
  }

  const ventures = getVentureService();

  // ── 1. Gather venture context ────────────────────────────────────────
  const venture = await ventures.getVenture(userId, ventureId);
  const summary = await ventures.getSummary(userId, ventureId);
  const artifacts = await ventures.listArtifacts(userId, ventureId);

  const packArt = latestOf(artifacts, 'buildsquad_pack');
  if (!packArt) return { ok: false, reason: 'No BuildSquad pack to export — run BuildSquad first.' };
  const pack = packArt.payload as BuildSquadArtifactPack;

  const recArt = latestOf(artifacts, 'venture_recommendation');
  const personasArt = latestOf(artifacts, 'persona_set');
  const graphArt = latestOf(artifacts, 'research_graph');
  const committeeArt = latestOf(artifacts, 'buying_committee');

  const recommendation = (recArt?.payload as VentureRecommendation | undefined) ?? null;
  const personas = (personasArt?.payload as PersonaLabPersona[] | undefined) ?? null;
  const graph = (graphArt?.payload as ResearchGraph | undefined) ?? null;
  const committee = (committeeArt?.payload as BuyingCommitteeTranscript | undefined) ?? null;

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

  // ── 3. Load PAT and push to GitHub ───────────────────────────────────
  onProgress?.(0.3, 'Loading GitHub credential');
  const scaffoldFiles = [
    ...renderPack(pack),
    { path: 'EVALUATION_REPORT.md', content: evalMarkdown },
  ];

  const exportOutcome = await getCredentialService().withDecryptedSecret(
    userId,
    input.providerCredentialId,
    async ({ secret, providerType }) => {
      if (providerType !== 'github') {
        return { ok: false as const, reason: `Credential is not a GitHub PAT (${providerType}).` };
      }
      const exporter = new GitHubExporter({ token: secret });
      onProgress?.(0.45, 'Creating GitHub repo');
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
    },
  );

  if (!exportOutcome.ok) return { ok: false, reason: exportOutcome.reason };
  const inner = exportOutcome.value;
  if (!inner.ok) return { ok: false, reason: inner.reason };

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

function latestOf(
  artifacts: VentureArtifact[],
  kind: VentureArtifactKind,
): VentureArtifact | null {
  const filtered = artifacts.filter((a) => a.artifactKind === kind);
  if (filtered.length === 0) return null;
  return filtered.reduce((best, cur) => (cur.version > best.version ? cur : best));
}
