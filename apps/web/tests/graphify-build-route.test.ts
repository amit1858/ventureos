import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the /api/graphify route added in the venture-context repair.
 * Before this route existed the Research Graph lab POSTed to a 404, so real
 * research builds silently failed. The route must:
 *   - enforce auth (401),
 *   - require providerCredentialId + modelId + payload.brief + payload.ventureId,
 *   - require at least one note or source,
 *   - enqueue the `graphify.build` job scoped to the venture, and
 *   - support both the sync ({ok,data}) and async (202 + jobId) paths.
 */

const { requireUser, UnauthorizedError, enqueueAndWait, getJobOrchestrator, enqueue, findActiveJob } =
  vi.hoisted(() => {
    class UnauthorizedError extends Error {
      constructor() {
        super('Unauthorized');
        this.name = 'UnauthorizedError';
      }
    }
    return {
      requireUser: vi.fn(),
      UnauthorizedError,
      enqueueAndWait: vi.fn(),
      getJobOrchestrator: vi.fn(),
      enqueue: vi.fn(),
      findActiveJob: vi.fn(),
    };
  });

vi.mock('../src/lib/auth', () => ({ requireUser, UnauthorizedError }));
vi.mock('../src/lib/jobs', () => ({ enqueueAndWait, getJobOrchestrator }));

import { POST } from '../src/app/api/graphify/route';

const VENTURE_ID = 'v-123';
const BRIEF = { businessIdea: 'X', targetMarket: 'Y', customerType: 'Z', region: 'R', businessSize: 'S' };

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/graphify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/graphify', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getJobOrchestrator.mockReturnValue({ enqueue, findActiveJob });
    findActiveJob.mockResolvedValue(null);
  });

  it('returns 401 when unauthorized', async () => {
    requireUser.mockRejectedValue(new UnauthorizedError());
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
    expect(enqueueAndWait).not.toHaveBeenCalled();
  });

  it('returns 400 when provider/model missing', async () => {
    requireUser.mockResolvedValue({ id: 'u1' });
    const res = await POST(makeReq({ payload: { ventureId: VENTURE_ID, brief: BRIEF, notes: ['n'] } }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when payload.ventureId missing', async () => {
    requireUser.mockResolvedValue({ id: 'u1' });
    const res = await POST(
      makeReq({ providerCredentialId: 'c1', modelId: 'm1', payload: { brief: BRIEF, notes: ['n'] } }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toMatch(/ventureId/);
  });

  it('returns 400 when there are no notes and no sources', async () => {
    requireUser.mockResolvedValue({ id: 'u1' });
    const res = await POST(
      makeReq({ providerCredentialId: 'c1', modelId: 'm1', payload: { ventureId: VENTURE_ID, brief: BRIEF, notes: [] } }),
    );
    expect(res.status).toBe(400);
    expect(enqueueAndWait).not.toHaveBeenCalled();
  });

  it('enqueues graphify.build scoped to the venture and returns { ok, data } on success', async () => {
    requireUser.mockResolvedValue({ id: 'owner-1' });
    enqueueAndWait.mockResolvedValue({
      job: { status: 'succeeded' },
      artifactPayload: { graphId: 'g1', nodes: [], edges: [] },
    });

    const res = await POST(
      makeReq({
        providerCredentialId: 'c1',
        modelId: 'm1',
        payload: { ventureId: VENTURE_ID, brief: BRIEF, notes: ['a signal'] },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { graphId: string } };
    expect(body.ok).toBe(true);
    expect(body.data.graphId).toBe('g1');

    expect(enqueueAndWait).toHaveBeenCalledTimes(1);
    const arg = enqueueAndWait.mock.calls[0]?.[0] as {
      ownerId: string; ventureId: string; jobKind: string;
    };
    expect(arg.ownerId).toBe('owner-1');
    expect(arg.ventureId).toBe(VENTURE_ID);
    expect(arg.jobKind).toBe('graphify.build');
  });

  it('returns 202 + jobId on the async path', async () => {
    requireUser.mockResolvedValue({ id: 'owner-1' });
    enqueue.mockResolvedValue({ jobId: 'job-9' });

    const res = await POST(
      makeReq({
        providerCredentialId: 'c1',
        modelId: 'm1',
        async: true,
        payload: { ventureId: VENTURE_ID, brief: BRIEF, notes: ['a signal'] },
      }),
    );

    expect(res.status).toBe(202);
    const body = (await res.json()) as { ok: boolean; jobId: string };
    expect(body.ok).toBe(true);
    expect(body.jobId).toBe('job-9');
    expect(enqueue).toHaveBeenCalledTimes(1);
    const arg = enqueue.mock.calls[0]?.[0] as { ventureId: string; jobKind: string };
    expect(arg.ventureId).toBe(VENTURE_ID);
    expect(arg.jobKind).toBe('graphify.build');
    expect(enqueueAndWait).not.toHaveBeenCalled();
  });

  it('returns 409 (without enqueuing) when a build is already active for the venture', async () => {
    requireUser.mockResolvedValue({ id: 'owner-1' });
    findActiveJob.mockResolvedValue({ jobId: 'job-live' });

    const res = await POST(
      makeReq({
        providerCredentialId: 'c1',
        modelId: 'm1',
        async: true,
        payload: { ventureId: VENTURE_ID, brief: BRIEF, notes: ['a signal'] },
      }),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { ok: boolean; jobId: string };
    expect(body.ok).toBe(false);
    expect(body.jobId).toBe('job-live');
    expect(findActiveJob).toHaveBeenCalledWith('owner-1', VENTURE_ID, 'graphify.build');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('returns 400 with a sanitized reason when the job fails', async () => {
    requireUser.mockResolvedValue({ id: 'owner-1' });
    enqueueAndWait.mockResolvedValue({
      job: { status: 'failed', errorMessage: 'boom with sk-abcdefgh12345678 leaked' },
      artifactPayload: undefined,
    });

    const res = await POST(
      makeReq({
        providerCredentialId: 'c1',
        modelId: 'm1',
        payload: { ventureId: VENTURE_ID, brief: BRIEF, notes: ['a signal'] },
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; reason: string };
    expect(body.ok).toBe(false);
    expect(body.reason).not.toMatch(/sk-abcdefgh12345678/);
  });
});
