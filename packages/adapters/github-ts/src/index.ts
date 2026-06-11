/**
 * GitHub adapter (Sprint 2A.6 / PR4).
 *
 * The ONLY file in the repo that may talk to the GitHub REST API. We hit the
 * raw REST endpoints with `fetch` (no `@octokit/*` dependency yet) because
 * the M2 scope is intentionally narrow: validate a PAT, create an empty
 * repo, push a single scaffold commit. Heavier flows (PRs, issues, projects)
 * are still represented as stubs to lock the interface.
 */

const GITHUB_API = 'https://api.github.com';

export class NotImplementedError extends Error {
  override readonly name = 'NotImplementedError';
}

export class GitHubExporterError extends Error {
  override readonly name = 'GitHubExporterError';
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface RepoSpec {
  owner: string;
  name: string;
  description?: string;
  private?: boolean;
}

export interface ScaffoldFile {
  path: string;
  /** UTF-8 contents. Binary not supported. */
  content: string;
}

export interface GitHubAdapter {
  createRepo(spec: RepoSpec): Promise<{ url: string; fullName: string }>;
  pushScaffold(spec: RepoSpec, files: ScaffoldFile[], commitMessage: string): Promise<{ sha: string }>;
  openPR(spec: RepoSpec, opts: { head: string; base: string; title: string; body?: string }): Promise<{ url: string; number: number }>;
  createIssue(spec: RepoSpec, opts: { title: string; body?: string; labels?: string[] }): Promise<{ url: string; number: number }>;
  createProject(spec: RepoSpec, opts: { title: string; body?: string }): Promise<{ url: string; id: string }>;
}

/** Sprint-0 stub. Retained so other code can opt-in to the not-implemented surface. */
export class GitHubAdapterStub implements GitHubAdapter {
  async createRepo(_spec: RepoSpec): Promise<{ url: string; fullName: string }> {
    throw new NotImplementedError('GitHubAdapterStub.createRepo');
  }
  async pushScaffold(): Promise<{ sha: string }> {
    throw new NotImplementedError('GitHubAdapterStub.pushScaffold');
  }
  async openPR(): Promise<{ url: string; number: number }> {
    throw new NotImplementedError('GitHubAdapterStub.openPR');
  }
  async createIssue(): Promise<{ url: string; number: number }> {
    throw new NotImplementedError('GitHubAdapterStub.createIssue');
  }
  async createProject(): Promise<{ url: string; id: string }> {
    throw new NotImplementedError('GitHubAdapterStub.createProject');
  }
}

// ──────────── Validation ─────────────────────────────────────────────────

export interface PatValidationResult {
  valid: boolean;
  reason?: string;
  login?: string;
  scopes?: string[];
}

/**
 * Probe a PAT by calling `GET /user`. Returns the authenticated login and the
 * scopes granted to the token (via `X-OAuth-Scopes`). Never logs the token.
 */
export async function validatePat(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PatValidationResult> {
  if (!token || token.length < 8) return { valid: false, reason: 'PAT is empty or too short.' };
  let resp: Response;
  try {
    resp = await fetchImpl(`${GITHUB_API}/user`, {
      headers: buildHeaders(token),
    });
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? 'Network error contacting GitHub.' : 'Network error.' };
  }
  if (resp.status === 401 || resp.status === 403) {
    return { valid: false, reason: `GitHub rejected the token (${resp.status}).` };
  }
  if (!resp.ok) {
    return { valid: false, reason: `GitHub responded ${resp.status}.` };
  }
  const body = (await resp.json()) as { login?: string };
  const scopesHeader = resp.headers.get('x-oauth-scopes') ?? '';
  const scopes = scopesHeader
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return {
    valid: true,
    ...(body.login ? { login: body.login } : {}),
    scopes,
  };
}

// ──────────── Real exporter ──────────────────────────────────────────────

export interface GitHubExporterOptions {
  token: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  /** API base override (e.g. GHES). Defaults to public github.com. */
  apiBase?: string;
}

export interface GitHubCreateRepoOptions {
  /** When set, creates the repo inside an org via `/orgs/{org}/repos`. */
  org?: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
}

export interface GitHubCreatedRepo {
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
}

export interface GitHubPushedScaffold {
  commitSha: string;
  branch: string;
  files: { path: string; sha: string }[];
}

/**
 * Thin REST client for the export flow:
 *   1. createRepo  → `POST /user/repos` (or `/orgs/{org}/repos`) with auto_init
 *   2. pushScaffold → blobs → tree (based on current main) → commit → updateRef
 */
export class GitHubExporter {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly apiBase: string;

  constructor(opts: GitHubExporterOptions) {
    this.token = opts.token;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.apiBase = opts.apiBase ?? GITHUB_API;
  }

  async createRepo(
    name: string,
    options: GitHubCreateRepoOptions = {},
  ): Promise<GitHubCreatedRepo> {
    const url = options.org
      ? `${this.apiBase}/orgs/${encodeURIComponent(options.org)}/repos`
      : `${this.apiBase}/user/repos`;
    const body = {
      name,
      description: options.description ?? '',
      private: options.private ?? true,
      auto_init: options.autoInit ?? true,
    };
    const resp = await this.fetchImpl(url, {
      method: 'POST',
      headers: { ...buildHeaders(this.token), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw await asError(resp, `createRepo(${name})`);
    const data = (await resp.json()) as {
      name: string;
      full_name: string;
      html_url: string;
      default_branch: string;
      owner: { login: string };
    };
    return {
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      htmlUrl: data.html_url,
      defaultBranch: data.default_branch || 'main',
    };
  }

  /**
   * Commit `files` to the repo's default branch in a single commit. Requires
   * the repo to have been created with `auto_init: true` (so the branch
   * already has a head we can parent against).
   */
  async pushScaffold(
    repo: GitHubCreatedRepo,
    files: ScaffoldFile[],
    commitMessage: string,
  ): Promise<GitHubPushedScaffold> {
    if (files.length === 0) throw new GitHubExporterError('pushScaffold called with no files.', 400);

    const owner = repo.owner;
    const name = repo.name;
    const branch = repo.defaultBranch;

    const refResp = await this.api(`/repos/${owner}/${name}/git/ref/heads/${branch}`);
    const ref = (await refResp.json()) as { object: { sha: string } };
    const parentSha: string = ref.object.sha;

    const commitResp = await this.api(`/repos/${owner}/${name}/git/commits/${parentSha}`);
    const parentCommit = (await commitResp.json()) as { tree: { sha: string } };
    const baseTreeSha: string = parentCommit.tree.sha;

    const blobs = await Promise.all(files.map(async (f) => {
      const r = await this.api(`/repos/${owner}/${name}/git/blobs`, 'POST', {
        content: f.content,
        encoding: 'utf-8',
      });
      const b = (await r.json()) as { sha: string };
      return { path: f.path, sha: b.sha };
    }));

    const treeResp = await this.api(`/repos/${owner}/${name}/git/trees`, 'POST', {
      base_tree: baseTreeSha,
      tree: blobs.map((b) => ({
        path: b.path,
        mode: '100644',
        type: 'blob',
        sha: b.sha,
      })),
    });
    const tree = (await treeResp.json()) as { sha: string };

    const commitCreateResp = await this.api(`/repos/${owner}/${name}/git/commits`, 'POST', {
      message: commitMessage,
      tree: tree.sha,
      parents: [parentSha],
    });
    const commit = (await commitCreateResp.json()) as { sha: string };

    await this.api(`/repos/${owner}/${name}/git/refs/heads/${branch}`, 'PATCH', {
      sha: commit.sha,
      force: false,
    });

    return {
      commitSha: commit.sha,
      branch,
      files: blobs,
    };
  }

  private async api(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' = 'GET',
    body?: unknown,
  ): Promise<Response> {
    const init: RequestInit = {
      method,
      headers: body
        ? { ...buildHeaders(this.token), 'content-type': 'application/json' }
        : buildHeaders(this.token),
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const resp = await this.fetchImpl(`${this.apiBase}${path}`, init);
    if (!resp.ok) throw await asError(resp, `${method} ${path}`);
    return resp;
  }
}

// ──────────── helpers ────────────────────────────────────────────────────

function buildHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28',
    'user-agent': 'ventureos-export',
  };
}

async function asError(resp: Response, label: string): Promise<GitHubExporterError> {
  let detail = '';
  try {
    const body = (await resp.json()) as { message?: string };
    if (body.message) detail = `: ${body.message}`;
  } catch {
    // ignore
  }
  return new GitHubExporterError(`GitHub ${label} failed (${resp.status})${detail}`, resp.status);
}
