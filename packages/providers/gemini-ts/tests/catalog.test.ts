import { describe, expect, it } from 'vitest';

import { GEMINI_KNOWN_MODELS } from '../src/index';
import { pricingFor } from '../src/cost';

describe('Gemini catalog currency', () => {
  it('leads with current 2.x models', () => {
    expect(GEMINI_KNOWN_MODELS).toContain('gemini-2.5-flash');
    expect(GEMINI_KNOWN_MODELS).toContain('gemini-2.5-pro');
    expect(GEMINI_KNOWN_MODELS).toContain('gemini-2.0-flash');
    // The first entry should be a current-generation default.
    expect(GEMINI_KNOWN_MODELS[0]).toBe('gemini-2.5-flash');
  });

  it('prices the current models (non-zero) and unknown models at zero', () => {
    expect(pricingFor('gemini-2.5-flash').outputUsdPer1k).toBeGreaterThan(0);
    expect(pricingFor('gemini-2.5-pro').outputUsdPer1k).toBeGreaterThan(0);
    expect(pricingFor('made-up-gemini')).toEqual({ inputUsdPer1k: 0, outputUsdPer1k: 0 });
  });
});
