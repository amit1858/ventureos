import type { LogicalModel, ProviderConfig, ProviderRoute } from '@ventureos/contracts';
import type { RouteResolver } from './types';
import { ProviderUnavailableError } from './errors';

const LOGICAL_MODELS: ReadonlySet<string> = new Set<LogicalModel>([
  'flagship',
  'standard',
  'fast',
  'embed',
  'vision',
]);

/** Aliases that resolve to the configured default chain. */
const DEFAULT_ALIASES: ReadonlySet<string> = new Set(['default', 'auto']);

/**
 * Resolves a logical model name to the configured fallback chain for a tenant.
 * Backed by a per-tenant `ProviderConfig` (see `packages/contracts/schema/provider-config.json`).
 *
 * Behavior:
 *   - `flagship` / `standard` / `fast` / `embed` / `vision` → that chain (verbatim)
 *   - `default` / `auto`                                  → the `standard` chain, then `flagship`
 *   - concrete model id ("gpt-4o-mini", "claude-3-5-…")    → all matching routes across chains,
 *                                                            preserving fallback order
 */
export class ConfigBasedRouteResolver implements RouteResolver {
  constructor(private readonly configs: Map<string, ProviderConfig>) {}

  async resolve(model: string, ctx: { tenantId: string }): Promise<ProviderRoute[]> {
    const config = this.configs.get(ctx.tenantId);
    if (!config) {
      throw new ProviderUnavailableError(`No ProviderConfig registered for tenant '${ctx.tenantId}'.`);
    }

    if (DEFAULT_ALIASES.has(model)) {
      const chain = [...config.routes.standard, ...config.routes.flagship];
      if (chain.length === 0) {
        throw new ProviderUnavailableError(`Tenant '${ctx.tenantId}' has no default routes.`);
      }
      return chain;
    }

    if (LOGICAL_MODELS.has(model)) {
      const key = model as keyof ProviderConfig['routes'];
      const chain = config.routes[key];
      if (!chain || chain.length === 0) {
        throw new ProviderUnavailableError(
          `Tenant '${ctx.tenantId}' has no routes for logical model '${model}'.`,
        );
      }
      return chain;
    }

    // Concrete model id: only honor it if it appears in any configured route.
    const all = [
      ...config.routes.flagship,
      ...config.routes.standard,
      ...config.routes.fast,
      ...(config.routes.embed ?? []),
      ...(config.routes.vision ?? []),
    ];
    const matching = all.filter((r) => r.modelId === model);
    if (matching.length === 0) {
      throw new ProviderUnavailableError(
        `Model '${model}' is not in any route for tenant '${ctx.tenantId}'.`,
      );
    }
    return matching;
  }

  /** Test/dev helper. */
  upsert(config: ProviderConfig): void {
    this.configs.set(config.tenantId, config);
  }
}
