"""Protocol-based contracts for the Python provider abstraction."""

from __future__ import annotations

from typing import Any, Literal, Protocol, TypedDict, runtime_checkable

from foundry_contracts import ByokKey, DecryptedKey  # noqa: F401  (re-export friendly)

ProviderId = Literal[
    "openai",
    "azure_openai",
    "anthropic",
    "gemini",
    "github_models",
    "ollama",
    "azure_ai_foundry",
]


class ChatMessage(TypedDict, total=False):
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    name: str
    tool_call_id: str


class CallContext(TypedDict, total=False):
    tenant_id: str
    user_id: str
    venture_id: str
    artifact_id: str
    trace_id: str
    idempotency_key: str


class ChatRequest(TypedDict, total=False):
    model: str
    messages: list[ChatMessage]
    tools: list[dict[str, Any]]
    temperature: float
    top_p: float
    max_tokens: int
    response_format: Any
    seed: int
    cacheable: bool
    ctx: CallContext


class Usage(TypedDict):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class Cost(TypedDict):
    usd: float
    provider: ProviderId
    model: str


class ChatResponse(TypedDict, total=False):
    content: str | list[dict[str, Any]]
    finish_reason: Literal["stop", "length", "tool", "content_filter", "error"]
    usage: Usage
    cost: Cost
    cached: bool
    provider_request_id: str


@runtime_checkable
class ProviderAdapter(Protocol):
    id: ProviderId

    async def chat(
        self, req: ChatRequest, key: DecryptedKey, model_id: str
    ) -> ChatResponse: ...
    async def validate_key(self, key: DecryptedKey) -> dict[str, Any]: ...


@runtime_checkable
class ProviderClient(Protocol):
    async def chat(self, req: ChatRequest) -> ChatResponse: ...


@runtime_checkable
class KeyResolver(Protocol):
    async def resolve(self, key_id: str, ctx: CallContext) -> DecryptedKey: ...


@runtime_checkable
class BudgetGuard(Protocol):
    async def check(self, estimate_usd: float, ctx: CallContext) -> None: ...
    async def record(self, actual_usd: float, ctx: CallContext) -> None: ...


@runtime_checkable
class Redactor(Protocol):
    def redact(self, text: str) -> str: ...


@runtime_checkable
class RouteResolver(Protocol):
    async def resolve(self, model: str, ctx: CallContext) -> list[dict[str, Any]]: ...
