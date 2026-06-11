import { describe, expect, it } from 'vitest';
import { maskKey, validateKeyShape } from '../src/index';

describe('maskKey', () => {
  it('masks the middle of a long secret', () => {
    expect(maskKey('sk-abcdefghijklmnopqrstuvwxyz1234')).toBe('sk-a****1234');
  });
  it('returns **** for short / empty input', () => {
    expect(maskKey('')).toBe('****');
    expect(maskKey('abc')).toBe('****');
    expect(maskKey('12345678')).toBe('****');
  });
  it('matches the ByokKey.maskedSecret schema pattern', () => {
    const masked = maskKey('sk-abcdefghijklmnopqrstuvwxyz');
    expect(/^.{0,4}\*{3,}.{0,4}$/.test(masked)).toBe(true);
  });
});

describe('validateKeyShape', () => {
  it('accepts a well-formed OpenAI key', () => {
    expect(validateKeyShape('openai', 'sk-' + 'a'.repeat(40)).ok).toBe(true);
  });
  it('rejects a malformed OpenAI key', () => {
    expect(validateKeyShape('openai', 'not-a-key').ok).toBe(false);
  });
  it('accepts an Anthropic key', () => {
    expect(validateKeyShape('anthropic', 'sk-ant-' + 'x'.repeat(30)).ok).toBe(true);
  });
  it('skips Ollama (no key required)', () => {
    expect(validateKeyShape('ollama', '').ok).toBe(true);
  });
});
