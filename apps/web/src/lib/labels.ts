/**
 * Human-friendly display labels for raw enum values.
 *
 * No raw enum tokens (openai, azure_openai, pending_validation, …) should ever
 * reach the UI. These maps are the single source of truth for turning contract
 * enums into product copy. `Record<Enum, string>` makes them exhaustive: adding
 * a new enum member is a compile error until a label is provided.
 *
 * Each accessor falls back to `titleCase` so a value typed loosely as `string`
 * (or a future enum member not yet mapped) still renders readably instead of
 * leaking a snake_case token.
 */
import type {
  KeyStatus,
  ProviderId,
  VentureJobStatus,
  VentureStatus,
} from '@foundry/contracts';

/** snake_case / kebab / lowercase → Title Case fallback. */
export function titleCase(raw: string): string {
  if (!raw) return raw;
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  openai: 'OpenAI',
  azure_openai: 'Azure OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  github_models: 'GitHub Models',
  ollama: 'Ollama',
  azure_ai_foundry: 'Azure AI Foundry',
  github: 'GitHub',
};

export const KEY_STATUS_LABEL: Record<KeyStatus, string> = {
  pending_validation: 'Pending validation',
  active: 'Active',
  revoked: 'Revoked',
  invalid: 'Invalid',
};

export const VENTURE_STATUS_LABEL: Record<VentureStatus, string> = {
  draft: 'Draft',
  researching: 'Researching',
  validating: 'Validating',
  pivoting: 'Pivoting',
  approved: 'Approved',
  building: 'Building',
  archived: 'Archived',
  rejected: 'Rejected',
};

export const JOB_STATUS_LABEL: Record<VentureJobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function providerLabel(id: string): string {
  return PROVIDER_LABEL[id as ProviderId] ?? titleCase(id);
}

export function keyStatusLabel(s: string): string {
  return KEY_STATUS_LABEL[s as KeyStatus] ?? titleCase(s);
}

export function ventureStatusLabel(s: string): string {
  return VENTURE_STATUS_LABEL[s as VentureStatus] ?? titleCase(s);
}

export function jobStatusLabel(s: string): string {
  return JOB_STATUS_LABEL[s as VentureJobStatus] ?? titleCase(s);
}
