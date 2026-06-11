# Deployment

VentureOS ships as a Next.js 14 App-Router app inside a pnpm + Turborepo
workspace. This page covers the two supported deployment paths plus the
environment-variable contract.

> **Demo Mode** (`/`, `/demo`, `/demo/faceless-crm`) renders entirely from
> seeded data and **requires no environment variables and no external services**.
> A judge can deploy the repo with zero secrets and still walk the Faceless CRM
> pipeline end-to-end. Real Mode (the `/ventures` + `/labs` + `/settings/byok`
> surface) needs Supabase plus an encryption key — see the table below.

---

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | **20.0+** (declared in `package.json#engines`) |
| pnpm | **9.0+**, installed via `corepack` |
| Git | any recent |

Enable Corepack once per machine: `corepack enable`.

---

## Environment variables

| Name | Required for | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Real Mode | Public; shipped to the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Real Mode | Public; shipped to the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | Real Mode | **Secret.** Server only. Bypasses RLS. Never expose to the browser. |
| `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY` | Real Mode | **Secret.** 32-byte hex or base64 key for AES-256-GCM at-rest BYOK encryption. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `VENTUREOS_CREDENTIAL_ENCRYPTION_KID` | optional | Stable identifier for the active key, used for rotation. Defaults to `k1`. |
| `VENTUREOS_TINYTROUPE_PYTHON` | optional | Absolute path to a Python interpreter with `tinytroupe` installed; enables the TinyTroupe-backed PersonaLab engine. The BYOK secret is passed only through the subprocess environment, never argv/stdin/logs. |

**Provider keys** (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
`AZURE_OPENAI_API_KEY`) and the **GitHub PAT** are **never** server-side env
vars. Users enter them through the BYOK UI at `/settings/byok` and they are
stored encrypted at rest.

If Real Mode env is missing, `app/error.tsx` plus the sanitized API error
layer surface a graceful "Server is not configured for Real Mode" message
that points users at Demo Mode and `docs/setup-local.md`. Stack traces and
the missing-variable name are never echoed to the browser.

---

## Build and run from a fresh clone

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

## Vercel deployment

VentureOS is Vercel-compatible out of the box.

1. **Import the repository.** Vercel detects Next.js automatically.
2. **Set the root.** Project root: repository root. Vercel will read
   `pnpm-workspace.yaml` and resolve `apps/web` automatically.
3. **Install command:** `corepack enable && corepack pnpm install`.
4. **Build command:** `corepack pnpm --filter @ventureos/web... build`.
5. **Output directory:** leave default (Vercel picks `apps/web/.next`).
6. **Node runtime:** Node 20. Set under *Project Settings → General*.
7. **Environment variables:** add only the Real-Mode names from the table
   above. Mark `SUPABASE_SERVICE_ROLE_KEY` and
   `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY` as *secret*.
8. **Deploy.** First-time visit `/demo/faceless-crm` to confirm Demo Mode
   renders without any auth.

### Vercel zero-key deployment (judges)

For an Agent-Swarms judging deployment that runs purely from seeded data:
skip step 7 entirely. The build still succeeds, Demo Mode works, and Real
Mode shows graceful "server not configured" guidance when visited.

---

## Self-hosted deployment

Any host that runs Node 20 works. Two common shapes:

### A. Node process behind a reverse proxy

```bash
# build
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @ventureos/web build

# run
NODE_ENV=production PORT=3000 \
  corepack pnpm --filter @ventureos/web start
```

Front with nginx / Caddy / Cloudflare Tunnel as you prefer. Set the env
variables in the process supervisor (systemd, PM2, Docker, etc.), never in a
file under `apps/web/`.

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

## Post-deploy smoke test

1. `GET /` — homepage renders with the multi-agent Agent Swarms pipeline.
2. `GET /demo/faceless-crm` — full seeded walkthrough loads with no auth.
3. `GET /ventures` (logged out) — graceful sign-in/Demo-Mode guidance, no
   stack trace, no env-var name leakage.
4. `GET /api/ventures` (no auth) — JSON 401 `{ ok: false, reason: 'Unauthorized' }`.
5. (Real Mode only) Sign in, visit `/settings/byok`, add an OpenAI key, then
   visit `/labs/persona` to confirm provider validation runs.

---

## Safety checklist before pushing a deployment

- [ ] `.env.local` and any host-specific env file are **not** in the deploy artifact.
- [ ] `corepack pnpm run lint:arch` passes (no SDK import-boundary violations).
- [ ] `corepack pnpm run test` passes (includes `api-errors.test.ts` +
      `github-export-panel.test.tsx` no-token-leakage assertions).
- [ ] `git ls-files "*.env*"` returns only `apps/web/.env.example`.
- [ ] `docs/known-limitations.md` accurately describes what is alpha vs.
      future work, including the deferred Python adapter parity.
