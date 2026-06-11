/**
 * Strict JSON parser used to coerce LLM responses into our contract shapes.
 *
 * The LLM is asked to emit a single JSON object. We tolerate:
 *   - ```json … ``` fences anywhere in the response
 *   - leading/trailing prose around the object
 *   - the Anthropic prefill convention (response already starts with `{`)
 *
 * Errors include a short, secret-redacted preview so logs are actionable
 * without leaking the user's API key.
 */

const PREVIEW_MAX = 240;

export class PersonaLabParseError extends Error {
  /** Sanitized, length-capped preview of the raw model response. Safe to log. */
  public readonly preview: string;
  constructor(message: string, public readonly raw: string) {
    const preview = sanitizePreview(raw);
    super(`${message} (preview: ${preview})`);
    this.name = 'PersonaLabParseError';
    this.preview = preview;
  }
}

export function parseJsonBlock<T = unknown>(raw: string): T {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new PersonaLabParseError('Empty model response.', raw ?? '');
  }
  const trimmed = raw.trim();

  // 1. Try a ```json … ``` (or plain ``` … ```) fence found anywhere.
  const fenced = extractFencedJson(trimmed);
  if (fenced) return safeParse<T>(fenced, raw);

  // 2. Fall back to balance-counting from the first `{`.
  const candidate = extractFirstJsonObject(trimmed);
  if (candidate === 'truncated') {
    throw new PersonaLabParseError(
      'Model response started a JSON object but never closed it (likely truncated by max_tokens).',
      raw,
    );
  }
  if (!candidate) {
    throw new PersonaLabParseError('No JSON object found in model response.', raw);
  }
  return safeParse<T>(candidate, raw);
}

function safeParse<T>(candidate: string, raw: string): T {
  try {
    return JSON.parse(candidate) as T;
  } catch (e) {
    throw new PersonaLabParseError(
      `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      raw,
    );
  }
}

/** Find a ```json … ``` (or plain ``` … ```) fence anywhere. */
function extractFencedJson(text: string): string | null {
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const inner = match[1]?.trim();
    if (inner && inner.startsWith('{')) return inner;
  }
  return null;
}

/**
 * Extract the first balanced `{ … }` object starting at the first `{`.
 * Returns the substring on success, `'truncated'` when an open brace was
 * found but never balanced, or `null` when no `{` exists at all.
 */
function extractFirstJsonObject(text: string): string | 'truncated' | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
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
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return 'truncated';
}

/** Single-line, length-capped, secret-redacted preview of a raw response. */
function sanitizePreview(raw: string): string {
  const oneLine = raw.replace(/\s+/g, ' ').trim();
  const redacted = oneLine
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
    .replace(/sk-[A-Za-z0-9-_]{8,}/g, 'sk-***')
    .replace(/ghp_[A-Za-z0-9]{20,}/g, 'ghp_***')
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, 'github_pat_***')
    .replace(/ant-api[A-Za-z0-9-_]{8,}/gi, 'ant-api-***');
  return redacted.length > PREVIEW_MAX
    ? `${redacted.slice(0, PREVIEW_MAX)}…`
    : redacted;
}

export function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

export function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function clamp01(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(1, Math.max(0, n));
}
