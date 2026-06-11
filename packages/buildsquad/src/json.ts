/**
 * Tolerant JSON helpers reused from venturelab/graphify. LLMs frequently wrap
 * JSON in ``` fences or add stray prose; we strip and brace-balance.
 */
export function stripFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (m && typeof m[1] === 'string') return m[1].trim();
  return text.trim();
}

export function parseJsonBlock<T = unknown>(text: string): T | null {
  if (!text) return null;
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* fall through to brace-balance recovery */
  }
  const start = cleaned.indexOf('{');
  const startArr = cleaned.indexOf('[');
  let i = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (i === -1) return null;
  const open = cleaned[i] === '{' ? '{' : '[';
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(cleaned.indexOf(open), i + 1)) as T;
        } catch {
          return null;
        }
      }
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

export function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
