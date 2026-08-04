import { describe, expect, it } from 'vitest';

import {
  isValidatedModel,
  knownModelsFor,
  missingCredentialReason,
  providerLabel,
  unsupportedModelReason,
} from '../src/lib/model-support';

describe('isValidatedModel', () => {
  it('accepts catalog models and rejects unknown ones for fixed-catalog providers', () => {
    expect(isValidatedModel('openai', 'gpt-4o-mini')).toBe(true);
    expect(isValidatedModel('openai', 'gpt-4.1')).toBe(true);
    expect(isValidatedModel('openai', 'totally-made-up')).toBe(false);
    expect(isValidatedModel('anthropic', 'claude-sonnet-4-5')).toBe(true);
    expect(isValidatedModel('anthropic', 'claude-2')).toBe(false);
    expect(isValidatedModel('gemini', 'gemini-2.5-flash')).toBe(true);
  });

  it('treats operator-defined identifiers (Azure/Ollama) as allowed', () => {
    expect(isValidatedModel('azure_openai', 'my-custom-deployment')).toBe(true);
    expect(isValidatedModel('ollama', 'llama3.1:8b')).toBe(true);
  });

  it('rejects an empty model id', () => {
    expect(isValidatedModel('openai', '')).toBe(false);
  });
});

describe('unsupportedModelReason', () => {
  it('states the model is not validated and lists the recommended models verbatim', () => {
    const msg = unsupportedModelReason('gpt-4.5-turbo');
    expect(msg).toContain('is not yet validated for Foundry.');
    expect(msg).toContain('gpt-4.5-turbo');
    expect(msg).toContain('Recommended models:');
    expect(msg).toContain('• GPT-4o mini');
    expect(msg).toContain('• GPT-4.1');
    expect(msg).toContain('• Claude Sonnet');
  });

  it('works without a specific model id', () => {
    expect(unsupportedModelReason()).toContain('This model is not yet validated for Foundry.');
  });
});

describe('missingCredentialReason', () => {
  it('explains a missing Azure endpoint specifically', () => {
    const msg = missingCredentialReason('azure_openai', {});
    expect(msg).toContain('endpoint');
    expect(msg).toContain('openai.azure.com');
  });

  it('names the provider for a missing key', () => {
    expect(missingCredentialReason('openai')).toContain('OpenAI');
    expect(missingCredentialReason('gemini')).toContain('Google Gemini');
  });
});

describe('helpers', () => {
  it('exposes catalogs + labels', () => {
    expect(knownModelsFor('openai').length).toBeGreaterThan(0);
    expect(providerLabel('anthropic')).toBe('Anthropic');
  });
});
