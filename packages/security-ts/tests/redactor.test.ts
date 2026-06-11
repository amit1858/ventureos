import { describe, expect, it } from 'vitest';
import { defaultRedactor } from '../src/index';

describe('defaultRedactor', () => {
  it('redacts an OpenAI key', () => {
    const r = defaultRedactor.redact('my key is sk-' + 'a'.repeat(40));
    expect(r).toContain('[REDACTED:openai]');
    expect(r).not.toContain('sk-aaaa');
  });
  it('redacts a postgres URL', () => {
    const r = defaultRedactor.redact('db: postgres://user:pw@host:5432/db');
    expect(r).toContain('[REDACTED:pg-url]');
  });
  it('passes plain text untouched', () => {
    expect(defaultRedactor.redact('hello world')).toBe('hello world');
  });
});
