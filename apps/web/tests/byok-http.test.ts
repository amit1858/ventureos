import { describe, expect, it } from 'vitest';

import {
  BYOK_INVALID_RESPONSE_REASON,
  parseByokMutationResponse,
  parseJsonBody,
} from '../src/lib/byok-http';

describe('BYOK client JSON parsing', () => {
  it('handles empty response bodies without throwing', async () => {
    const res = await parseByokMutationResponse(new Response('', { status: 500 }), 'Create failed.');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe(BYOK_INVALID_RESPONSE_REASON);
  });

  it('handles non-JSON response bodies without throwing', async () => {
    const html = '<html><body>Internal Error</body></html>';
    const res = await parseByokMutationResponse(new Response(html, { status: 500 }), 'Create failed.');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe(BYOK_INVALID_RESPONSE_REASON);
  });

  it('does not echo token-shaped response text in UI-facing error', async () => {
    const html = '<html>error sk-ant-abcdefghijklmnopqrstuvwx</html>';
    const res = await parseByokMutationResponse(new Response(html, { status: 500 }), 'Create failed.');
    expect(res.reason).toBe(BYOK_INVALID_RESPONSE_REASON);
    expect(res.reason).not.toContain('sk-ant-abcdefghijklmnopqrstuvwx');
  });

  it('parses valid JSON response bodies', async () => {
    const parsed = await parseJsonBody<{ ok: boolean; reason?: string }>(
      new Response(JSON.stringify({ ok: false, reason: 'Unauthorized.' }), { status: 401 }),
    );
    expect(parsed).toEqual({ ok: false, reason: 'Unauthorized.' });
  });
});
