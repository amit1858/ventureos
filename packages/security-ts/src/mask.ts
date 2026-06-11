import type { ProviderId } from '@ventureos/contracts';

/**
 * Display-only mask. Produces `abcd***wxyz` style output that satisfies
 * ByokKey.maskedSecret's schema pattern `^.{0,4}\*{3,}.{0,4}$`.
 * NEVER logs, returns, or persists the plaintext.
 */
export function maskKey(secret: string): string {
  if (typeof secret !== 'string') return '****';
  const trimmed = secret.trim();
  if (trimmed.length === 0) return '****';
  if (trimmed.length <= 8) return '****';
  const head = trimmed.slice(0, 4);
  const tail = trimmed.slice(-4);
  return `${head}****${tail}`;
}

/**
 * Per-provider shape check. Cheap structural validation only — does NOT call the provider.
 * Use `ProviderAdapter.validateKey` for real auth probing.
 */
export interface KeyShapeCheck {
  ok: boolean;
  reason?: string;
}

const PATTERNS: Record<ProviderId, RegExp | null> = {
  openai: /^sk-[A-Za-z0-9_\-]{20,}$/,
  azure_openai: /^[A-Za-z0-9]{32,}$/,
  anthropic: /^sk-ant-[A-Za-z0-9_\-]{20,}$/,
  gemini: /^[A-Za-z0-9_\-]{30,}$/,
  github_models: /^(ghp_|github_pat_)[A-Za-z0-9_]{20,}$/,
  ollama: null,
  azure_ai_foundry: /^[A-Za-z0-9]{32,}$/,
  github: /^(ghp_|github_pat_)[A-Za-z0-9_]{20,}$/,
};

export function validateKeyShape(provider: ProviderId, secret: string): KeyShapeCheck {
  const pattern = PATTERNS[provider];
  if (pattern === null) return { ok: true };
  if (!pattern) return { ok: false, reason: `Unknown provider '${provider}'.` };
  if (!pattern.test(secret)) {
    return { ok: false, reason: `Secret does not match expected pattern for '${provider}'.` };
  }
  return { ok: true };
}
