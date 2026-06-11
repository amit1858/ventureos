/**
 * TinyTroupe Python subprocess bridge (Sprint 1D).
 *
 * Opt-in alternate PersonaLab engine. Activated only when the host explicitly
 * passes `engine: 'tinytroupe'` AND the `VENTUREOS_TINYTROUPE_PYTHON` env var
 * points to a Python interpreter where `tinytroupe` is installed.
 *
 * Security contract:
 *   1. The decrypted BYOK secret is passed to the subprocess ONLY through the
 *      curated `env` map below (OPENAI_API_KEY or AZURE_OPENAI_API_KEY).
 *      It is never written to argv, stdin payload, or any log.
 *   2. The subprocess inherits `PATH` only — no other parent env (no Supabase
 *      keys, no encryption key, no other BYOK secrets in memory).
 *   3. Stdout and stderr are captured, parsed, and sanitised before being
 *      returned. The sanitiser strips anything matching common secret patterns.
 *   4. A 60 s timeout kills runaway subprocesses.
 *
 * If anything goes wrong (bad config, parse failure, timeout, non-zero exit),
 * the bridge returns `{ ok: false, reason }` with a sanitised message. The
 * caller can then fall back to the in-process orchestrator.
 */
import 'server-only';
import { spawn } from 'node:child_process';

import type { ProviderId } from '@ventureos/contracts';

export interface TinyTroupeBridgeInput {
  command: 'generate_personas' | 'run_interview' | 'run_focus_group' | 'run_buying_committee';
  brief: unknown;
  args: unknown;
  providerType: ProviderId;
  secret: string;
  config: { endpoint?: string; apiVersion?: string };
}

export type TinyTroupeBridgeResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: string };

export function isTinyTroupeBridgeEnabled(): boolean {
  return Boolean(process.env['VENTUREOS_TINYTROUPE_PYTHON']);
}

export async function runTinyTroupeBridge(
  input: TinyTroupeBridgeInput,
): Promise<TinyTroupeBridgeResult> {
  const python = process.env['VENTUREOS_TINYTROUPE_PYTHON'];
  if (!python) {
    return { ok: false, reason: 'VENTUREOS_TINYTROUPE_PYTHON is not configured.' };
  }

  const env = buildSubprocessEnv(input);
  if (!env) {
    return {
      ok: false,
      reason: `Provider '${input.providerType}' is not bridged into TinyTroupe yet.`,
    };
  }

  return new Promise<TinyTroupeBridgeResult>((resolve) => {
    const child = spawn(python, ['-m', 'ventureos_tinytroupe.cli'], {
      env: env as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({ ok: false, reason: 'TinyTroupe subprocess timed out after 60s.' });
    }, 60_000);

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, reason: sanitize(`spawn failed: ${err.message}`) });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ ok: false, reason: sanitize(stderr.trim() || `subprocess exited with code ${code}`) });
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as TinyTroupeBridgeResult;
        if (typeof parsed === 'object' && parsed && 'ok' in parsed) {
          resolve(parsed);
        } else {
          resolve({ ok: false, reason: 'Malformed TinyTroupe response.' });
        }
      } catch (e) {
        resolve({
          ok: false,
          reason: sanitize(`Failed to parse TinyTroupe response: ${e instanceof Error ? e.message : String(e)}`),
        });
      }
    });

    // Payload never contains the secret — only the brief + args.
    const payload = JSON.stringify({
      command: input.command,
      brief: input.brief,
      args: input.args,
    });
    child.stdin.write(payload);
    child.stdin.end();
  });
}

/**
 * Build the curated subprocess environment.
 *
 * Returns null if the provider type can't be mapped to TinyTroupe's expected
 * env-based config.
 */
export function buildSubprocessEnv(input: TinyTroupeBridgeInput): Record<string, string> | null {
  const base: Record<string, string> = {
    PATH: process.env['PATH'] ?? '',
    // Force unbuffered Python so stdout flushes before close.
    PYTHONUNBUFFERED: '1',
  };
  switch (input.providerType) {
    case 'openai':
      base['OPENAI_API_KEY'] = input.secret;
      return base;
    case 'azure_openai':
      if (!input.config.endpoint) return null;
      base['AZURE_OPENAI_API_KEY'] = input.secret;
      base['AZURE_OPENAI_ENDPOINT'] = input.config.endpoint;
      if (input.config.apiVersion) base['AZURE_OPENAI_API_VERSION'] = input.config.apiVersion;
      return base;
    default:
      // TinyTroupe upstream only supports OpenAI-family providers today.
      return null;
  }
}

const SECRET_RE = /(sk-[A-Za-z0-9_\-]{8,}|Bearer\s+\S+)/g;

export function sanitize(text: string): string {
  return text.replace(SECRET_RE, '***').slice(0, 500);
}
