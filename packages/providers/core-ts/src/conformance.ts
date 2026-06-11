/**
 * Provider adapter conformance suite.
 *
 * Every concrete adapter in `packages/providers/<provider>-ts/` must pass this suite.
 * It asserts the structural contract that `RoutingProviderClient` relies on:
 *
 *   - id is a non-empty ProviderId
 *   - capabilities are present and shaped correctly
 *   - chat() returns a ChatResponse with a numeric, non-negative cost.usd
 *   - validateCredentials() resolves with {valid: boolean, reason?: string}
 *     and never throws on auth failure (auth errors must be reported, not raised)
 *
 * Usage from an adapter test file:
 *
 *   ```ts
 *   import { runProviderConformance } from '@ventureos/providers-core/conformance';
 *
 *   runProviderConformance({
 *     name: 'OpenAiAdapter',
 *     buildAdapter: () => new OpenAiAdapter({ clientFactory: makeFakeClient }),
 *     modelId: 'gpt-4o-mini',
 *   });
 *   ```
 *
 * The suite relies on `vitest`'s globals being available in the importing test file.
 */
import type {
  ChatRequest,
  ChatResponse,
  DecryptedKey,
  ProviderId,
} from '@ventureos/contracts';

import type { ProviderAdapter } from './types';

/** Subset of the vitest test runner API the conformance suite needs. */
export interface ConformanceRunner {
  describe: (name: string, fn: () => void) => void;
  it: (name: string, fn: () => void | Promise<void>) => void;
  expect: (actual: unknown) => {
    toBe: (expected: unknown) => void;
    toBeGreaterThan: (n: number) => void;
    toBeGreaterThanOrEqual: (n: number) => void;
    toContain: (needle: unknown) => void;
  };
}

export interface ConformanceConfig {
  /** Display name shown in `describe(...)`. */
  name: string;
  /** Build a fresh adapter wired to a fake/in-memory client that returns success. */
  buildAdapter: () => ProviderAdapter;
  /** Build an adapter wired to a fake client that simulates an auth failure. */
  buildAuthFailingAdapter: () => ProviderAdapter;
  /** Concrete model id to invoke. */
  modelId: string;
  /** Expected `provider` ID on responses + capabilities. */
  expectedProviderId: ProviderId;
  /** vitest-compatible test runner (`{ describe, it, expect }`). */
  runner: ConformanceRunner;
}

const FAKE_KEY: DecryptedKey = {
  id: 'k_conf_test',
  provider: 'openai', // overwritten per case below; harmless at the type level
  secret: 'redacted-secret-not-used-by-fake',
};

function makeReq(): ChatRequest {
  return {
    model: 'standard',
    messages: [{ role: 'user', content: 'Say hi.' }],
    maxTokens: 16,
    ctx: { tenantId: 't_conf', traceId: 'trace_conf' },
  };
}

export function runProviderConformance(cfg: ConformanceConfig): void {
  const { describe, it, expect } = cfg.runner;
  describe(`provider conformance: ${cfg.name}`, () => {
    it('exposes the declared id and capabilities', () => {
      const a = cfg.buildAdapter();
      expect(a.id).toBe(cfg.expectedProviderId);
      expect(typeof a.capabilities.maxContextTokens).toBe('number');
      expect(a.capabilities.maxContextTokens).toBeGreaterThan(0);
      expect(typeof a.capabilities.maxOutputTokens).toBe('number');
      expect(a.capabilities.maxOutputTokens).toBeGreaterThan(0);
      for (const flag of [
        'supportsStreaming',
        'supportsTools',
        'supportsJsonMode',
        'supportsJsonSchema',
        'supportsVision',
        'supportsEmbeddings',
      ] as const) {
        expect(typeof a.capabilities[flag]).toBe('boolean');
      }
    });

    it('chat() returns a well-formed ChatResponse with non-negative cost', async () => {
      const a = cfg.buildAdapter();
      const res: ChatResponse = await a.chat(
        makeReq(),
        { ...FAKE_KEY, provider: cfg.expectedProviderId },
        cfg.modelId,
      );
      expect(['stop', 'length', 'tool', 'content_filter', 'error']).toContain(res.finishReason);
      expect(res.usage.promptTokens).toBeGreaterThanOrEqual(0);
      expect(res.usage.completionTokens).toBeGreaterThanOrEqual(0);
      expect(res.usage.totalTokens).toBeGreaterThanOrEqual(0);
      expect(res.cost.provider).toBe(cfg.expectedProviderId);
      expect(res.cost.model).toBe(cfg.modelId);
      expect(typeof res.cost.usd).toBe('number');
      expect(res.cost.usd).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(res.cost.usd)).toBe(true);
      expect(res.cached).toBe(false);
    });

    it('validateCredentials() returns {valid:true} for a working client', async () => {
      const a = cfg.buildAdapter();
      const r = await a.validateCredentials({ ...FAKE_KEY, provider: cfg.expectedProviderId });
      expect(r.valid).toBe(true);
    });

    it('validateCredentials() reports auth failure as {valid:false, reason} (does not throw)', async () => {
      const a = cfg.buildAuthFailingAdapter();
      const r = await a.validateCredentials({ ...FAKE_KEY, provider: cfg.expectedProviderId });
      expect(r.valid).toBe(false);
      expect(typeof r.reason).toBe('string');
      expect((r.reason ?? '').length).toBeGreaterThan(0);
    });
  });
}
