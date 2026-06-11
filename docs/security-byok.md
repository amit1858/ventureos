# BYOK & Security

VentureOS is a **Bring-Your-Own-Key** product. We never ship our own provider credentials, never persist user keys in plaintext, and never expose any credential to the browser.

This is the security model.

## The contract

| Promise | How it's enforced |
|---|---|
| Keys are encrypted at rest | `packages/credentials` uses `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY` (32-byte hex/base64). |
| Keys are decrypted only server-side | Decryption happens inside server-only modules; result is never serialized to React props. |
| Keys are never logged | Provider adapters and the GitHub adapter explicitly redact tokens; the credential store never logs values. |
| UI shows masked values only | Settings UI shows `••••••• last4`. No raw values are ever sent to the client. |
| Provider SDKs are isolated | `lint:arch` blocks `@octokit/*` outside `packages/adapters/github-ts/` and blocks vendor LLM SDKs outside their named provider packages. |
| Exports contain no secrets | Renderer + reason-code tests assert no `ghp_…` shape (or similar token patterns) ever appears in exported files. |

## Where keys live

```
apps/web/.env.local                       # Never committed. Only Supabase + encryption key.
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  SUPABASE_SERVICE_ROLE_KEY=...
  VENTUREOS_CREDENTIAL_ENCRYPTION_KEY=<32-byte hex or base64>
  VENTUREOS_CREDENTIAL_ENCRYPTION_KID=k1    # optional rotation tag

Per-user (in DB, encrypted):
  OpenAI / Anthropic / Gemini / Azure OpenAI key
  GitHub PAT (with repo + workflow scopes)
```

`.env.example` is the only env file in git. `.env*` is in `.gitignore`.

## Encryption details

- Symmetric AES-GCM using `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY`.
- Each record stores `(ciphertext, iv, kid)`; `kid` enables future key rotation without re-encrypting everything in a single migration.
- The key is read from process env at startup. If missing, credential reads fail loudly — no silent fallback to plaintext.

## Validation flow

When a user adds a credential at `/settings/byok`:

1. UI POSTs the raw value over HTTPS to the server route.
2. Server validates the credential with a minimal, **read-only** provider call (e.g. list models, get authenticated user).
3. On success, the value is encrypted and stored along with provider metadata (default flag, validated-at timestamp, account id, available models).
4. UI never sees the raw value again. It can `revalidate`, `set-default` or `delete`.

GitHub PAT validation specifically checks for the scopes needed for export (`repo`); if `insufficient_scope` is returned, the error card in `/settings/byok` is actionable and tells the user exactly which scopes to add.

## GitHub Export safety

The GitHub adapter is the only place Octokit is imported (enforced by `lint:arch`). The export pipeline:

1. Loads the user's PAT from the encrypted store (server-only).
2. Renders the 14 export files via `renderRepoScaffold` — pure function, no credentials in scope.
3. Creates the repo via Octokit.
4. Single commit of all files via Octokit's trees API.
5. **Output sanitization:** a test (`reason-code helpers` + `GithubExportPanel` tests) asserts no token shapes ever appear in rendered output, error messages, hints or failure cards.

If the export fails, the user gets a stable failure code (`repo_exists`, `invalid_token`, `insufficient_scope`, `rate_limited`, `network`) and an actionable hint. The PAT is never echoed back.

## What is intentionally excluded

- We do not store provider response payloads with credentials. Job records store **metadata** (provider, model, cost) — not the credential used.
- We do not write tokens to logs, telemetry, traces or analytics. Logging adapters scrub `Authorization`, `x-api-key`, `Bearer …`, `ghp_…`, `sk-…`, `xoxp-…` and `sk_live_…` patterns.
- We do not embed credentials in artifacts. Every artifact JSON is safe to export verbatim.
- We do not ship our own provider keys in Demo Mode. Demo Mode is fully seeded and makes **zero** network calls to providers.

## Workspace identity (auth model)

VentureOS does not ship a full sign-up / sign-in flow in the hackathon
alpha. The server resolves a workspace identity in this order:

1. **Real Supabase session.** If `NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured and the user has a session
   cookie, that real user wins.
2. **Alpha Workspace** — opt-in via env + explicit click. When
   `VENTUREOS_ALPHA_ACCESS=true` is set on the server AND the visitor has
   clicked **Continue to Alpha Workspace** on `/access` (which sets the
   `ventureos_alpha_access=1` HttpOnly cookie), the server resolves them as
   the shared `alpha-user` identity (`alpha@ventureos.local`). Both pieces
   are required — env alone or cookie alone fails closed.
3. **Local dev cookie** — `vos_dev_user` JSON cookie. Honoured **only** when
   `NODE_ENV !== 'production'`. The deployed app cannot be unlocked with it
   and never surfaces dev-cookie instructions in its UI.
4. **No user** → BYOK / venture / lab routes return 401 and the client
   surfaces the polished "Real Mode requires workspace access" card with a
   link to `/access`.

The Alpha Workspace is a deliberate shortcut for hackathon judging and
personal testing. It is **not** appropriate for environments where multiple
unrelated users will share the same BYOK store — see
[`known-limitations.md`](known-limitations.md#engineering-gaps).

## Reporting a security issue

Please open a private issue or contact the maintainers at `@amit1858`. Do not file public issues for security reports.
