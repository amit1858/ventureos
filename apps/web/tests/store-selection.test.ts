/**
 * Supabase URL resolution / store-selection tests.
 *
 * Regression guard for the fallback added so a deployment configured with ONLY
 * the documented `NEXT_PUBLIC_SUPABASE_URL` (+ `SUPABASE_SERVICE_ROLE_KEY`)
 * persists ventures and jobs to Supabase instead of silently falling back to the
 * in-memory store. This mirrors the resolution already used by the credentials
 * store and keeps the three data services internally consistent.
 *
 * URL resolution under test:  SUPABASE_URL  ??  NEXT_PUBLIC_SUPABASE_URL
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// server-only guard — not available in the test runtime; stub it out.
vi.mock('server-only', () => ({}));

// Capture the Supabase client URL passed to createClient.
const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ __client: true })),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

// Sentinel store/service classes so we can assert which backend was chosen.
class InMemoryVentureStore {
  readonly backend = 'memory';
}
class SupabaseVentureStore {
  readonly backend = 'supabase';
  constructor(public client: unknown) {}
}
class InMemoryJobStore {
  readonly backend = 'memory';
}
class SupabaseJobStore {
  readonly backend = 'supabase';
  constructor(public client: unknown) {}
}
class VentureService {
  constructor(public store: unknown) {}
}
class JobOrchestrator {
  register = vi.fn();
  constructor(
    public store: unknown,
    public ventureService: unknown,
  ) {}
}
vi.mock('@foundry/ventures', () => ({
  InMemoryVentureStore,
  SupabaseVentureStore,
  InMemoryJobStore,
  SupabaseJobStore,
  VentureService,
  JobOrchestrator,
}));

// jobs.ts pulls the lab runners in at module load — stub them so the import is
// cheap and deterministic (handlers are registered but never invoked here).
vi.mock('../src/lib/credentials', () => ({ getCredentialService: vi.fn() }));
vi.mock('../src/lib/personalab', () => ({ runPersonaLabAction: vi.fn() }));
vi.mock('../src/lib/graphify', () => ({ runGraphifyBuild: vi.fn() }));
vi.mock('../src/lib/venturelab', () => ({ runVentureLabAnalyze: vi.fn() }));
vi.mock('../src/lib/buildsquad', () => ({ runBuildSquad: vi.fn() }));
vi.mock('../src/lib/github-export', () => ({
  runGitHubExport: vi.fn(),
  encodeJobErrorMessage: vi.fn(),
}));

const ENV_KEYS = [
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  createClient.mockClear();
  const g = globalThis as Record<string, unknown>;
  g['__foundry_venture_service'] = undefined;
  g['__foundry_supabase_admin'] = undefined;
  g['__foundry_job_store'] = undefined;
  g['__foundry_job_orchestrator'] = undefined;
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k] as string;
  }
});

describe('ventures store selection', () => {
  it('selects the Supabase store when ONLY NEXT_PUBLIC_SUPABASE_URL is set', async () => {
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://project.supabase.co';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-role-key';

    const { getVentureService } = await import('../src/lib/ventures');
    const svc = getVentureService() as unknown as VentureService;

    expect(svc.store).toBeInstanceOf(SupabaseVentureStore);
    expect(createClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'service-role-key',
      expect.anything(),
    );
  });

  it('prefers SUPABASE_URL over NEXT_PUBLIC_SUPABASE_URL when both are set', async () => {
    process.env['SUPABASE_URL'] = 'https://preferred.supabase.co';
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://fallback.supabase.co';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-role-key';

    const { getVentureService } = await import('../src/lib/ventures');
    getVentureService();

    expect(createClient).toHaveBeenCalledWith(
      'https://preferred.supabase.co',
      'service-role-key',
      expect.anything(),
    );
  });

  it('falls back to the in-memory store when no Supabase URL is set', async () => {
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-role-key';

    const { getVentureService } = await import('../src/lib/ventures');
    const svc = getVentureService() as unknown as VentureService;

    expect(svc.store).toBeInstanceOf(InMemoryVentureStore);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe('jobs store selection', () => {
  it('selects the Supabase store when ONLY NEXT_PUBLIC_SUPABASE_URL is set', async () => {
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://project.supabase.co';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-role-key';

    const { getJobOrchestrator } = await import('../src/lib/jobs');
    const orch = getJobOrchestrator() as unknown as JobOrchestrator;

    expect(orch.store).toBeInstanceOf(SupabaseJobStore);
    expect(createClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'service-role-key',
      expect.anything(),
    );
  });

  it('falls back to the in-memory store when no Supabase URL is set', async () => {
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-role-key';

    const { getJobOrchestrator } = await import('../src/lib/jobs');
    const orch = getJobOrchestrator() as unknown as JobOrchestrator;

    expect(orch.store).toBeInstanceOf(InMemoryJobStore);
    expect(createClient).not.toHaveBeenCalled();
  });
});
