# Foundry — Decision Log

Concise record of the major product and engineering decisions behind Foundry Release 1.0. Each entry is factual; none implies production-scale adoption.

## 1. BYOK over shared hosted keys
**Decision:** Real Mode requires each user to bring their own provider API key (BYOK). Foundry never uses the owner's credentials for public users.
**Rationale:** Removes cost/liability of hosting shared keys, keeps usage attributable and isolated per user, and lets users pick their own provider and spend limits. The guided demo stays key-free for evaluation.

## 2. Provider abstraction
**Decision:** All model calls go through a provider-independent interface with per-provider adapters (OpenAI, Anthropic, Gemini, Azure OpenAI, GitHub Models).
**Rationale:** Prevents lock-in, lets the product add/swap providers without touching feature code, and makes multi-model validation possible.

## 3. Capability registry
**Decision:** A registry declares each model's capabilities (context window, structured-output support, token ceilings).
**Rationale:** Lets the pipeline adapt requests to the selected model rather than hard-coding one provider's limits.

## 4. Adaptive token budgeting
**Decision:** Token budgets are computed adaptively from the model and task rather than fixed.
**Rationale:** Keeps large workflows (personas, committee, graph) within provider limits and controls cost.

## 5. Provider-independent structured-output pipeline
**Decision:** A single structured-generation pipeline produces typed artifacts regardless of provider.
**Rationale:** Guarantees the UI receives well-formed, styled artifacts instead of raw model text, independent of which model produced them.

## 6. Deterministic JSON repair before retry
**Decision:** Malformed model output is first passed through deterministic repair; a model retry is only used if repair fails.
**Rationale:** Cheaper, faster, and more reliable than always retrying; reduces token spend and latency on the common near-miss case.

## 7. Versioned artifacts
**Decision:** Generated artifacts are versioned and record the model/provider that produced them.
**Rationale:** Every decision can be traced back to its evidence and the exact model behind it.

## 8. Venture-scoped workflow continuity
**Decision:** Research Graph, Venture Validation, and Build Planning automatically discover and consume the selected venture's existing artifacts. Users never paste JSON, copy intermediate outputs, or remember venture IDs.
**Rationale:** Turns a set of developer tools into one connected operating system; removes the biggest usability defect from earlier builds.

## 9. Deterministic vs. LLM responsibilities
**Decision:** Deterministic code owns orchestration, persistence, scoring math, redaction, and repair; the LLM owns generative reasoning only.
**Rationale:** Predictability, testability, and security — secrets and control flow never depend on model behavior.

## 10. Google OAuth for authentication
**Decision:** Authentication is Google OAuth via Supabase.
**Rationale:** Low-friction, trusted sign-in with no password management; integrates cleanly with Supabase RLS for per-user isolation.

## 11. Supabase + Row Level Security
**Decision:** Supabase (Postgres) is the durable store, with RLS enforcing per-user ownership on user-created data.
**Rationale:** Database-enforced isolation is stronger than application-only checks; service-role access stays server-side.

## 12. Open public demo
**Decision:** The guided demo is publicly accessible with no sign-in and no keys.
**Rationale:** Lets anyone evaluate the full product end-to-end in 60 seconds without friction.

## 13. Open Google authentication
**Decision:** Production Google sign-in is open to any valid Google account (`VENTUREOS_ALLOWED_EMAILS` empty, `VENTUREOS_ALPHA_ACCESS` false).
**Rationale:** Release 1.0 is intended for real users; a restricted allowlist can be reintroduced later for a beta if needed. Isolation is enforced by RLS, so open sign-in does not weaken data security.

## 14. Advanced labs demoted from primary product entry
**Decision:** The primary journey is the operating-model flow (Discover → Evaluate → Govern → Learn); advanced/implementation labs are secondary.
**Rationale:** First-time users should follow one coherent path, not land in developer-oriented tools.
