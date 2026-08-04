/**
 * PersonaLab server-only factory.
 *
 * Composes the BYOK credential service with a per-request `ChatFn` that targets
 * the user's selected provider. The decrypted secret is held only inside the
 * `withDecryptedSecret` callback and never persisted, returned to the browser,
 * logged, or placed into audit metadata.
 *
 * TinyTroupe Python bridge: when `VENTUREOS_TINYTROUPE_PYTHON` is set, the host
 * may also choose to run the alternate TinyTroupe-backed engine that ships in
 * `packages/adapters/tinytroupe-py`. See `tinytroupeBridge` below for the
 * subprocess contract — it inherits ONLY a curated set of environment variables
 * so the decrypted secret never reaches a logged shell line.
 */
import 'server-only';

import type { ProviderId, ChatRequest, ChatResponse, CallContext } from '@foundry/contracts';
import {
  PersonaLab,
  type GenerationTelemetry,
  type PersonaLabBrief,
  type PersonaLabPersona,
  type PersonaLabOptions,
} from '@foundry/personalab';
import { ProviderError, ProviderModelNotFoundError } from '@foundry/providers-core';
import { OpenAiAdapter } from '@foundry/providers-openai';
import { AnthropicAdapter } from '@foundry/providers-anthropic';
import { GeminiAdapter } from '@foundry/providers-gemini';
import { AzureOpenAiAdapter } from '@foundry/providers-azure-openai';

import { getCredentialService } from './credentials';
import { isTinyTroupeBridgeEnabled, runTinyTroupeBridge } from './tinytroupe-bridge';
import { isValidatedModel, missingCredentialReason, unsupportedModelReason } from './model-support';

export type PersonaLabAction =
  | 'generatePersonas'
  | 'runInterview'
  | 'runFocusGroup'
  | 'runBuyingCommittee'
  | 'extractInsights'
  | 'validatePersonaSet';

export type PersonaLabEngine = 'builtin' | 'tinytroupe';

const TINYTROUPE_ACTIONS: ReadonlySet<PersonaLabAction> = new Set([
  'generatePersonas',
  'runInterview',
  'runFocusGroup',
  'runBuyingCommittee',
]);

export interface RunPersonaLabInput {
  userId: string;
  providerCredentialId: string;
  modelId: string;
  brief: PersonaLabBrief;
  action: PersonaLabAction;
  /**
   * Persona simulation engine. Defaults to `'builtin'` (in-process LLM via the
   * provider abstraction). When set to `'tinytroupe'`, the orchestrator routes
   * the call through the TinyTroupe Python subprocess bridge. The bridge is
   * only usable when `VENTUREOS_TINYTROUPE_PYTHON` is configured AND the
   * action is one of generate/interview/focusGroup/buyingCommittee.
   * `extractInsights` and `validatePersonaSet` always run in-process.
   */
  engine?: PersonaLabEngine;
  /** Action-specific extras. */
  personas?: PersonaLabPersona[];
  persona?: PersonaLabPersona;
  topic?: string;
  questions?: string[];
  rounds?: number;
  offerSummary?: string;
  transcripts?: unknown[];
  n?: number;
  /**
   * Optional per-generation telemetry sink. The job layer wires this to record
   * real token usage/cost and structured-output diagnostics (repair/retry).
   */
  onTelemetry?: (telemetry: GenerationTelemetry) => void;
  /**
   * Optional cooperative abort signal. The job layer wires this to the
   * orchestrator's per-job hard timeout so a hung provider call is aborted
   * instead of running to the serverless function ceiling.
   */
  signal?: AbortSignal;
}

export type PersonaLabResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: string };

export async function runPersonaLabAction(input: RunPersonaLabInput): Promise<PersonaLabResult> {
  const service = getCredentialService();

  // For validatePersonaSet we don't need any provider call at all.
  if (input.action === 'validatePersonaSet') {
    const personas = input.personas ?? [];
    const lab = new PersonaLab(
      async () => { throw new Error('chat should not be called for validatePersonaSet'); },
      buildOptions(input, { tenantId: input.userId, traceId: traceId(input) }),
    );
    const result = await lab.validatePersonaSet({ personas });
    return { ok: true, data: result };
  }

  const used = await service.withDecryptedSecret(
    input.userId,
    input.providerCredentialId,
    async ({ secret, providerType, config, profile }) => {
      // ── TinyTroupe engine path ──────────────────────────────────────────
      // When the host opted in AND the action is supported AND the bridge is
      // configured, route through the Python subprocess. The decrypted secret
      // leaves this callback ONLY through the curated subprocess env map
      // assembled in `tinytroupe-bridge.ts`.
      if (input.engine === 'tinytroupe' && TINYTROUPE_ACTIONS.has(input.action)) {
        if (!isTinyTroupeBridgeEnabled()) {
          throw new ProviderError(
            'TinyTroupe engine requested but VENTUREOS_TINYTROUPE_PYTHON is not configured.',
          );
        }
        const bridgeRes = await runTinyTroupeBridge({
          command: toBridgeCommand(input.action),
          brief: input.brief,
          args: buildBridgeArgs(input),
          providerType,
          secret,
          config: {
            ...(config.endpoint ? { endpoint: config.endpoint } : {}),
            ...(config.apiVersion ? { apiVersion: config.apiVersion } : {}),
          },
        });
        if (!bridgeRes.ok) {
          throw new ProviderError(bridgeRes.reason);
        }
        // `generate_personas` returns { personas: [...] } — unwrap for parity
        // with the in-process engine which returns the array directly.
        if (input.action === 'generatePersonas') {
          const data = bridgeRes.data as { personas?: PersonaLabPersona[] };
          return data.personas ?? [];
        }
        return bridgeRes.data;
      }

      // ── Built-in engine path (chat → provider abstraction) ──────────────
      const chat = buildChatFn(providerType, secret, config, profile.id);
      const ctx: CallContext = {
        tenantId: input.userId,
        traceId: traceId(input),
      };
      const lab = new PersonaLab(chat, buildOptions(input, ctx, providerType));

      switch (input.action) {
        case 'generatePersonas':
          return lab.generatePersonas({ brief: input.brief, ...(input.n ? { n: input.n } : {}) });
        case 'runInterview': {
          if (!input.persona) throw new Error('persona required');
          return lab.runInterview({
            persona: input.persona,
            topic: input.topic ?? 'discovery',
            questions: input.questions ?? [],
            brief: input.brief,
          });
        }
        case 'runFocusGroup': {
          return lab.runFocusGroup({
            personas: input.personas ?? [],
            topic: input.topic ?? 'discovery',
            brief: input.brief,
            ...(input.rounds ? { rounds: input.rounds } : {}),
          });
        }
        case 'runBuyingCommittee': {
          return lab.runBuyingCommittee({
            personas: input.personas ?? [],
            offerSummary: input.offerSummary ?? '',
            brief: input.brief,
          });
        }
        case 'extractInsights': {
          return lab.extractInsights({
            personas: input.personas ?? [],
            transcripts: (input.transcripts ?? []) as never,
          });
        }
        default: {
          throw new Error(`unreachable action: ${input.action as string}`);
        }
      }
    },
  );

  if (!used.ok) return { ok: false, reason: used.reason };
  return { ok: true, data: used.value };
}

function buildOptions(
  input: RunPersonaLabInput,
  ctx: CallContext,
  provider?: ProviderId,
): PersonaLabOptions {
  return {
    model: input.modelId,
    ctx,
    ...(provider ? { provider } : {}),
    ...(input.onTelemetry ? { onTelemetry: input.onTelemetry } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  };
}

function toBridgeCommand(action: PersonaLabAction): 'generate_personas' | 'run_interview' | 'run_focus_group' | 'run_buying_committee' {
  switch (action) {
    case 'generatePersonas':    return 'generate_personas';
    case 'runInterview':        return 'run_interview';
    case 'runFocusGroup':       return 'run_focus_group';
    case 'runBuyingCommittee':  return 'run_buying_committee';
    default:
      throw new Error(`Action ${action} is not supported by the TinyTroupe bridge.`);
  }
}

function buildBridgeArgs(input: RunPersonaLabInput): Record<string, unknown> {
  switch (input.action) {
    case 'generatePersonas':
      return { n: input.n ?? 6 };
    case 'runInterview':
      return {
        persona: input.persona ?? {},
        topic: input.topic ?? 'discovery',
        questions: input.questions ?? [],
      };
    case 'runFocusGroup':
      return {
        personas: input.personas ?? [],
        topic: input.topic ?? 'discovery',
        rounds: input.rounds ?? 3,
      };
    case 'runBuyingCommittee':
      return {
        personas: input.personas ?? [],
        offerSummary: input.offerSummary ?? '',
      };
    default:
      return {};
  }
}

function traceId(input: RunPersonaLabInput): string {
  return `personalab-${input.action}-${Date.now().toString(36)}`;
}

function buildChatFn(
  providerType: ProviderId,
  secret: string,
  config: { endpoint?: string; apiVersion?: string },
  keyId: string,
) {
  const adapter = buildAdapter(providerType, config);
  if (!adapter) {
    const reason = missingCredentialReason(providerType, config);
    return async (): Promise<ChatResponse> => {
      throw new ProviderError(reason);
    };
  }
  const decrypted = { id: keyId, provider: providerType, secret };
  return async (req: ChatRequest): Promise<ChatResponse> => {
    const model = typeof req.model === 'string' ? req.model : 'default';
    if (!isValidatedModel(providerType, model)) {
      throw new ProviderError(unsupportedModelReason(model));
    }
    try {
      return await adapter.chat(req, decrypted, model);
    } catch (e) {
      if (e instanceof ProviderModelNotFoundError) {
        throw new ProviderError(unsupportedModelReason(model));
      }
      throw e;
    }
  };
}

function buildAdapter(
  providerType: ProviderId,
  config: { endpoint?: string; apiVersion?: string },
) {
  switch (providerType) {
    case 'openai':       return new OpenAiAdapter();
    case 'anthropic':    return new AnthropicAdapter();
    case 'gemini':       return new GeminiAdapter();
    case 'azure_openai': {
      if (!config.endpoint) return null;
      return new AzureOpenAiAdapter({
        endpoint: config.endpoint,
        ...(config.apiVersion ? { apiVersion: config.apiVersion } : {}),
      });
    }
    default: return null;
  }
}
