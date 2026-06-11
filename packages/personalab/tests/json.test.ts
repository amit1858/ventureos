import { describe, expect, it } from 'vitest';

import { parseJsonBlock, PersonaLabParseError } from '../src/json';

const VALID = { personas: [{ id: 'p1', name: 'A' }] };

describe('parseJsonBlock', () => {
  it('parses pure JSON', () => {
    expect(parseJsonBlock(JSON.stringify(VALID))).toEqual(VALID);
  });

  it('parses JSON inside ```json fence', () => {
    const raw = "Sure! Here you go:\n```json\n" + JSON.stringify(VALID) + "\n```\n";
    expect(parseJsonBlock(raw)).toEqual(VALID);
  });

  it('parses JSON inside an unlabeled ``` fence', () => {
    const raw = "```\n" + JSON.stringify(VALID) + "\n```";
    expect(parseJsonBlock(raw)).toEqual(VALID);
  });

  it('parses JSON with prose before and after', () => {
    const raw =
      'Here are 1 personas as requested.\n' +
      JSON.stringify(VALID) +
      '\nLet me know if you want more.';
    expect(parseJsonBlock(raw)).toEqual(VALID);
  });

  it('handles braces inside string values without losing balance', () => {
    const obj = { quote: 'curly { in } a string', n: 1 };
    expect(parseJsonBlock(JSON.stringify(obj))).toEqual(obj);
  });

  it('reports a truncation-specific error when the object is unbalanced', () => {
    const raw = '{"personas": [ {"id": "p1", "name": "A"';
    expect(() => parseJsonBlock(raw)).toThrow(PersonaLabParseError);
    try { parseJsonBlock(raw); } catch (e) {
      expect((e as PersonaLabParseError).message).toContain('truncated');
    }
  });

  it('throws PersonaLabParseError with sanitized preview for invalid JSON', () => {
    const raw = 'Sorry, my key is sk-ANTHROPIC-SUPER-SECRET-1234567890 and I cannot reply.';
    try {
      parseJsonBlock(raw);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(PersonaLabParseError);
      const err = e as PersonaLabParseError;
      expect(err.message).toContain('No JSON object found');
      // Preview must redact secrets and never include the raw key.
      expect(err.preview).not.toContain('SUPER-SECRET');
      expect(err.message).not.toContain('SUPER-SECRET');
      expect(err.preview).toContain('sk-***');
    }
  });

  it('redacts Bearer / GitHub / Anthropic key shapes in the preview', () => {
    const raw =
      'fail: Bearer abcd.efgh-0123_4567 and ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345 and github_pat_ABCDEFGHIJKLMNOPQRST.';
    try { parseJsonBlock(raw); } catch (e) {
      const err = e as PersonaLabParseError;
      expect(err.preview).toContain('Bearer ***');
      expect(err.preview).toContain('ghp_***');
      expect(err.preview).toContain('github_pat_***');
      expect(err.preview).not.toContain('ABCDEFGHIJKLMNOPQRST');
    }
  });

  it('throws on empty string', () => {
    expect(() => parseJsonBlock('')).toThrow(PersonaLabParseError);
  });

  it('throws on syntactically invalid JSON with a descriptive message', () => {
    try {
      parseJsonBlock('{ bad json,, }');
      throw new Error('expected throw');
    } catch (e) {
      const err = e as PersonaLabParseError;
      expect(err).toBeInstanceOf(PersonaLabParseError);
      expect(err.message).toContain('Invalid JSON');
    }
  });
});
