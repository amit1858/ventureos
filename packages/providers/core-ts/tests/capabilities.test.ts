import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_REGISTRY,
  recommendedBudget,
  resolveCapability,
  retryAttemptsFor,
  baseStageTokens,
  type WorkflowStage,
} from '../src/index';

describe('resolveCapability', () => {
  it('returns exact registry entries for known models', () => {
    const c = resolveCapability('openai', 'gpt-4o-mini');
    expect(c.nativeJson).toBe(true);
    expect(c.verbosity).toBe('terse');
    expect(c.reasoning).toBe(false);
  });

  it('marks Anthropic Sonnet as verbose without native JSON (root of Finding A/B)', () => {
    const c = resolveCapability('anthropic', 'claude-sonnet-4-5');
    expect(c.nativeJson).toBe(false);
    expect(c.verbosity).toBe('verbose');
    expect(c.retry).toBe('aggressive');
    expect(c.maxOutputTokens).toBe(8192);
  });

  it('falls back deterministically for unknown OpenAI chat models (native JSON)', () => {
    const c = resolveCapability('openai', 'gpt-4.2-future');
    expect(c.nativeJson).toBe(true);
    expect(c.reasoning).toBe(false);
    expect(c.verbosity).toBe('balanced');
  });

  it('detects reasoning families in the fallback (gpt-5*, o-series)', () => {
    expect(resolveCapability('openai', 'gpt-5.1').reasoning).toBe(true);
    expect(resolveCapability('openai', 'o5-pro').reasoning).toBe(true);
    expect(resolveCapability('azure_openai', 'o3').reasoning).toBe(true);
  });

  it('unknown Anthropic models never get native JSON and use aggressive retry', () => {
    const c = resolveCapability('anthropic', 'claude-future-9');
    expect(c.nativeJson).toBe(false);
    expect(c.retry).toBe('aggressive');
  });

  it('never throws on empty model id', () => {
    expect(() => resolveCapability('gemini', '')).not.toThrow();
  });
});

describe('retryAttemptsFor', () => {
  it('maps retry posture to attempt counts', () => {
    expect(retryAttemptsFor({ retry: 'none' })).toBe(1);
    expect(retryAttemptsFor({ retry: 'standard' })).toBe(3);
    expect(retryAttemptsFor({ retry: 'aggressive' })).toBe(4);
  });
});

describe('CAPABILITY_REGISTRY', () => {
  it('is keyed by provider:model and frozen', () => {
    expect(CAPABILITY_REGISTRY['openai:gpt-4.1']).toBeDefined();
    expect(Object.isFrozen(CAPABILITY_REGISTRY)).toBe(true);
  });
});

describe('recommendedBudget', () => {
  const stages: WorkflowStage[] = ['personas', 'interview', 'focusGroup', 'buyingCommittee', 'insights'];

  it('is deterministic', () => {
    const cap = resolveCapability('anthropic', 'claude-sonnet-4-5');
    expect(recommendedBudget(cap, 'personas')).toBe(recommendedBudget(cap, 'personas'));
  });

  it('scales verbose > balanced > terse for the same stage', () => {
    const terse = resolveCapability('openai', 'gpt-4o-mini');       // terse
    const balanced = resolveCapability('openai', 'gpt-4.1');         // balanced
    const verbose = resolveCapability('anthropic', 'claude-opus-4-1'); // verbose (maxOut 8192)
    for (const stage of stages) {
      const t = recommendedBudget(terse, stage);
      const b = recommendedBudget(balanced, stage);
      const v = recommendedBudget(verbose, stage);
      expect(b).toBeGreaterThanOrEqual(t);
      expect(v).toBeGreaterThanOrEqual(b);
    }
  });

  it('clamps to the model output ceiling', () => {
    const capped = { ...resolveCapability('anthropic', 'claude-sonnet-4-5'), maxOutputTokens: 700 };
    expect(recommendedBudget(capped, 'personas')).toBeLessThanOrEqual(700);
  });

  it('gives verbose Sonnet enough headroom to beat observed live usage', () => {
    // Live Sonnet 4.5 personas completion measured ~3431 tokens; budget must exceed it.
    const sonnet = resolveCapability('anthropic', 'claude-sonnet-4-5');
    expect(recommendedBudget(sonnet, 'personas')).toBeGreaterThan(3431);
  });

  it('adds reasoning headroom for reasoning models', () => {
    const reasoning = resolveCapability('openai', 'gpt-5');
    const nonReasoning = resolveCapability('openai', 'gpt-4o');
    // Same-stage base, reasoning variant gets extra room (both well under their ceilings).
    expect(recommendedBudget(reasoning, 'interview')).toBeGreaterThan(
      recommendedBudget(nonReasoning, 'interview'),
    );
  });

  it('exposes stage base sizes', () => {
    expect(baseStageTokens('personas')).toBeGreaterThan(0);
    expect(baseStageTokens('default')).toBeGreaterThan(0);
  });
});
