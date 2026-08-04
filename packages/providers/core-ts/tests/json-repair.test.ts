import { describe, expect, it } from 'vitest';

import {
  extractJsonCandidate,
  parseStructured,
  repairJsonCandidate,
  sanitizeJsonPreview,
  StructuredParseError,
  tryParseStructured,
} from '../src/index';

const VALID = { personas: [{ id: 'p1', name: 'A' }] };

describe('extractJsonCandidate', () => {
  it('extracts pure JSON', () => {
    const r = extractJsonCandidate(JSON.stringify(VALID));
    expect(r.truncated).toBe(false);
    expect(JSON.parse(r.candidate!)).toEqual(VALID);
  });

  it('extracts JSON from a ```json fence', () => {
    const raw = 'Here:\n```json\n' + JSON.stringify(VALID) + '\n```\n';
    expect(JSON.parse(extractJsonCandidate(raw).candidate!)).toEqual(VALID);
  });

  it('extracts JSON with surrounding prose', () => {
    const raw = 'Sure. ' + JSON.stringify(VALID) + ' Done.';
    expect(JSON.parse(extractJsonCandidate(raw).candidate!)).toEqual(VALID);
  });

  it('does not miscount braces inside string values', () => {
    const obj = { quote: 'curly { in } a string', n: 1 };
    expect(JSON.parse(extractJsonCandidate(JSON.stringify(obj)).candidate!)).toEqual(obj);
  });

  it('flags an unbalanced object as truncated and returns the partial', () => {
    const r = extractJsonCandidate('{"a": [ {"id": "p1"');
    expect(r.truncated).toBe(true);
    expect(r.candidate).toBe('{"a": [ {"id": "p1"');
  });

  it('returns null candidate when no object present', () => {
    expect(extractJsonCandidate('no json here').candidate).toBeNull();
  });
});

describe('repairJsonCandidate — the six defect classes', () => {
  it('1. truncation: closes unbalanced braces/brackets', () => {
    const repaired = repairJsonCandidate('{"personas": [{"name": "Alice"');
    expect(JSON.parse(repaired)).toEqual({ personas: [{ name: 'Alice' }] });
  });

  it('2. unterminated trailing string is closed', () => {
    const repaired = repairJsonCandidate('{"summary": "it was going we');
    expect(JSON.parse(repaired)).toEqual({ summary: 'it was going we' });
  });

  it('3. unescaped inner double-quotes are escaped (Finding B)', () => {
    const repaired = repairJsonCandidate('{"quote": "he said "hi" to me"}');
    expect(JSON.parse(repaired)).toEqual({ quote: 'he said "hi" to me' });
  });

  it('4. raw control characters inside strings are escaped', () => {
    const repaired = repairJsonCandidate('{"a": "line1\nline2\tend"}');
    expect(JSON.parse(repaired)).toEqual({ a: 'line1\nline2\tend' });
  });

  it('5. trailing commas before } and ] are dropped', () => {
    expect(JSON.parse(repairJsonCandidate('{"a":1,"b":2,}'))).toEqual({ a: 1, b: 2 });
    expect(JSON.parse(repairJsonCandidate('{"a":[1,2,]}'))).toEqual({ a: [1, 2] });
    expect(JSON.parse(repairJsonCandidate('{"a":[1,2,],}'))).toEqual({ a: [1, 2] });
  });

  it('6. combined truncation + trailing comma is recovered', () => {
    const raw = '{"items": [{"k": 1},{"k": 2},';
    expect(JSON.parse(repairJsonCandidate(raw))).toEqual({ items: [{ k: 1 }, { k: 2 }] });
  });

  it('preserves already-valid escapes and does not corrupt clean JSON', () => {
    const obj = { a: 'tab\tnewline\nquote\"end', b: [1, 2, { c: true }] };
    const clean = JSON.stringify(obj);
    expect(JSON.parse(repairJsonCandidate(clean))).toEqual(obj);
  });
});

describe('tryParseStructured', () => {
  it('parses valid JSON without repair', () => {
    const r = tryParseStructured(JSON.stringify(VALID));
    expect(r).toMatchObject({ ok: true, repaired: false });
  });

  it('repairs malformed JSON and reports repaired=true', () => {
    const r = tryParseStructured('{"quote": "a "b" c"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.repaired).toBe(true);
  });

  it('recovers truncated JSON via repair with truncated=true', () => {
    const r = tryParseStructured('{"personas": [{"name": "Alice"');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.truncated).toBe(true);
      expect(r.repaired).toBe(true);
      expect(r.value).toEqual({ personas: [{ name: 'Alice' }] });
    }
  });

  it('returns empty/no-object reasons without throwing', () => {
    expect(tryParseStructured('')).toMatchObject({ ok: false, reason: 'empty' });
    expect(tryParseStructured('nope')).toMatchObject({ ok: false, reason: 'no-object' });
  });

  it('honors repair:false (leaves invalid JSON invalid)', () => {
    expect(tryParseStructured('{"a": "x "y"}', { repair: false })).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
  });
});

describe('parseStructured (throwing wrapper)', () => {
  it('throws StructuredParseError with a redacted preview for secrets', () => {
    const raw = 'my key sk-ANTHROPIC-SUPER-SECRET-1234567890 blocked me';
    try {
      parseStructured(raw);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(StructuredParseError);
      const err = e as StructuredParseError;
      expect(err.preview).not.toContain('SUPER-SECRET');
      expect(err.preview).toContain('sk-***');
    }
  });
});

describe('sanitizeJsonPreview', () => {
  it('redacts common secret shapes', () => {
    const raw = 'sk-ABCDEFGH12345678 ghp_ABCDEFGHIJKLMNOPQRSTUV github_pat_ABCDEFGHIJKLMNOPQRST';
    const p = sanitizeJsonPreview(raw);
    expect(p).toContain('sk-***');
    expect(p).toContain('ghp_***');
    expect(p).toContain('github_pat_***');
  });
});
