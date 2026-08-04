import type { ChatRequest, ChatResponse } from '@foundry/contracts';
import type {
  BudgetGuard,
  KeyResolver,
  ProviderClient,
  Redactor,
  RouteResolver,
} from './types';
import { ProviderRegistry } from './registry';
import {
  ProviderAuthError,
  ProviderUnavailableError,
  RateLimited,
} from './errors';

export interface RouterOptions {
  registry: ProviderRegistry;
  routes: RouteResolver;
  keys: KeyResolver;
  budget: BudgetGuard;
  redactor: Redactor;
  /** Rough $/1K-tok pre-call estimate per logical model. */
  costEstimateUsd?: (req: ChatRequest) => number;
}

/**
 * Application-facing client. Resolves the logical model to a fallback chain, applies budget +
 * redaction, then delegates to the registered ProviderAdapter for each route until one succeeds.
 */
export class RoutingProviderClient implements ProviderClient {
  constructor(private readonly opts: RouterOptions) {}

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const estimate = this.opts.costEstimateUsd?.(req) ?? 0.01;
    await this.opts.budget.check(estimate, {
      tenantId: req.ctx.tenantId,
      ventureId: req.ctx.ventureId,
    });

    const redacted: ChatRequest = {
      ...req,
      messages: req.messages.map((m) => ({ ...m, content: this.opts.redactor.redact(m.content) })),
    };

    const chain = await this.opts.routes.resolve(req.model, { tenantId: req.ctx.tenantId });
    if (chain.length === 0) {
      throw new ProviderUnavailableError(`No route configured for model '${req.model}'.`);
    }

    let lastErr: unknown;
    for (const route of chain) {
      const adapter = this.opts.registry.get(route.provider);
      if (!adapter) {
        lastErr = new ProviderUnavailableError(`Adapter for '${route.provider}' not registered.`);
        continue;
      }
      try {
        const key = await this.opts.keys.resolve(route.keyId, {
          tenantId: req.ctx.tenantId,
          traceId: req.ctx.traceId,
        });
        const res = await adapter.chat(redacted, key, route.modelId);
        await this.opts.budget.record(res.cost.usd, {
          tenantId: req.ctx.tenantId,
          ventureId: req.ctx.ventureId,
        });
        return res;
      } catch (err) {
        lastErr = err;
        // Auth + content errors are terminal for this route but still try the next.
        if (err instanceof RateLimited || err instanceof ProviderAuthError) continue;
        if (err instanceof ProviderUnavailableError) continue;
        throw err;
      }
    }
    throw lastErr ?? new ProviderUnavailableError('All routes failed without an error.');
  }
}
