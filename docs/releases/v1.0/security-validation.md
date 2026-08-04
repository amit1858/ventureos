# Foundry Release 1.0 — Security Validation

Scope: authentication, BYOK provider-key handling, session/logout, route protection, and Supabase data isolation. Automatable checks were executed directly; checks that require live Google OAuth are provided as a precise manual plan (Google sign-in cannot be headlessly automated).

## 1. Authentication posture

- Google OAuth via Supabase.
- Public landing and the guided demo are open (no sign-in, no keys).
- Production Google sign-in is **open** to any valid Google account: `VENTUREOS_ALLOWED_EMAILS` empty, `VENTUREOS_ALPHA_ACCESS` false.
- Sign-in copy shows an allowlist message **only** when an allowlist is configured; otherwise neutral copy is used.
- Real Mode requires an authenticated user plus their own BYOK provider key; no shared owner key is used for public users.

## 2. BYOK provider-key handling — VERIFIED

| Check | Result |
|---|---|
| Key entered via in-app BYOK form; validated against the live provider | ✅ |
| Raw key never returned to the browser | ✅ — `/api/byok/providers` exposes `maskedPreview` only (e.g. `sk-p****E0cA`) |
| Key stored encrypted server-side | ✅ |
| Logs / error messages redact key shapes | ✅ — redaction patterns cover `sk-`, `sk-ant-`, `ghp_/github_pat_`, etc. |
| Leakage scan of validation artifacts + dev logs | ✅ — 0 raw key fragments found |

## 3. Data isolation (Supabase RLS) — AUDITED

User-created data carries an ownership field and is protected by Row Level Security enforcing per-user access. Service-role access is confined to server-side code.

| Table / data | Ownership field | RLS |
|---|---|---|
| ventures | user/owner id | enabled, owner-scoped SELECT/INSERT/UPDATE/DELETE |
| provider credentials | user id | enabled, owner-scoped; secrets encrypted |
| generated artifacts | venture/owner id | enabled, owner-scoped |
| research outputs | venture/owner id | enabled, owner-scoped |
| evaluation / validation runs | venture/owner id | enabled, owner-scoped |
| usage records | user id | enabled, owner-scoped |
| job records | user id | enabled, owner-scoped |

- A signed-in user cannot read or modify another user's rows (policy-enforced at the database).
- Demo Mode data is separated from user-created Real Mode data.
- The service-role key is server-only and is not exposed to client code.

## 4. Route protection & session

- Authenticated surfaces (ventures, labs, settings) require a session; direct navigation without one redirects to sign-in / venture selector — no broken states.
- Logout clears the session; the guided demo remains accessible after logout.

## 5. Two-user data-isolation test — MANUAL PLAN (human-gated)

Google OAuth cannot be automated headlessly, so this must be run with two real Google accounts. Do not expose real emails in screenshots/logs.

**User A**
1. Sign in with Google (Account A) at `https://ventureos-dun.vercel.app/signin`.
2. Create venture `Release Validation A`.
3. Generate personas; store one artifact.
4. Add a BYOK credential (a throwaway key with a spend limit).
5. Note the venture's URL/ID.

**User B** (different valid Google account, separate browser/profile)
1. Sign in with Google (Account B).
2. Confirm A's venture is **not** listed.
3. Open A's venture URL directly → expect **404 / not found** (not another user's data).
4. Attempt to access A's artifacts / jobs / run history → **denied**.
5. Attempt update/delete of A's venture → **denied**.
6. Confirm A's provider key / masked credential record is **not** visible.

**Expected:** every B attempt fails. Any cross-user read/modify is a **release blocker**.

**Cleanup:** delete `Release Validation A` and the throwaway credential after the test.

## Status

- Automatable checks (BYOK masking, leakage scan, redaction, RLS-enabled audit, route redirects): **PASS**.
- Live two-user Google isolation + signed-in session/logout on production: **PENDING** — execute the manual plan above with two accounts before final acceptance.
