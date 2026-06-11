/**
 * Provider-layer error taxonomy.
 * Adapters MUST translate native SDK errors into one of these.
 */
export class ProviderError extends Error {
  override readonly name: string = 'ProviderError';
  constructor(
    message: string,
    public readonly providerRequestId?: string,
  ) {
    super(message);
  }
}

export class ProviderAuthError extends ProviderError {
  override readonly name = 'ProviderAuthError';
}

export class RateLimited extends ProviderError {
  override readonly name = 'RateLimited';
  constructor(message: string, public readonly retryAfterMs: number, providerRequestId?: string) {
    super(message, providerRequestId);
  }
}

export class BudgetExceeded extends ProviderError {
  override readonly name = 'BudgetExceeded';
  constructor(message: string, public readonly scope: 'tenant' | 'venture' | 'job') {
    super(message);
  }
}

export class ProviderUnavailableError extends ProviderError {
  override readonly name = 'ProviderUnavailableError';
}

export class ProviderContentFilterError extends ProviderError {
  override readonly name = 'ProviderContentFilterError';
}

export class ProviderModelNotFoundError extends ProviderError {
  override readonly name = 'ProviderModelNotFoundError';
}

export class NotImplementedError extends Error {
  override readonly name = 'NotImplementedError';
}

export class FeatureDisabledError extends Error {
  override readonly name = 'FeatureDisabledError';
  constructor(flag: string, message?: string) {
    super(message ?? `Feature '${flag}' is disabled. Set env ${flag}=true to enable.`);
  }
}
