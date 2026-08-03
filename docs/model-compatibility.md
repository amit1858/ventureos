# Model compatibility matrix

Foundry is **BYOK** (bring your own key) and provider-agnostic: every lab talks
to the same `ChatFn` abstraction, and each provider SDK is confined to its own
adapter package under `packages/providers/*`. This page lists the models Foundry
has validated, how far that validation goes, and the known limitations per
provider.

**Legend**

- **Supported** — the adapter shapes requests correctly for this model and it is
  selectable in the BYOK model picker.
- **Tested** — covered by the automated (mocked) provider test-suite and/or
  known-good in live use.
- **Recommended** — a first-choice model for the Foundry workflow (good
  quality/cost/latency balance for persona + venture generation).

> Automated tests mock the provider SDKs — they prove request shaping, response
> normalization, and JSON extraction, not live network behavior. Rows marked
> "Recommended" are the ones we exercise most against live keys. See
> [Live validation](#live-validation-checklist).

## Recommended shortlist

If you just want something that works well today:

- **GPT-4o mini** (OpenAI) — default; fastest/cheapest validated path.
- **GPT-4.1** (OpenAI) — higher quality, large context.
- **Claude Sonnet** (Anthropic) — strong reasoning + JSON reliability.

## OpenAI

| Model | Supported | Tested | Recommended | Notes / limitations |
|---|:---:|:---:|:---:|---|
| `gpt-4o-mini` | ✓ | ✓ | ✓ | Default. Fully validated. |
| `gpt-4.1` | ✓ | ✓ | ✓ | 1M-token context. |
| `gpt-4o` | ✓ | ✓ |  | Higher cost than 4o-mini. |
| `gpt-4.1-mini` | ✓ |  |  | Cheaper 4.1 variant. |
| `gpt-4.1-nano` | ✓ |  |  | Smallest 4.1 variant. |
| `gpt-5` | ✓ | ✓ |  | **Reasoning model** — uses `max_completion_tokens`, temperature fixed at default. Spends part of the output budget on hidden reasoning tokens; Foundry raises the output floor to 4096. |
| `gpt-5-mini` | ✓ |  |  | Reasoning model (see `gpt-5`). |
| `gpt-5-nano` | ✓ |  |  | Reasoning model (see `gpt-5`). |
| `o4-mini` | ✓ | ✓ |  | Reasoning model (see `gpt-5`). |
| `o3` | ✓ |  |  | Reasoning model (see `gpt-5`). |
| `gpt-4-turbo` | ✓ |  |  | Legacy; kept for compatibility. |
| `gpt-3.5-turbo` | ✓ |  |  | Legacy; kept for compatibility. |

**Why reasoning models are handled separately.** GPT-5 and the o-series changed
the Chat Completions contract: they reject the legacy `max_tokens` field (they
require `max_completion_tokens`) and only accept the default `temperature`.
Sending the older shape returns HTTP 400 — this was the historical reason "only
GPT-4o mini worked." Foundry now selects the right request shape per model from a
single registry (`packages/providers/openai-ts/src/models.ts`), so there are no
scattered model-specific hacks.

## Anthropic

| Model | Supported | Tested | Recommended | Notes / limitations |
|---|:---:|:---:|:---:|---|
| `claude-sonnet-4-5` | ✓ | ✓ | ✓ | Recommended Anthropic model. |
| `claude-opus-4-1` | ✓ | ✓ |  | Highest quality/cost. |
| `claude-haiku-4-5` | ✓ | ✓ |  | Fast/cheap. |
| `claude-haiku-4-5-20251001` | ✓ | ✓ |  | Pinned Haiku build; default validation probe. |

Anthropic has no native JSON mode; Foundry uses the documented **prefill** trick
(open the assistant turn with `{` and instruct "reply with only a JSON object"),
then reconstructs the leading brace. Claude 3 / 3.5 model IDs are **retired** and
are intentionally excluded from the catalog.

**Verbosity + reliability (Release 1.0 hardening).** Claude models are more
verbose than OpenAI chat models and lack a native `json_object` guarantee. Two
things make them fully reliable for the PersonaLab workflow, with **no
model-specific code in the workflow**:

1. **Adaptive output budgeting** — `resolveCapability` classifies Sonnet/Opus as
   `verbose`, so `recommendedBudget` automatically scales each stage's token cap
   (~1.75×). This eliminates the `finish_reason: length` truncation that a
   terse-tuned fixed budget caused.
2. **Deterministic JSON repair + one retry** — the shared `generateStructured`
   pipeline repairs the occasional unescaped quote / control character that the
   prefill path can emit, and re-asks once if repair fails.

See §14c of [provider-abstraction.md](provider-abstraction.md) for the mechanism
and the live-validation results below for evidence.

## Google Gemini

| Model | Supported | Tested | Recommended | Notes / limitations |
|---|:---:|:---:|:---:|---|
| `gemini-2.5-flash` | ✓ | ✓ |  | Current default; good cost/latency. |
| `gemini-2.5-pro` | ✓ |  |  | Highest quality. |
| `gemini-2.0-flash` | ✓ | ✓ |  | Credential-validation probe model. |
| `gemini-1.5-flash-latest` | ✓ |  |  | Legacy; nearing Google EOL. |
| `gemini-1.5-pro-latest` | ✓ |  |  | Legacy; nearing Google EOL. |

Gemini requests JSON via `responseMimeType: application/json`. The 1.5 family is
retained for existing configurations but should be migrated to 2.x.

## Azure OpenAI

Azure uses **deployment names** rather than fixed model IDs, so the catalog is a
convenience fallback — the identifier you enter must match your Azure deployment.

| Deployment kind | Supported | Notes / limitations |
|---|:---:|---|
| GPT-4o / GPT-4o mini / GPT-4.1 deployments | ✓ | Classic chat contract. |
| GPT-5 / o-series deployments | ✓ | Detected best-effort from the deployment name (contains `o3`/`o4`/`gpt-5`, etc.) → reasoning contract (`max_completion_tokens`, default temperature). If your deployment name doesn't reveal the family, name it to include it, or expect the classic contract. Requires an API version that supports `max_completion_tokens`. |

## Graceful degradation (UX)

- Selecting a model Foundry hasn't validated (for a fixed-catalog provider)
  returns an actionable message instead of a raw provider error:

  > This model is not yet validated for Foundry.
  >
  > Recommended models:
  >
  > • GPT-4o mini
  > • GPT-4.1
  > • Claude Sonnet

- A missing/misconfigured credential explains exactly what's missing (e.g. an
  Azure resource endpoint, or "no API key configured for <provider>").

These are implemented in `apps/web/src/lib/model-support.ts` and wired into the
BYOK test-prompt runner and the PersonaLab chat path.

## Live validation results (Release 1.0)

The full PersonaLab workflow was executed end-to-end against live provider APIs
during the Release 1.0 hardening sprint — **8 sequential LLM calls** each
(personas → interview → focus group → 4-phase buying committee → insights). Keys
were read from the environment only, never persisted or logged.

| Provider / model | Calls | Truncations | Repairs | Retries | Completion tokens | Est. cost | Wall-clock | Result |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Anthropic `claude-sonnet-4-5` | 8 | 0 | 0 | 0 | 12,585 | ~$0.244 | ~330 s | ✅ pass |
| OpenAI `gpt-4.1` | 8 | 0 | 0 | 0 | 5,328 | ~$0.064 | ~57 s | ✅ pass |

Notes:

- Sonnet's largest single completion — persona generation at **2,490 output
  tokens** — now lands comfortably inside the adaptive budget (~5,600). The
  previously shipped fixed cap (2,200) would have truncated it (`finish_reason:
  length`); this is the exact failure the sprint fixed.
- Both models reached the same workflow structure and a `pilot` buying-committee
  decision; insight confidence was 0.92 (Sonnet) and 0.95 (gpt-4.1). Sonnet
  produced longer, more granular objections/positioning; gpt-4.1 was terser,
  ~4× faster, and ~4× cheaper.
- `gpt-4o-mini` and `gpt-4.1` remain the **Recommended** default path (native
  JSON, lowest cost/latency). `claude-sonnet-4-5` is validated end-to-end and
  Recommended for Anthropic BYOK users who prefer Claude.

## Live validation checklist

Automated tests mock the SDKs. To confirm a provider end-to-end with a real key,
run the PersonaLab workflow (Create Venture → Generate Personas → Interview →
Focus Group → Buying Committee → Insights) against:

- OpenAI `gpt-4o-mini` (baseline)
- OpenAI `gpt-4.1`
- Anthropic `claude-sonnet-4-5`
- (optional) OpenAI `gpt-5` or `o4-mini` to exercise the reasoning path

Each should complete the identical workflow and produce parseable structured
output. The mocked equivalent of this parity check lives in
`apps/web/tests/personalab-provider-matrix.test.ts`.
