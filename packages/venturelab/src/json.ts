/**
 * Tiny JSON helpers — duplicated from @ventureos/personalab to keep the
 * package boundary clean (personalab is a peer, not a parent).
 */
export class VentureLabParseError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message);
    this.name = 'VentureLabParseError';
  }
}

export function parseJsonBlock<T = unknown>(raw: string): T {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new VentureLabParseError('Empty model response.', raw ?? '');
  }
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const candidate = fenceMatch?.[1]?.trim() ?? extractFirstJsonObject(trimmed);
  if (!candidate) {
    throw new VentureLabParseError('No JSON object found in model response.', raw);
  }
  try {
    return JSON.parse(candidate) as T;
  } catch (e) {
    throw new VentureLabParseError(
      `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      raw,
    );
  }
}

function extractFirstJsonObject(text: string): string | null {
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
  return null;
}

export function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

export function clamp01(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(1, Math.max(0, n));
}

export function clamp100(v: unknown, fallback = 50): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.round(Math.min(100, Math.max(0, n)));
}
