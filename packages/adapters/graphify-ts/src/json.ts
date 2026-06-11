/**
 * Robust JSON parser tolerant of fenced/preambled LLM output. Mirrors the
 * VentureLab json.ts helper.
 */

export class GraphifyParseError extends Error {
  constructor(message: string, public readonly snippet?: string) {
    super(message);
    this.name = 'GraphifyParseError';
  }
}

export function parseJsonBlock<T = unknown>(text: string): T {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new GraphifyParseError('empty response');
  }
  const stripped = stripFences(text).trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // fall through to brace-balanced extraction
  }
  const block = extractBalancedBlock(stripped);
  if (!block) throw new GraphifyParseError('no JSON object found', stripped.slice(0, 200));
  try {
    return JSON.parse(block) as T;
  } catch (e) {
    throw new GraphifyParseError(`invalid JSON: ${(e as Error).message}`, block.slice(0, 200));
  }
}

function stripFences(s: string): string {
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i;
  const m = s.trim().match(fence);
  if (m && typeof m[1] === 'string') return m[1];
  return s;
}

function extractBalancedBlock(s: string): string | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

export function clamp01(n: unknown, fallback = 0.5): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}
