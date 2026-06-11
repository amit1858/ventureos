# Local Setup

How to run VentureOS on your machine.

## Prerequisites

- **Node.js >= 20.** Tested on Node 24.
- **pnpm >= 9**, ideally via corepack: `corepack enable`.
- **Git**.
- Optional: **Python >= 3.10** if you want to run the scaffolded TinyTroupe / Graphify Python adapters (not required for the canonical TS runtime).

## Clone and install

```powershell
git clone https://github.com/amit1858/ventureos.git
cd ventureos
corepack pnpm install
```

## Demo Mode (zero setup)

You can run the demo with **no environment configuration at all**:

```powershell
corepack pnpm --filter "@ventureos/web" dev
# open http://localhost:3000/demo/faceless-crm
```

Demo Mode is fully seeded and makes no provider calls. See [`demo-mode.md`](demo-mode.md).

## Real Mode setup

Real Mode needs Supabase (for venture persistence and the encrypted credential store) and an encryption key for BYOK.

### 1. Create `apps/web/.env.local`

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
VENTUREOS_CREDENTIAL_ENCRYPTION_KEY=<32-byte hex or base64 string>
```

Optional:

```env
VENTUREOS_CREDENTIAL_ENCRYPTION_KID=k1
VENTUREOS_TINYTROUPE_PYTHON=<absolute path to python>
```

Generate a credential encryption key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> `.env.local` is git-ignored. Never commit it.

### 2. Run database migrations

```powershell
$env:SUPABASE_URL = "https://<project>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
node scripts/migrate.mjs
```

### 3. Authenticate as a workspace user

Real Mode pages require a user identity. Pick one of the following:

**Local dev: `vos_dev_user` cookie** (recommended for development)

In your browser's devtools console at `http://localhost:3000/`:

```js
document.cookie = 'vos_dev_user=' + encodeURIComponent('{"id":"u1","email":"you@example.com"}');
```

This cookie is only honoured when `NODE_ENV !== 'production'`. The deployed
app cannot be unlocked with it — production never reads it.

**Local or deployed: Alpha Workspace** (recommended for hackathon-style sharing)

Add to `apps/web/.env.local`:

```env
VENTUREOS_ALPHA_ACCESS=true
```

Then restart the dev server, visit `http://localhost:3000/access` and click
**Continue to Alpha Workspace**. You'll be resolved as the shared
`alpha-user` identity. See [`deployment.md`](deployment.md#alpha-access-mode-deployed-real-mode)
for the same flow on a deployed Vercel project.

### 4. Configure BYOK in the UI

Open `http://localhost:3000/settings/byok` and add:

- One LLM credential — OpenAI, Anthropic, Gemini or Azure OpenAI.
- A GitHub PAT (with the `repo` scope) for the GitHub Export feature.

Each credential is validated with a minimal read-only call before being saved. See [`security-byok.md`](security-byok.md).

### 5. Create your first Venture

`/ventures/new` — give it a brief and a target market. From the Workspace, run PersonaLab → Buying Committee → Research Graph → VentureLab → BuildSquad, then generate the Evaluation Report and export to GitHub.

## Quality gates

Before committing:

```powershell
corepack pnpm run lint
corepack pnpm run lint:arch
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run build
```

Or all at once:

```powershell
corepack pnpm run ci
```

## Common gotchas

- **Port conflict on 3000.** Next.js will try `3001`, `3100`, etc. The README and docs link `localhost:3000` for clarity; substitute as needed.
- **`pnpm` not on PATH.** Use `corepack pnpm` until you `corepack enable`. After enabling, `pnpm` works directly.
- **Windows path with `[slug]` directories.** Use `[System.IO.Directory]::CreateDirectory(...)` from PowerShell — `New-Item` interprets `[id]` as a wildcard.
- **`lint:arch` failure.** You imported a provider SDK from a non-adapter package. Move the import into the matching `packages/providers/*` or `packages/adapters/github-ts/` package.
- **Credential decryption fails on startup.** `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY` is missing or has the wrong length. Re-generate (32 bytes).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `MissingCredentialError` when running a lab | BYOK credential for the chosen provider is not configured or not validated. |
| GitHub export fails with `insufficient_scope` | PAT is missing the `repo` scope. Re-issue with the right scopes and re-validate at `/settings/byok`. |
| GitHub export fails with `repo_exists` | A repo with that name already exists on your account. Pick a different name in the export modal. |
| `lint:arch` red | Vendor SDK imported in an app or lab package. Move it into an adapter package. |
| Demo page renders but Workspace pages 500 | `.env.local` is missing Supabase or encryption key vars. Demo Mode works without them; Real Mode does not. |
