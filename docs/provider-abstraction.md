# Foundry — Provider Abstraction (BYOK)

> Sprint −1 deliverable. The single seam through which every LLM token flows.

## 1. Why this exists

The platform must:

- Support **OpenAI, Azure OpenAI, Anthropic, Gemini** today and **GitHub Models, Ollama, Azure AI Foundry** tomorrow.
- Never assume a default provider key.
- Never expose, leak, or log a user's key.
- Enforce per-tenant cost and rate limits *before* a call leaves the boundary.
- Let labs and adapters be written once and run against any provider.

The provider abstraction is therefore the **only** place in the codebase that imports provider SDKs.

## 2. Architectural rule

> **No subsystem outside `packages/providers/` may import a provider SDK.**

Enforced by:

- `import-linter` contract in CI (Python).
- `eslint-plugin-import` no-restricted-imports rule (TypeScript).
- A code-review checklist line.

## 3. Public API (language-agnostic shape)

```ts
interface ProviderClient {
  chat(req: ChatRequest):        Promise<ChatResponse>;
  embed(req: EmbedRequest):      Promise<EmbedResponse>;
  stream(req: ChatRequest):      AsyncIterable<ChatChunk>;
  capabilities():                ProviderCapabilities;
}

interface ChatRequest {
  model:        ModelRef;           // logical model name, e.g. 'flagship', 'fast', or 'gpt-4o'
  messages:     Message[];
  tools?:       ToolSpec[];
  toolChoice?:  ToolChoice;
  temperature?: number;
  topP?:        number;
  maxTokens?:   number;
  responseFormat?: 'text' | 'json' | { jsonSchema: object };
  seed?:        number;

  // Required platform context — never optional, never guessed.
  ctx: {
    tenantId:   string;
    userId?:    string;
    ventureId?: string;
    artifactId?: string;
    traceId:    string;
    budget:     BudgetGuard;
    redactor:   Redactor;
    idempotencyKey?: string;
  };
}

interface ChatResponse {
  content: string | ToolCall[];
  finishReason: 'stop' | 'length' | 'tool' | 'content_filter' | 'error';
  usage:   { promptTokens: number; completionTokens: number; totalTokens: number };
  cost:    { usd: number; provider: string; model: string };
  cached:  boolean;
  providerRequestId?: string;
}
```

The same shape exists in Python (`pydantic` models in `packages/providers/python/`). Generated from a single JSON Schema in `packages/contracts/`.

## 4. Logical models vs concrete models

Labs ask for **roles**, not vendor model names, by default:

| Logical model | Typical mapping | Purpose |
| --- | --- | --- |
| `flagship` | `gpt-4.1` / `claude-opus-4` / `gemini-2.5-pro` | Architecture, recommendation rationale, validation |
| `standard` | `gpt-4.1-mini` / `claude-sonnet-4` / `gemini-2.5-flash` | Persona action loop, focus group dialogue |
| `fast` | `gpt-4.1-nano` / `claude-haiku-3.5` / `gemini-2.5-flash-lite` | Routing, summarisation, post-processing |
| `embed` | `text-embedding-3-small` / `text-embedding-3-large` / `embed-multilingual-v3` | Semantic memory, retrieval |
| `vision` (M2+) | `gpt-4o` / `claude-sonnet-4-5` / `gemini-2.5-pro` | Image-bearing persona stimuli |

A tenant's `ProviderConfig` maps each logical model to a concrete `(provider, model_id)` pair, with a fallback chain. Labs can override with an explicit `model: 'gpt-4.1'` if they need a specific model, but the default and the production path is logical.

This is the single biggest portability win: when a tenant moves from OpenAI to Anthropic, **no lab code changes** — they update their provider config.

## 5. Tenant provider config

```ts
ProviderConfig {
  tenantId: string;
  defaultProvider: 'openai' | 'azure_openai' | 'anthropic' | 'gemini' | ...;
  routes: {
    flagship: ProviderRoute[];   // ordered fallback chain
    standard: ProviderRoute[];
    fast:     ProviderRoute[];
    embed:    ProviderRoute[];
    vision?:  ProviderRoute[];
  };
  budgets: BudgetPolicy;
  redaction: RedactionPolicy;    // future-proofing: per-tenant rules
}

ProviderRoute {
  provider: ProviderId;
  modelId:  string;
  keyId:    string;              // ref into provider_keys table
  weight?:  number;              // for cost-based or experiment-based routing
  region?:  string;              // for residency-constrained tenants
}
```

## 6. Adapters (one per provider)

Each provider is implemented behind a small `ProviderAdapter` (not to be confused with engine adapters — same word, different layer).

```ts
interface ProviderAdapter {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;

  chat(req: NormalizedChatRequest, key: DecryptedKey): Promise<NormalizedChatResponse>;
  embed(...): Promise<...>;
  stream(...): AsyncIterable<...>;
  pingHealth(key: DecryptedKey): Promise<HealthStatus>;
  estimateCost(req: NormalizedChatRequest): CostEstimate;
}
```

Supported at M1:

| Provider | Adapter | Notes |
| --- | --- | --- |
| OpenAI | `OpenAIProviderAdapter` | Reference implementation. Streaming, tools, JSON mode, embeddings. |
| Azure OpenAI | `AzureOpenAIProviderAdapter` | Deployment-name vs model-name distinction; per-region endpoints. |
| Anthropic | `AnthropicProviderAdapter` | Messages API; tool use; no native JSON-schema response_format (we shim). |
| Gemini | `GeminiProviderAdapter` | Function calling; safety settings; per-region endpoints. |

Targeted at M3:

| Provider | Notes |
| --- | --- |
| GitHub Models | Per-user PAT; great for low-cost early-stage usage. |
| Ollama | Self-hosted; tenant supplies a base URL; no key required. |
| Azure AI Foundry | Catalog of models; capability detection per model. |

Each provider adapter ships a `ConformanceTest` suite. Adding a new provider means: implement the interface, pass conformance, register in the router. Target: < 1 engineer-day at M3.

## 7. The router (heart of the abstraction)

```
ProviderClient.chat(req)
   │
   ▼
 1. Validate request, attach trace
 2. Resolve logical model → ProviderRoute chain (tenant config)
 3. For each route in chain:
       a. Acquire decrypted key (in-memory, never logged)
       b. Check rate limit (token bucket per (tenant, provider, model))
       c. Check cache (if cacheable)
       d. Pre-call budget reserve (estimateCost vs BudgetGuard)
       e. Invoke ProviderAdapter.chat(...)
       f. Cost meter: write actual cost, release reservation
       g. Cache write (tenant-scoped key)
       h. Redact + log + telemetry span
       i. Return response
       — on 429/5xx → next route in chain
       — on 4xx auth/permission → surface immediately
 4. If all routes exhausted → ProviderUnavailableError
```

Streaming wraps the same pipeline; the budget guard accounts after each chunk.

## 8. Caching

- **Optional, opt-in per call site** (`req.cacheable: boolean` — default `false` for chat with tools, `true` for deterministic prompts with temperature ≤ 0.2).
- **Key**: `sha256(tenant_id ‖ provider ‖ model ‖ messages ‖ tools ‖ temperature ‖ seed)`.
- **Scope**: per-tenant. Never shared across tenants.
- **Store**: Redis with TTL (default 24h; configurable per call site).
- **Bypass**: respected when `req.ctx.idempotencyKey` differs.

Caching dramatically lowers cost for re-runs of the same research graph or repeated persona-validation passes.

## 9. Budget enforcement (the `BudgetGuard`)

```ts
interface BudgetGuard {
  tenantId: string;
  ventureId?: string;
  jobId?: string;

  reserve(estimateUsd: number): Reservation;   // throws BudgetExceeded
  commit(actualUsd: number, reservation: Reservation): void;
  remaining(): { tenant: number; venture?: number; job?: number };
}
```

- Reservations prevent two concurrent calls from each thinking the budget has room.
- Tenant + venture + job each carry independent caps; the **strictest** wins.
- Defaults at M1: tenant $200/mo, venture $5, job no cap (job cap added at M2 when usage data informs us).
- A circuit breaker trips after N consecutive `BudgetExceeded` in a venture to avoid hammering the queue.

## 10. Rate limiting

- Token-bucket per `(tenant_id, provider, model)`, sized to upstream provider limits with safety margin.
- Wait-or-fail policy is request-specified (default: wait up to 10s, then fail with `RateLimited`, which the router treats as transient and tries the next route).

## 11. Redaction

The `Redactor` is a small, well-tested module with patterns for:

- Provider API keys (`sk-...`, `ak-...`, `aip-...`, Azure key formats, GCP JSON-key structure).
- AWS access keys (`AKIA...`), JWTs (`eyJ...`), private keys (PEM).
- GitHub tokens (`ghp_...`, `github_pat_...`).
- Connection strings (`postgres://...`, `mysql://...`, Azure `DefaultEndpointsProtocol=...`).
- Email addresses (configurable; on in prod logs by default).

Every log emission, every span attribute, every error message that includes user-supplied or model-generated text passes through the redactor. The redactor is the single most-tested module in the platform. Fuzz tests against it run nightly.

## 12. Cost meter

- Per-call: `usage.totalTokens × per-token price` from a provider-maintained price table (updated quarterly; version-pinned per call).
- Aggregated: per tenant, per venture, per artifact, per provider, per model. Queryable.
- Surfaced in: UI (current spend, budget bars), exports (CSV/JSON), and webhooks on threshold crossings.

## 13. Capabilities probe

```ts
ProviderCapabilities {
  supportsStreaming:        boolean;
  supportsTools:            boolean;
  supportsJsonMode:         boolean;
  supportsJsonSchema:       boolean;  // strict structured output
  supportsVision:           boolean;
  supportsEmbeddings:       boolean;
  maxContextTokens:         number;
  maxOutputTokens:          number;
}
```

Labs that need structured output must either use a provider that `supportsJsonSchema`, or accept a shim. The router selects feasibly: if the user's route doesn't support a required capability, the router walks the fallback chain looking for one that does (and surfaces a warning).

## 14. Tool-calling normalisation

Each provider's tool-call format is normalised into a single internal `ToolCall` shape on the way in and out. Labs author `ToolSpec[]` once; providers receive their dialect; results come back identically shaped.

Edge cases handled by the abstraction:

- Anthropic emits tool calls inside `content` blocks; we extract.
- Gemini wraps tool calls in `functionCall` parts; we extract.
- OpenAI's `tool_choice` semantics differ from Anthropic's `tool_choice`; we normalise.
- Streaming tool calls: chunks are reassembled into complete calls before yielding.

## 15. Failure model (provider layer)

| Failure | Router behaviour |
| --- | --- |
| 401 / 403 (bad key) | No retry; surface `ProviderAuthError`. Mark route unhealthy for 5 min. |
| 404 (model not found) | No retry; surface `ProviderModelNotFoundError`. |
| 429 | Respect Retry-After; one retry on the same route; then next route. |
| 5xx | Exponential backoff (2 attempts) on same route; then next route. |
| Content filter | No retry; surface `ProviderContentFilterError` (do not redact the filter reason). |
| Budget exceeded | No retry; surface `BudgetExceeded` to the calling lab. |
| Cancellation (job killed) | Cancel in-flight HTTP request; no retry. |

## 16. Testing harness

- **`MockProvider`** — deterministic, no network, used in unit tests across labs and adapters.
- **`RecordingProvider`** — wraps a real provider and records request/response pairs to fixtures.
- **`ReplayProvider`** — plays fixtures back; used in CI to test labs end-to-end without spending tokens.
- **`ConformanceTest` suite** — every provider adapter must pass: chat round-trip, streaming, tools, JSON mode (or shimmed), embeddings, rate-limit handling, retry-after honour, redaction surface.
- **Property tests on the router**: any chain order produces correct outcome; budget reservations are correctly released on failure; cache keys are tenant-scoped.

## 17. Migration / extension path

Adding a new provider at M3 (worked example: Ollama):

1. Implement `OllamaProviderAdapter` (HTTP to user-provided base URL; no key).
2. Pass `ConformanceTest` suite.
3. Register in `ProviderRegistry`.
4. Add a UI form for tenant config (base URL, model catalogue).
5. Ship.

Target turnaround at M3: < 1 engineer-day for any OpenAI-compatible HTTP API. Bespoke (e.g., Bedrock IAM auth) may take a week.

## 18. What is *not* in this layer

- Prompt templates — those live with the lab that uses them.
- Agent loops, retries on **semantic** failure (bad output) — that's the lab's policy.
- Persistence of artifacts — labs / orchestrator concern.
- Auth — API-gateway concern.
- Persona / graph / repo logic — labs' concern.

The provider layer's job is exactly one thing: **safely, observably, and portably make a model call.**
