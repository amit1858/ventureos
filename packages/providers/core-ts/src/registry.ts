import type { ProviderAdapter } from './types';
import type { ProviderId } from '@ventureos/contracts';

/**
 * Process-local registry. The router holds an instance and looks adapters up by `ProviderId`.
 */
export class ProviderRegistry {
  private adapters = new Map<ProviderId, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: ProviderId): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  require(id: ProviderId): ProviderAdapter {
    const a = this.adapters.get(id);
    if (!a) throw new Error(`No provider adapter registered for '${id}'.`);
    return a;
  }

  ids(): ProviderId[] {
    return [...this.adapters.keys()];
  }
}
