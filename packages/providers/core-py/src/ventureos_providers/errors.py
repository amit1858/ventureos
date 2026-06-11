"""Provider-layer error taxonomy. Adapters translate native SDK errors into these."""


class ProviderError(Exception):
    """Base class for all provider-layer errors."""

    def __init__(self, message: str, provider_request_id: str | None = None) -> None:
        super().__init__(message)
        self.provider_request_id = provider_request_id


class ProviderAuthError(ProviderError):
    pass


class RateLimited(ProviderError):
    def __init__(
        self, message: str, retry_after_ms: int, provider_request_id: str | None = None
    ) -> None:
        super().__init__(message, provider_request_id)
        self.retry_after_ms = retry_after_ms


class BudgetExceeded(ProviderError):
    def __init__(self, message: str, scope: str) -> None:
        super().__init__(message)
        self.scope = scope


class ProviderUnavailableError(ProviderError):
    pass


class ProviderContentFilterError(ProviderError):
    pass


class ProviderModelNotFoundError(ProviderError):
    pass


class NotImplementedError(Exception):  # noqa: A001 - intentional shadow at package boundary
    pass


class FeatureDisabledError(Exception):
    def __init__(self, flag: str, message: str | None = None) -> None:
        super().__init__(
            message or f"Feature '{flag}' is disabled. Set env {flag}=true to enable."
        )
        self.flag = flag
