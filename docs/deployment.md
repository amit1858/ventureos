# Deployment

VentureOS ships as a Next.js 14 App-Router app inside a pnpm + Turborepo
workspace. This page is the single source of truth for deploying it.

> **TL;DR for the hackathon:** run the [Required deployment procedure for
> Microsoft / Azure AD machines](#required-deployment-procedure-microsoft--azure-ad-machines)
> below. It is *the* command sequence that produces a green Vercel
> deployment from this codebase on a corporate machine.

There are two supported deployment modes:

1. **[Zero-Key Demo Deployment](#mode-1-zero-key-demo-deployment)** — recommended
   first deployment for judges and public review. No environment variables.
2. **[Full Real Mode Deployment](#mode-2-full-real-mode-deployment)** — Supabase,
   encryption key, BYOK UI for provider keys and the GitHub PAT.

Provider API keys (OpenAI, Anthropic, Gemini, Azure OpenAI) and the **GitHub
PAT** are **never** Vercel environment variables. They are entered through the
VentureOS BYOK UI at `/settings/byok` and stored encrypted at rest.

---

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | **20.0+** (declared in `package.json#engines`) |
| pnpm | **9.0+**, installed via `corepack enable` |
| Git | any recent |
| Vercel CLI | `npm i -g vercel` (or `pnpm dlx vercel`) |

Enable Corepack once per machine: `corepack enable`.

---

## Vercel Deployment from Microsoft / Azure AD Machines

> **Why this section exists.** Vercel can reject CLI deployments when the
> local Git commit author email (a Microsoft / Azure AD corporate email such
> as `you@microsoft.com`) cannot be matched to a verified GitHub account on
> a connected Vercel project. With the `origin` remote attached, Vercel
> applies Git provenance validation even to `vercel deploy --prod`.
>
> The fix is to **temporarily detach the GitHub remote** for the duration of
> the upload. Vercel then treats the operation as a standalone CLI upload
> and skips the Git author check. After the deploy returns, restore the
> remote and push to GitHub as a separate step.
>
> This workaround is intentional. **Do not** replace it with a GitHub-triggered
> deployment hook on this machine.

### Required deployment procedure (Microsoft / Azure AD machines)

#### TL;DR

```bash
git remote remove origin
vercel deploy --prod
git remote add origin https://github.com/amit1858/ventureos.git
git push origin main
```

- Never use `git push` as the deploy trigger from this machine.
- Never run `vercel deploy --debug` (it can OOM on Windows; see error table).

#### Detailed procedure

```bash
# 0. Confirm working tree is clean
git status

# 1. Confirm the GitHub remote before removing it
git remote -v

# 2. Temporarily detach the GitHub remote
git remote remove origin

# 3. Deploy to Vercel production via CLI upload
vercel deploy --prod

# 4. Restore GitHub remote
git remote add origin https://github.com/amit1858/ventureos.git

# 5. Confirm remote is restored
git remote -v

# 6. Push commits to GitHub
git push origin main
```

> If you are deploying a branch other than `main` (for example a release
> branch), substitute it in steps 0 and 6. Step 3 always deploys whatever
> Vercel currently sees in the working tree, not what is on a Git branch.

### Error handling

| Symptom | Cause | Fix |
| --- | --- | --- |
| Deployment rejected because Git author cannot be verified | Git remote still attached during Vercel deploy | `git remote remove origin`, then `vercel deploy --prod` |
| `error: No such remote: 'origin'` | Remote already removed from a previous attempt | Skip the remove step and run `vercel deploy --prod` |
| `vercel deploy` exits with code 137 | `--debug` can cause OOM on Windows | Re-run without `--debug` |
| Git push fails because origin is missing | Remote was not restored | `git remote add origin https://github.com/amit1858/ventureos.git` |
| Browser shows old chunks or odd runtime behavior | Cached old Vercel assets | Hard refresh with `Ctrl+Shift+R` (or `Cmd+Shift+R`) |
| Real Mode shows *"Server is not configured for Real Mode"* | Supabase env vars missing | Either use Demo Mode or configure Real Mode env vars (see Mode 2) |

### Why no script?

A docs-only procedure is preferred. An automated "detach, deploy, reattach"
script is risky: if `vercel deploy` errors out mid-run and the trap fails,
the working copy is left without an `origin` remote, which is easy to miss.
Following the six manual steps takes under a minute and is auditable.

---

## Mode 1: Zero-Key Demo Deployment

**Use this for judges and public Agent-Swarms review.** No environment
variables, no Supabase, no API keys, no PAT.

### What works

- `/` — homepage with multi-agent Agent Swarms positioning
- `/demo` — demo index
- `/demo/faceless-crm` — full seeded VentureOS pipeline end-to-end
- Personas, buying committee, research graph, VentureLab recommendation,
  BuildSquad plan, evaluation report, simulated GitHub export

### What gracefully degrades

- `/ventures`, `/ventures/new`, `/labs/*`, `/settings/byok` show a friendly
  *"Server is not configured for Real Mode"* card (HTTP 503
  `server_not_configured`) routed through `app/error.tsx`. No stack traces,
  no env-var names, no token shapes are leaked to the browser.

### Steps

1. Run the [Required deployment procedure](#required-deployment-procedure-microsoft--azure-ad-machines)
   above.
2. In Vercel project settings, leave **Environment Variables empty**.
3. Use the [Recommended Vercel build settings](#recommended-vercel-build-settings) below.
4. Visit `/demo/faceless-crm` on the deployed URL.

This is the safest public deployment path.

---

## Mode 2: Full Real Mode Deployment

**Use this when you want to drive the `/ventures` + `/labs` + `/settings/byok`
surface with a real database and real LLM calls.**

### Required Vercel environment variables

| Name | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public; shipped to the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public; shipped to the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Server only. Bypasses RLS. Never expose to the browser. Mark as *Encrypted* in Vercel. |
| `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY` | **Secret.** 32-byte hex or base64 key for AES-256-GCM at-rest BYOK encryption. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Mark as *Encrypted*. |
| `VENTUREOS_ALPHA_ACCESS` | Set to `true` to enable the shared Alpha Workspace screen at `/access` so deployed Real Mode is usable without a full sign-up flow. See [Alpha Access Mode](#alpha-access-mode-deployed-real-mode). |

### Optional Vercel environment variables

| Name | Notes |
| --- | --- |
| `VENTUREOS_CREDENTIAL_ENCRYPTION_KID` | Stable identifier for the active key, used for rotation. Defaults to `k1`. |
| `VENTUREOS_TINYTROUPE_PYTHON` | Absolute path to a Python interpreter with `tinytroupe` installed. Not available on Vercel today; useful for self-hosted Real Mode only. |

### What is **NOT** a Vercel env var

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
  `AZURE_OPENAI_API_KEY` — entered through `/settings/byok`, encrypted at rest.
- `GITHUB_PAT` — entered through `/settings/byok`, encrypted at rest.

**Do not put provider API keys or the GitHub PAT into Vercel project
settings** unless explicitly required in the future.

### Steps

1. Generate the encryption key locally (one-time):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Store it in your password manager, never in the repo.
2. In Vercel project settings, add the five required env vars from the table
   above (and any optional ones you need).
3. Run the [Required deployment procedure](#required-deployment-procedure-microsoft--azure-ad-machines).
4. Visit `/access`, click **Continue to Alpha Workspace**, then add at least
   one LLM provider plus a GitHub PAT in BYOK.
5. Create a venture at `/ventures/new` and walk it through the labs.

---

## Alpha Access Mode (deployed Real Mode)

The deployed app does not include a full sign-up / sign-in flow yet. To make
deployed Real Mode usable for hackathon judges and testers without leaking
developer-only instructions, VentureOS ships a lightweight **Alpha Access**
screen at `/access`.

### How it works

1. The operator sets `VENTUREOS_ALPHA_ACCESS=true` on the Vercel project and
   redeploys.
2. The visitor lands on `/access` (directly, or via a 401 redirect from a
   Real Mode page). They see a polished card explaining Demo vs Real Mode and
   two CTAs: **Continue to Alpha Workspace** and **Open Demo Mode**.
3. Clicking **Continue to Alpha Workspace** POSTs to `/api/access/alpha`,
   which sets the `ventureos_alpha_access=1` HttpOnly cookie and redirects to
   the requested Real Mode page (defaults to `/settings/byok`).
4. From that point on, the server resolves the visitor as the shared
   `alpha-user` identity (id `alpha-user`, email `alpha@ventureos.local`).
   BYOK, ventures, labs, jobs, artifacts, timeline and GitHub export all use
   this identity.
5. Visitors can revoke access at `/access/revoke`. Encrypted BYOK credentials
   remain on the server until explicitly deleted from `/settings/byok`.

### Security properties

- The `vos_dev_user` JSON cookie used by local dev is **hard-disabled** in
  production builds (`NODE_ENV === 'production'`). The deployed app never
  honours it and never surfaces dev-cookie instructions in its UI.
- Alpha Access requires **both** the env flag **and** the cookie. Either
  alone resolves as no user.
- A real Supabase session always outranks Alpha Access. If you later add a
  real auth flow, signed-in users will not be downgraded to `alpha-user`.
- The Alpha Workspace is a **shared** identity. Do not use it for
  environments where multiple unrelated users will share the same workspace.
- Provider API keys and the GitHub PAT are still entered through the BYOK UI
  and encrypted at rest with AES-256-GCM. Alpha Access does not weaken any
  BYOK guarantees.

### Disabling Alpha Access

Set `VENTUREOS_ALPHA_ACCESS=false` (or remove the variable) and redeploy.
`/access` will then render the "Real Mode requires workspace access" setup
guidance instead of the Continue CTA.

---

## Recommended Vercel build settings

Set these once per project under *Project Settings → General* and *Build & Development Settings*.

| Setting | Value |
| --- | --- |
| Framework | **Next.js** |
| Node Version | **20.x** |
| Install Command | `corepack enable && corepack pnpm install --frozen-lockfile` |
| Build Command | `corepack pnpm run build` |
| Output Directory | *Next.js default* (Vercel resolves `apps/web/.next` automatically) |
| Root Directory | repository root (Vercel reads `pnpm-workspace.yaml`) |

---

## Pre-deployment checklist

Run from a clean working tree:

- [ ] `git status` is clean.
- [ ] PR #2 is merged or the deployment branch is intentional.
- [ ] `corepack pnpm run lint` passes.
- [ ] `corepack pnpm run lint:arch` passes (no provider-SDK boundary violations).
- [ ] `corepack pnpm run typecheck` passes.
- [ ] `corepack pnpm run test` passes (includes `api-errors.test.ts` and `github-export-panel.test.tsx` no-leak assertions).
- [ ] `corepack pnpm run build` passes.
- [ ] No `.env` or `.env.local` files are tracked: `git ls-files "*.env*"` returns **only** `apps/web/.env.example`.
- [ ] Secret scan passes (see [Public repo safety](#public-repo-safety) below).
- [ ] README is public-safe (no internal Microsoft context, no real keys).
- [ ] Demo Mode works locally at `http://localhost:3100/demo/faceless-crm` (or `:3000`).

---

## Post-deployment smoke test

### Zero-Key Demo (always run this)

Open these routes on the deployed URL and verify:

- `/` — homepage loads; Agent Swarms positioning is visible.
- `/demo` — demo index loads.
- `/demo/faceless-crm` — full pipeline loads with **no keys**:
  - venture summary and readiness score render
  - persona cards render
  - buying committee deliberation renders
  - research graph renders
  - VentureLab recommendation renders
  - BuildSquad plan renders
  - evaluation report renders
  - simulated GitHub export renders
- `/api/ventures` (no auth) — JSON 401 `{ ok: false, reason: 'Unauthorized' }`, never a stack trace.

### Real Mode (only if Supabase env vars are configured)

- `/ventures` — dashboard loads.
- `/ventures/new` — venture create flow loads.
- `/settings/byok` — BYOK provider add / validate works.
- Create Venture → run PersonaLab → run Research Graph → run VentureLab → run BuildSquad → preview GitHub export → export to GitHub.

### If Supabase env vars are **not** configured

- `/ventures`, `/labs/*`, `/settings/byok` show a friendly "Server is not
  configured for Real Mode" card and **never** leak a stack trace or env-var
  name. (This is `app/error.tsx` + `sanitizeApiError` doing their job.)

---

## Build and run from a fresh clone (local)

```bash
corepack enable
corepack pnpm install
corepack pnpm run lint
corepack pnpm run lint:arch
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run build
corepack pnpm --filter @ventureos/web start
```

The app boots on `http://localhost:3000` by default. Override with
`PORT=3100 corepack pnpm --filter @ventureos/web start`.

---

## Self-hosted deployment (alternative to Vercel)

Any host that runs Node 20 works. The Microsoft / Azure AD workaround above
is Vercel-specific; self-hosted deploys do not need it.

### A. Node process behind a reverse proxy

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @ventureos/web build

NODE_ENV=production PORT=3000 \
  corepack pnpm --filter @ventureos/web start
```

Front with nginx / Caddy / Cloudflare Tunnel. Set env vars in the process
supervisor (systemd, PM2, Docker), never in a file under `apps/web/`.

### B. Container image (sketch)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps ./apps
COPY packages ./packages
RUN corepack pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app .
RUN corepack pnpm --filter @ventureos/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=builder /app .
EXPOSE 3000
CMD ["corepack", "pnpm", "--filter", "@ventureos/web", "start"]
```

Pass env vars via `docker run -e …` or your orchestrator's secret store. No
secret should ever land in the image layers.

---

## Public repo safety

**Do not commit:**

- `.env`
- `.env.local`
- provider API keys (OpenAI, Anthropic, Gemini, Azure OpenAI)
- GitHub PAT
- Supabase service role key
- `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY`
- logs containing secrets
- screenshots that include keys, tokens, or `Authorization` headers

**Only commit:**

- `apps/web/.env.example` with placeholder values
- documentation with placeholder values

`.gitignore` already covers `.env*` with a `!**/.env.example` negation,
plus `.next/`, `coverage/`, `node_modules/`, `*.tsbuildinfo`, logs, and
sqlite databases. The `sanitizeApiError` layer plus the
`github-export-panel.test.tsx` no-token-leakage assertions defend the
runtime side; the pre-deployment checklist defends the repo side.
