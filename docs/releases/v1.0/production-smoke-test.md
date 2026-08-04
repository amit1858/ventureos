# Foundry 1.0 — Production Smoke Test

Record of the automatable production validation performed against the live deployment.
Signed-in flows are human-gated and listed at the end.

## Deployment record

| Field | Value |
|---|---|
| Production URL (alias) | https://ventureos-dun.vercel.app |
| New production deployment | `dpl_DAiLACJVNLt54EGfsF6MLNJTFGBQ` (`ventureos-f24xjf7tg`) |
| Previous deployment (rollback target) | `dpl_AXU8NWUsoWHM5GaLtrFfG28Dgdea` (`ventureos-m4odfuvo4`) |
| Release commits | `fdef4eb` (labs continuity), `c949931` (MIT + v1.0.0), docs commit (this set) |
| Build | Next.js 14.2.35 · `@foundry/web@1.0.0` · 15/15 tasks · 23 routes |
| Rollback command | `vercel promote dpl_AXU8NWUsoWHM5GaLtrFfG28Dgdea` |

## Environment variables (names only; no values printed)

Confirmed present in Vercel production: `OPENAI`/provider config, `SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY`.
Confirmed **unset** (open access posture): `VENTUREOS_ALLOWED_EMAILS`, `VENTUREOS_ALPHA_ACCESS`.

> Non-blocking: Turbo warns `SUPABASE_SERVICE_ROLE_KEY` and `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY`
> are not declared in `turbo.json`. These are **runtime** serverless env vars (injected by Vercel
> at request time, not build time), so the warning is cosmetic. Declaring them in `turbo.json`
> is a Release 1.1 housekeeping item.

## Automatable black-box results

Captured with Playwright/Chromium against production. Full log:
`session-state/.../files/verify-prod/_results.json`.

| Check | Result |
|---|---|
| Landing renders, HTTP 200, title "Foundry — AI-native Venture Operating System" | PASS |
| Landing branding: "Foundry" present, **zero "VentureOS"** | PASS |
| No horizontal overflow @ 1440 / 1280 / 1024 / 390 / 430 | PASS (5/5) |
| Primary CTA present (guided demo) | PASS |
| Navigation renders (Discover / Evaluate / Govern / Learn · Guided demo · Provider keys · Sign in) | PASS |
| GitHub link resolves — `github.com/amit1858/foundry-venture-os` → 200 | PASS |
| `/about`, `/security`, `/privacy`, `/access` → 200, Foundry-branded | PASS |
| Sign-in copy neutral (open posture); **no** allowlist/alpha message | PASS |
| Guided Demo public (no sign-in, no keys); all pipeline stages render | PASS |
| Demo stages present: personas, committee, research, validation, buildplan, evaluation, export | PASS (7/7) |
| `/ventures`, `/settings/byok` unauthenticated → sign-in gate, **no user data** | PASS |
| `/labs/*` unauthenticated → clean redirect to `/ventures` (no broken state) | PASS |

### Documented exceptions / notes

1. **Intentional branding exception:** the About page contains exactly one "VentureOS"
   string — "*Foundry was originally developed and submitted as VentureOS for the
   hackathon*" — a deliberate provenance/attribution statement. This is the only
   "VentureOS" occurrence in the app UI and is retained on purpose.
2. **Minor UX nit (defer to 1.1):** `/ventures/new` renders an empty create form to
   unauthenticated visitors and surfaces the sign-in requirement on submit (the create
   API returns 401 and nothing is created), rather than showing the upfront `SignInNotice`
   used by `/ventures`. No data exposure; security boundary is enforced at the API layer.

## Human-gated production validation (owner to run)

The dev-cookie bypass is disabled in production, so the following require a real Google
sign-in and cannot be automated headlessly. Steps:

1. **Google sign-in** — visit `/signin`, complete Google OAuth, confirm landing in the app.
2. **BYOK** — add an OpenAI key at `/settings/byok`; confirm it saves and displays masked.
3. **Persistence** — create a venture, run PersonaLab, refresh, confirm it persists; re-open later to confirm durability.
4. **Two-user isolation** — see `security-validation.md` for the full A/B test plan; confirm User B cannot read, edit, delete, or enumerate User A's ventures/artifacts/credentials.
5. **Signed-in screenshots** — capture My Ventures, Create Venture, PersonaLab, Research Graph lab, Venture Validation lab, Build Planning lab, Venture Workspace, and masked BYOK.

## Verdict (automatable scope)

All automatable public and structural checks **PASS**. Production serves Foundry 1.0 with
correct branding, open-posture sign-in copy, working public guided demo, resolving links,
and enforced auth gating with no observed data exposure. Final public-release sign-off is
pending the human-gated checks above.
