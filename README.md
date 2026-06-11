# VentureOS

VentureOS is an AI-native venture incubation platform that turns raw product ideas into evaluated, execution-ready artifacts.

Pipeline:

`brief -> synthetic personas -> research graph -> venture recommendation -> BuildSquad plan -> GitHub-ready execution pack`

The monorepo is polyglot (TypeScript + Python), contract-first, and BYOK (bring your own LLM keys).

## What VentureOS Does

- Models customer and stakeholder behavior with synthetic personas.
- Builds structured research graphs from evidence and hypotheses.
- Scores and compares venture options with repeatable evaluation criteria.
- Produces implementation plans and exportable artifacts for engineering execution.

## Architecture Overview

Core planes and modules:

- `apps/web`: Next.js product shell and APIs.
- `packages/personalab`: Persona simulation and behavior synthesis.
- `packages/venturelab`: Venture scoring, recommendation, and evaluation.
- `packages/buildsquad`: Build planning and artifact generation.
- `packages/providers/*`: LLM provider adapters behind a strict abstraction seam.
- `packages/contracts`: Shared schemas and generated types.

Provider SDK imports are guarded by architecture checks (`pnpm lint:arch`) so application layers do not couple directly to vendor SDKs.

## Quick Start

Prerequisites:

- Node.js `>=20`
- pnpm `>=9`
- Python `>=3.10` (for Python adapters)

Install and run:

```powershell
pnpm install
pnpm --filter @ventureos/web dev
```

Web app runs at `http://localhost:3000`.

## Environment Variables

Use placeholders only in committed files. Start from:

- `apps/web/.env.example`

Create a local file (do not commit):

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

Required placeholders in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
VENTUREOS_CREDENTIAL_ENCRYPTION_KEY=<32-byte-hex-or-base64>
```

Optional placeholders:

```env
VENTUREOS_CREDENTIAL_ENCRYPTION_KID=k1
VENTUREOS_TINYTROUPE_PYTHON=<absolute-path-to-python>
```

## Database Migrations

```powershell
$env:SUPABASE_URL = "https://<project>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
node scripts/migrate.mjs
```

## Quality Gates

Run full local validation before commits:

```powershell
pnpm install
pnpm run ci
```

Or run checks individually:

```powershell
pnpm run lint
pnpm run lint:arch
pnpm run typecheck
pnpm run test
pnpm run build
```

## AI Tools Used

- Multi-provider LLM routing through adapter packages in `packages/providers/*`.
- Synthetic persona simulation via TinyTroupe adapter (`packages/adapters/tinytroupe-py`).
- Research graph tooling via Graphify adapters (`packages/adapters/graphify-*`).
- Build planning and critique workflows in BuildSquad (`packages/buildsquad`).

## Security and BYOK

- BYOK secrets are server-side only and never exposed to browser clients.
- Secrets are encrypted at rest and surfaced in UI only as masked values.
- Provider-specific credentials are isolated behind provider abstractions.
- Import boundary checks prevent unsafe direct SDK use outside approved layers.

See [docs/security.md](docs/security.md) and [docs/provider-abstraction.md](docs/provider-abstraction.md).

## Documentation

- [docs/vision.md](docs/vision.md)
- [docs/product-roadmap.md](docs/product-roadmap.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/security.md](docs/security.md)
- [docs/provider-abstraction.md](docs/provider-abstraction.md)
- [docs/repository-structure.md](docs/repository-structure.md)
