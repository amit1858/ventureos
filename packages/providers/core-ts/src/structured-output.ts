/**
 * Structured Output Pipeline (Release 1.0 hardening).
 *
 * The single, provider-independent path for turning a chat request into a
 * validated JSON object. Every lab routes structured generation through here,
 * so no workflow carries provider-specific parsing, repair, or retry logic.
 *
 * Sequence:
 *   1. call the model
 *   2. strict JSON parse of the extracted object
 *   3. deterministic repair + re-parse (handles truncation / bad escapes /
 *      control chars / trailing commas — see json-repair.ts)
 *   4. optional caller `coerce` (schema/shape validation; may throw)
 *   5. on any failure, re-ask ONCE with a strengthened "valid JSON only"
 *      instruction (and a raised token budget if the last finish was `length`)
 *   6. otherwise fail with a sanitized, secret-safe error
 *
 * Emits {@link StructuredTelemetry} describing exactly what happened, which the
 * caller forwards into usage/telemetry sinks.
 */
import type { ChatRequest, ChatResponse } from '@foundry/contracts';
import { StructuredParseError, tryParseStructured } from './json-repair';

export type StructuredFinalStatus = 'ok' | 'repaired' | 'retried' | 'failed';

export interface StructuredTelemetry {
  /** finishReason of the response that produced the accepted (or final) output. */
  finishReason: ChatResponse['finishReason'];
  /** True if deterministic repair was attempted at any point. */
  repairApplied: boolean;
  /** True if deterministic repair produced the accepted output. */
  repairSucceeded: boolean;
  /** True if the accepted candidate object was recovered from truncated text. */
  truncated: boolean;
  /** Number of extra model round-trips beyond the first (0 or 1). */
  retryCount: number;
  finalStatus: StructuredFinalStatus;
  /** Usage of the response that produced the accepted (or final) output. */
  usage: ChatResponse['usage'];
  latencyMs: number;
}

export interface StructuredResult<T> {
  data: T;
  telemetry: StructuredTelemetry;
}

export interface GenerateStructuredOptions<T> {
  /** The metering chat function (adapter.chat already bound to key + model). */
  chat: (req: ChatRequest) => Promise<ChatResponse>;
  request: ChatRequest;
  /** Map/validate the parsed object into the domain type. May throw to force a retry. */
  coerce?: (parsed: unknown) => T;
  /** System nudge merged into the final user turn on retry. */
  retryInstruction?: string;
  /** Extra round-trips allowed on failure. Default 1. */
  maxRetries?: number;
  /** If the last finish was `length`, raise maxTokens to this on retry. */
  retryMaxTokens?: number;
}

const DEFAULT_RETRY_INSTRUCTION =
  'Your previous response could not be parsed as JSON. Respond with ONLY a single ' +
  'valid JSON object — no prose, no markdown fences — and ensure every string value ' +
  'has properly escaped quotes and control characters.';

/**
 * Generate a validated JSON object from a chat request, provider-independently.
 * Throws {@link StructuredParseError} only after the retry budget is exhausted.
 */
export async function generateStructured<T = unknown>(
  opts: GenerateStructuredOptions<T>,
): Promise<StructuredResult<T>> {
  const started = Date.now();
  const maxRetries = opts.maxRetries ?? 1;
  const retryInstruction = opts.retryInstruction ?? DEFAULT_RETRY_INSTRUCTION;

  let request = opts.request;
  let attempt = 0;
  let repairApplied = false;
  let lastRaw = '';

  for (;;) {
    const res = await opts.chat(request);
    const raw = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    lastRaw = raw;

    const parsed = tryParseStructured<unknown>(raw, { repair: true });

    if (parsed.ok) {
      if (parsed.repaired) repairApplied = true;
      // Shape/schema validation is a distinct, retryable failure mode.
      let coerceError: unknown = null;
      let data: T | undefined;
      try {
        data = opts.coerce ? opts.coerce(parsed.value) : (parsed.value as T);
      } catch (e) {
        coerceError = e;
      }
      if (!coerceError) {
        const finalStatus: StructuredFinalStatus =
          attempt > 0 ? 'retried' : parsed.repaired ? 'repaired' : 'ok';
        return {
          data: data as T,
          telemetry: {
            finishReason: res.finishReason,
            repairApplied,
            repairSucceeded: parsed.repaired,
            truncated: parsed.truncated,
            retryCount: attempt,
            finalStatus,
            usage: res.usage,
            latencyMs: Date.now() - started,
          },
        };
      }
      // fall through to retry / fail on coerce error
      if (attempt >= maxRetries) {
        throw wrapFailure(coerceError, raw, started, res, repairApplied, attempt);
      }
    } else {
      // Parse failed. If repair was attempted (even unsuccessfully), record it.
      if (parsed.reason === 'invalid-after-repair') repairApplied = true;
      if (attempt >= maxRetries) {
        throw new StructuredParseError(parsed.message, raw);
      }
    }

    // ── prepare the single re-ask ──
    attempt += 1;
    request = withRetryInstruction(opts.request, retryInstruction);
    if (opts.retryMaxTokens && res.finishReason === 'length') {
      request = { ...request, maxTokens: opts.retryMaxTokens };
    }
  }

  // Unreachable — the loop returns or throws. Kept for exhaustiveness.
  // eslint-disable-next-line no-unreachable
  throw new StructuredParseError('Structured generation exhausted retries.', lastRaw);
}

/**
 * Merge the retry instruction into the final user turn (provider-neutral —
 * avoids appending an extra message, which some providers reject as a
 * non-alternating turn). Falls back to the system message, then to a new turn.
 */
function withRetryInstruction(request: ChatRequest, instruction: string): ChatRequest {
  const messages = request.messages.map((m) => ({ ...m }));
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'user') {
      messages[i] = { ...m, content: `${m.content}\n\n${instruction}` };
      return { ...request, messages };
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'system') {
      messages[i] = { ...m, content: `${m.content}\n\n${instruction}` };
      return { ...request, messages };
    }
  }
  return { ...request, messages: [...messages, { role: 'user', content: instruction }] };
}

function wrapFailure(
  err: unknown,
  raw: string,
  _started: number,
  _res: ChatResponse,
  _repairApplied: boolean,
  _attempt: number,
): Error {
  if (err instanceof StructuredParseError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  return new StructuredParseError(`Structured output failed validation: ${msg}`, raw);
}
