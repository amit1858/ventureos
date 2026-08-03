/**
 * Deterministic JSON extraction + repair (Release 1.0 hardening).
 *
 * Providers without a native JSON mode (Anthropic uses a `{` prefill) can emit
 * *almost* valid JSON — an unescaped quote inside a long transcript string, a
 * raw control character, a trailing comma, or a response truncated by the
 * output ceiling. This module recovers such payloads WITHOUT any AI round-trip:
 * every transform is a pure, deterministic string operation.
 *
 * It is provider-independent on purpose — the structured-output pipeline calls
 * it for every provider so no lab contains provider-specific parsing.
 */

const PREVIEW_MAX = 240;

/** Raised when a model response cannot be coerced into a JSON object. */
export class StructuredParseError extends Error {
  /** Sanitized, length-capped preview of the raw response. Safe to log. */
  public readonly preview: string;
  constructor(message: string, public readonly raw: string) {
    const preview = sanitizeJsonPreview(raw);
    super(`${message} (preview: ${preview})`);
    this.name = 'StructuredParseError';
    this.preview = preview;
  }
}

/** Outcome of a parse attempt (no exceptions used for control flow). */
export type ParseOutcome<T> =
  | { ok: true; value: T; repaired: boolean; truncated: boolean }
  | { ok: false; reason: 'empty' | 'no-object' | 'invalid' | 'invalid-after-repair'; message: string };

/**
 * Extract the JSON object substring from a raw model response.
 * Prefers a fenced block, else balance-counts from the first `{`.
 * When an object opens but never closes, returns the partial text with
 * `truncated: true` so the repairer can attempt to close it.
 */
export function extractJsonCandidate(text: string): { candidate: string | null; truncated: boolean } {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { candidate: null, truncated: false };
  const fenced = extractFencedJson(trimmed);
  const src = fenced ?? trimmed;

  const start = src.indexOf('{');
  if (start < 0) return { candidate: null, truncated: false };

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { candidate: src.slice(start, i + 1), truncated: false };
    }
  }
  // Opened but never balanced → hand the partial text to the repairer.
  return { candidate: src.slice(start), truncated: true };
}

/**
 * Deterministically repair a near-valid JSON object string.
 *
 * Single left-to-right pass that:
 *   - escapes raw control characters inside strings (\n, \t, … , \uXXXX)
 *   - escapes unescaped inner double-quotes (closing vs inner decided by the
 *     next non-whitespace character being a JSON structural token)
 *   - drops trailing commas before `}`/`]`
 *   - closes an unterminated trailing string
 *   - balances unclosed `{`/`[` (truncation recovery)
 */
export function repairJsonCandidate(input: string): string {
  let out = '';
  let inString = false;
  let escape = false;
  const stack: Array<'{' | '['> = [];

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;

    if (inString) {
      if (escape) { out += ch; escape = false; continue; }
      if (ch === '\\') { out += ch; escape = true; continue; }
      if (ch === '"') {
        // Closing quote iff the next non-whitespace char terminates a value/key.
        const nextCh = nextNonWhitespace(input, i + 1);
        if (nextCh === '' || nextCh === ':' || nextCh === ',' || nextCh === '}' || nextCh === ']') {
          out += '"';
          inString = false;
        } else {
          out += '\\"'; // inner unescaped quote
        }
        continue;
      }
      const code = ch.charCodeAt(0);
      out += code < 0x20 ? escapeControlChar(ch) : ch;
      continue;
    }

    // Outside a string.
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === '{') { stack.push('{'); out += ch; continue; }
    if (ch === '[') { stack.push('['); out += ch; continue; }
    if (ch === '}' || ch === ']') {
      out = dropTrailingComma(out);
      if (stack[stack.length - 1] === (ch === '}' ? '{' : '[')) stack.pop();
      out += ch;
      continue;
    }
    out += ch;
  }

  if (inString) out += '"'; // close an unterminated string
  out = dropTrailingComma(out);

  // Balance any still-open containers, innermost first.
  for (let i = stack.length - 1; i >= 0; i--) {
    out = dropTrailingComma(out);
    out += stack[i] === '{' ? '}' : ']';
  }
  return out;
}

/**
 * Parse a raw model response into an object, attempting deterministic repair.
 * Never throws — returns a discriminated {@link ParseOutcome}.
 */
export function tryParseStructured<T = unknown>(
  raw: string,
  opts: { repair?: boolean } = {},
): ParseOutcome<T> {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, reason: 'empty', message: 'Empty model response.' };
  }
  const { candidate, truncated } = extractJsonCandidate(raw);
  if (candidate === null) {
    return { ok: false, reason: 'no-object', message: 'No JSON object found in model response.' };
  }
  try {
    return { ok: true, value: JSON.parse(candidate) as T, repaired: false, truncated };
  } catch (strictErr) {
    if (opts.repair === false) {
      return { ok: false, reason: 'invalid', message: `Invalid JSON: ${errMsg(strictErr)}` };
    }
    const repaired = repairJsonCandidate(candidate);
    try {
      return { ok: true, value: JSON.parse(repaired) as T, repaired: true, truncated };
    } catch (repairErr) {
      return { ok: false, reason: 'invalid-after-repair', message: `Invalid JSON after repair: ${errMsg(repairErr)}` };
    }
  }
}

/** Throwing convenience wrapper over {@link tryParseStructured}. */
export function parseStructured<T = unknown>(
  raw: string,
  opts: { repair?: boolean } = {},
): { value: T; repaired: boolean; truncated: boolean } {
  const outcome = tryParseStructured<T>(raw, opts);
  if (outcome.ok) return { value: outcome.value, repaired: outcome.repaired, truncated: outcome.truncated };
  throw new StructuredParseError(outcome.message, raw);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function extractFencedJson(text: string): string | null {
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const inner = match[1]?.trim();
    if (inner && inner.startsWith('{')) return inner;
  }
  return null;
}

function nextNonWhitespace(text: string, from: number): string {
  for (let i = from; i < text.length; i++) {
    const ch = text[i]!;
    if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') return ch;
  }
  return '';
}

function escapeControlChar(ch: string): string {
  switch (ch) {
    case '\n': return '\\n';
    case '\r': return '\\r';
    case '\t': return '\\t';
    case '\b': return '\\b';
    case '\f': return '\\f';
    default:   return `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
  }
}

/** Remove a trailing comma (and following whitespace) from accumulated output. */
function dropTrailingComma(out: string): string {
  return out.replace(/,\s*$/, '');
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Single-line, length-capped, secret-redacted preview of a raw response. */
export function sanitizeJsonPreview(raw: string): string {
  const oneLine = (raw ?? '').replace(/\s+/g, ' ').trim();
  const redacted = oneLine
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, '******')
    .replace(/sk-[A-Za-z0-9-_]{8,}/g, 'sk-***')
    .replace(/ghp_[A-Za-z0-9]{20,}/g, 'ghp_***')
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, 'github_pat_***')
    .replace(/ant-api[A-Za-z0-9-_]{8,}/gi, 'ant-api-***');
  return redacted.length > PREVIEW_MAX ? `${redacted.slice(0, PREVIEW_MAX)}…` : redacted;
}
