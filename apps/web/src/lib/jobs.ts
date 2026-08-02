/**
 * Process-wide JobOrchestrator singleton (Sprint 2A.6 / PR3).
 *
 * Wires `@foundry/ventures` JobOrchestrator to the lab runners
 * (PersonaLab, Graphify, VentureLab, BuildSquad). Each handler:
 *   1. Resolves the BYOK provider profile (so the job row records
 *      providerName + providerModel + credentialId for the evaluation hot
 *      path).
 *   2. Invokes the existing `run*` function from apps/web/src/lib/*.ts.
 *   3. On success, returns a `JobHandlerResult` whose `artifactKind` +
 *      `payload` cause the orchestrator to attach the artifact to the
 *      Venture in a single transactional step.
 *
 * Token-level cost estimation is wired through `recordUsage` only when the
 * underlying runner surfaces token counts. Sprint 2A.6 runners do not yet
 * surface counts, so cost is left null (orchestrator never lies about cost).
 *
 * GitHub export (`github.export`) is intentionally NOT registered here — it
 * lands in PR4 with its own handler that imports `GitHubExporter`.
 */
import 'server-only';

import {
  InMemoryJobStore,
  JobOrchestrator,
  SupabaseJobStore,
  type JobHandler,
  type JobHandlerContext,
  type JobHandlerResult,
  type JobStore,
} from '@foundry/ventures';
import type {
  ProviderId,
  VentureArtifactKind,
  VentureJob,
  VentureJobKind,
} from '@foundry/contracts';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getCredentialService } from './credentials';
import { getVentureService } from './ventures';
import { runPersonaLabAction, type PersonaLabAction, type PersonaLabEngine } from './personalab';
import { runGraphifyBuild } from './graphify';
import { runVentureLabAnalyze } from './venturelab';
import { runBuildSquad } from './buildsquad';
import { runGitHubExport, encodeJobErrorMessage, type GitHubExportInput } from './github-export';

declare global {
  // eslint-disable-next-line no-var
  var __ventureos_job_store: JobStore | undefined;
  // eslint-disable-next-line no-var
  var __ventureos_job_orchestrator: JobOrchestrator | undefined;
}

// ── store selection ────────────────────────────────────────────────────────

function getJobStore(): JobStore {
  if (globalThis.__ventureos_job_store) return globalThis.__ventureos_job_store;
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  let store: JobStore;
  if (url && key) {
    const client: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });
    store = new SupabaseJobStore(client);
  } else {
    store = new InMemoryJobStore();
  }
  globalThis.__ventureos_job_store = store;
  return store;
}

// ── orchestrator singleton ────────────────────────────────────────────────

export function getJobOrchestrator(): JobOrchestrator {
  if (globalThis.__ventureos_job_orchestrator) return globalThis.__ventureos_job_orchestrator;
  const orch = new JobOrchestrator(getJobStore(), getVentureService());
  registerHandlers(orch);
  globalThis.__ventureos_job_orchestrator = orch;
  return orch;
}

// ── input shapes ──────────────────────────────────────────────────────────

interface BaseInput {
  providerCredentialId: string;
  modelId: string;
}

interface PersonaLabJobInput extends BaseInput {
  action: PersonaLabAction;
  brief: unknown;
  engine?: PersonaLabEngine;
  personas?: unknown[];
  persona?: unknown;
  topic?: string;
  questions?: string[];
  rounds?: number;
  offerSummary?: string;
  transcripts?: unknown[];
  n?: number;
}

interface GraphifyJobInput extends BaseInput {
  payload: unknown;
}

interface VentureLabJobInput extends BaseInput {
  payload: unknown;
}

interface BuildSquadJobInput extends BaseInput {
  payload: unknown;
}

// ── handler registration ──────────────────────────────────────────────────

function registerHandlers(orch: JobOrchestrator): void {
  // PersonaLab — one job kind per action (matches VentureJobKind enum).
  orch.register('personalab.generate_personas', wrapPersonaLab('generatePersonas', 'persona_set'));
  orch.register('personalab.run_interview', wrapPersonaLab('runInterview', 'interview_transcript'));
  orch.register('personalab.run_focus_group', wrapPersonaLab('runFocusGroup', 'focus_group_transcript'));
  orch.register('personalab.run_buying_committee', wrapPersonaLab('runBuyingCommittee', 'buying_committee'));
  orch.register('personalab.extract_insights', wrapPersonaLab('extractInsights', 'persona_insights'));

  orch.register('graphify.build', graphifyHandler);
  orch.register('venturelab.recommend', ventureLabHandler);
  orch.register('buildsquad.plan', buildSquadHandler);
  orch.register('github.export', githubExportHandler);
}

// ── helpers ───────────────────────────────────────────────────────────────

async function recordProvider(
  ctx: JobHandlerContext,
  job: VentureJob,
  credentialId: string,
  modelId: string,
): Promise<void> {
  try {
    const profiles = await getCredentialService().listProfiles(job.ownerId);
    const profile = profiles.find((p) => p.id === credentialId);
    if (profile) {
      ctx.recordUsage({
        providerName: profile.providerType as ProviderId,
        providerModel: modelId,
        promptTokens: 0,
        completionTokens: 0,
      });
    }
  } catch {
    // Provider info is best-effort — never fail a job because telemetry lookup failed.
  }
}

function wrapPersonaLab(
  action: PersonaLabAction,
  kind: VentureArtifactKind,
): JobHandler {
  return async (ctx) => {
    const input = ctx.job.input as PersonaLabJobInput;
    await recordProvider(ctx, ctx.job, input.providerCredentialId, input.modelId);
    ctx.reportProgress({ progress: 0.1, stepLabel: `Running ${action}` });

    const result = await runPersonaLabAction({
      userId: ctx.job.ownerId,
      providerCredentialId: input.providerCredentialId,
      modelId: input.modelId,
      brief: input.brief as never,
      action,
      engine: input.engine ?? 'builtin',
      ...(input.personas ? { personas: input.personas as never } : {}),
      ...(input.persona ? { persona: input.persona as never } : {}),
      ...(input.topic ? { topic: input.topic } : {}),
      ...(input.questions ? { questions: input.questions } : {}),
      ...(input.rounds ? { rounds: input.rounds } : {}),
      ...(input.offerSummary ? { offerSummary: input.offerSummary } : {}),
      ...(input.transcripts ? { transcripts: input.transcripts } : {}),
      ...(input.n ? { n: input.n } : {}),
    });

    if (!result.ok) throw new Error(result.reason);
    return successResult(kind, summarisePersonaLab(action, result.data), result.data);
  };
}

const graphifyHandler: JobHandler = async (ctx) => {
  const input = ctx.job.input as GraphifyJobInput;
  await recordProvider(ctx, ctx.job, input.providerCredentialId, input.modelId);
  ctx.reportProgress({ progress: 0.1, stepLabel: 'Extracting research graph' });
  const result = await runGraphifyBuild({
    userId: ctx.job.ownerId,
    providerCredentialId: input.providerCredentialId,
    modelId: input.modelId,
    payload: input.payload as never,
  });
  if (!result.ok) throw new Error(result.reason);
  const stats = (result.data as { stats?: { nodes?: number }; godNodes?: unknown[] });
  return successResult(
    'research_graph',
    `Graph with ${stats.stats?.nodes ?? 0} nodes, ${stats.godNodes?.length ?? 0} god-nodes`,
    result.data,
  );
};

const ventureLabHandler: JobHandler = async (ctx) => {
  const input = ctx.job.input as VentureLabJobInput;
  await recordProvider(ctx, ctx.job, input.providerCredentialId, input.modelId);
  ctx.reportProgress({ progress: 0.1, stepLabel: 'Running VentureLab recommendation' });
  const result = await runVentureLabAnalyze({
    userId: ctx.job.ownerId,
    providerCredentialId: input.providerCredentialId,
    modelId: input.modelId,
    payload: input.payload as never,
  });
  if (!result.ok) throw new Error(result.reason);
  const rec = result.data as { decision: string; overallScore: number };
  return successResult('venture_recommendation', `${rec.decision} (score ${rec.overallScore})`, result.data);
};

const buildSquadHandler: JobHandler = async (ctx) => {
  const input = ctx.job.input as BuildSquadJobInput;
  await recordProvider(ctx, ctx.job, input.providerCredentialId, input.modelId);
  ctx.reportProgress({ progress: 0.1, stepLabel: 'Drafting BuildSquad pack' });
  const result = await runBuildSquad({
    userId: ctx.job.ownerId,
    providerCredentialId: input.providerCredentialId,
    modelId: input.modelId,
    payload: input.payload as never,
  });
  if (!result.ok) throw new Error(result.reason);
  const pack = result.data as { mode: string };
  return successResult('buildsquad_pack', `BuildSquad pack (${pack.mode})`, result.data);
};

const githubExportHandler: JobHandler = async (ctx) => {
  const input = ctx.job.input as GitHubExportInput;
  ctx.reportProgress({ progress: 0.05, stepLabel: 'Rendering evaluation report' });
  const result = await runGitHubExport({
    userId: ctx.job.ownerId,
    ventureId: ctx.job.ventureId,
    input,
    onProgress: (progress, stepLabel) => ctx.reportProgress({ progress, stepLabel }),
  });
  if (!result.ok) {
    // Surface reasonCode via a stable `[code] message` prefix so the workspace
    // panel can render structured guidance (e.g. for repo_exists or
    // insufficient_scope) without parsing free-form English from us or GitHub.
    throw new Error(encodeJobErrorMessage(result.reasonCode, result.reason));
  }
  // The runner attaches the evaluation_report artifact internally so the
  // timeline reads naturally (eval first, then repo). The orchestrator-managed
  // artifact is the github_repo payload returned here.
  return successResult('github_repo', result.summary, result.payload);
};

// ── result builders ───────────────────────────────────────────────────────

function successResult(
  artifactKind: VentureArtifactKind,
  summary: string,
  payload: unknown,
): JobHandlerResult {
  return {
    artifact: { artifactKind, summary, payload },
  };
}

function summarisePersonaLab(action: PersonaLabAction, data: unknown): string {
  if (action === 'generatePersonas' && Array.isArray(data)) return `${data.length} personas generated`;
  if (action === 'runInterview') return 'Interview transcript';
  if (action === 'runFocusGroup') return 'Focus group transcript';
  if (action === 'runBuyingCommittee') return 'Buying committee transcript';
  if (action === 'extractInsights') return 'Persona insights';
  return action;
}

// ── ergonomics for routes ─────────────────────────────────────────────────

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);

/**
 * Enqueue + await a job to terminal state. Used by lab routes that still
 * return synchronous `{ok, data}` for backward compatibility.
 *
 * Long-poll: in-process orchestrator runs the handler concurrently; this
 * function polls the store on a short interval (cheap for InMemoryJobStore;
 * for SupabaseJobStore the poll happens locally too because the handler
 * future is in-process).
 *
 * Returns the terminal job AND, on success, the payload of the attached
 * artifact so the route can reply with the legacy `{ok, data}` shape.
 */
export async function enqueueAndWait(input: {
  ownerId: string;
  ventureId: string;
  jobKind: VentureJobKind;
  jobInput: unknown;
  credentialId?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}): Promise<{ job: VentureJob; artifactPayload: unknown | null }> {
  const orch = getJobOrchestrator();
  const store = getJobStore();
  const created = await orch.enqueue({
    ownerId: input.ownerId,
    ventureId: input.ventureId,
    jobKind: input.jobKind,
    input: input.jobInput,
    ...(input.credentialId ? { credentialId: input.credentialId } : {}),
  });
  const jobId = created.jobId;
  const interval = input.pollIntervalMs ?? 100;
  const deadline = Date.now() + (input.timeoutMs ?? 5 * 60 * 1000);
  while (Date.now() < deadline) {
    const job = await store.getJob(input.ownerId, jobId);
    if (job && TERMINAL.has(job.status)) {
      let artifactPayload: unknown | null = null;
      if (job.status === 'succeeded' && job.outputArtifactId) {
        const artifacts = await getVentureService().listArtifacts(job.ownerId, job.ventureId);
        artifactPayload = artifacts.find((a) => a.artifactId === job.outputArtifactId)?.payload ?? null;
      }
      return { job, artifactPayload };
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Job ${jobId} did not terminate within timeout.`);
}

export { getJobStore };
