# Known Limitations

We are honest about what Foundry is and is not. This list is the single source of truth for the gap between the brand promise and the shipped runtime.

## Runtime gaps

- **TinyTroupe Python adapter is scaffolded, not wired.** The canonical PersonaLab runtime is the TypeScript implementation in `packages/personalab`. The Python adapter (`packages/adapters/tinytroupe-py`) is a forward-compatible seam. We describe PersonaLab as "TinyTroupe-style persona simulation" and do **not** claim full Python TinyTroupe parity.
- **Graphify Python / TS adapters are scaffolded, not wired.** Research-graph construction is done by `@foundry/research-graph` directly. The Graphify adapters (`packages/adapters/graphify-*`) are placeholders. We describe the workflow as "Graphify-inspired" and do **not** claim full Graphify parity.
- **Squad-OSS integration is not present.** BuildSquad's planning swarm is fully home-grown. There is no Squad-OSS dependency.
- **No external queue.** `VentureJob` is durable per-process. Very long jobs survive a request boundary but not a process restart mid-flight. A future iteration would back this with Temporal or similar.
- **No streaming UI for in-flight lab runs.** Jobs surface as polled status with step + percent. There is no token-by-token streaming in the Workspace.
- **Single-tenant by default.** Tenant ID is wired through artifact and job records, but the UI does not currently surface a tenant switcher.

## Provider gaps

- **Model lists are not auto-refreshed.** The list of available models per provider is fetched on validation and shown in the BYOK UI; it is not periodically re-fetched. If a provider retires a model mid-session, you'll see a `provider_unavailable` or `unknown_model` style failure with retry guidance.
- **Cost estimation is per-call, not per-token-streamed.** We record total cost on job completion. We do not project running cost while a job is in-flight.

## GitHub export gaps

- **Single repo per venture.** We do not currently re-push updated artifacts to an existing repo. The `repo_exists` failure is intentional and actionable — pick a new repo name in the export modal.
- **No PR-based export.** Export is a single commit to `main` (or whatever default branch the new repo gets). We do not open a PR.
- **No release / tag.** We don't tag the export. Future work.

## Demo Mode gaps

- **One seeded venture.** The Faceless CRM for SMB demo is the only seeded scenario today. Adding more is a one-file change; see [`demo-mode.md`](demo-mode.md).
- **No simulated job progress.** The demo shows completed artifacts directly. It does not animate the pipeline as if jobs were running.

## Engineering gaps

- **Test coverage is selective.** Web, BuildSquad, contracts, the GitHub adapter and the reason-code helpers have meaningful tests. Some labs have fewer unit tests; integration tests are the priority once the E2E bug bash starts.
- **No load/performance testing.** Latency under concurrent VentureJobs has not been benchmarked.
- **Auth — Google sign-in is live; org-level RBAC is roadmap.** The deployed app supports **Google sign-in** via Supabase Auth with an optional `VENTUREOS_ALLOWED_EMAILS` allowlist (case-insensitive, whitespace-trimmed) — verified end-to-end on production and appropriate for sharing with a small group of invited testers (~10), where each user gets a private workspace scoped to their Supabase user id. The **Alpha Workspace** (`/access`, shared `alpha-user` identity gated by `VENTUREOS_ALPHA_ACCESS=true` + opt-in cookie) remains as a fallback for hackathon judging and personal testing. It is **not** appropriate for environments where multiple unrelated users will share the same BYOK credentials and ventures. A full per-user OAuth/SSO flow with org-level RBAC (Microsoft Entra ID, GitHub OAuth, role-based access control, multi-tenant organisations, invite emails) is still on the roadmap.
- **Local dev cookie is dev-only.** The legacy `vos_dev_user` cookie is honoured only when `NODE_ENV !== 'production'`. The deployed app never reads it and never surfaces dev-cookie instructions.

## What this does **not** mean

- The product is **real**. The agent swarm produces real artifacts in Real Mode against real provider keys, and a real GitHub repository under the user's account.
- The architecture is **real**. Contracts, BYOK isolation, import-boundary enforcement, the VentureJob primitive and the GitHub adapter are all genuinely implemented.
- Demo Mode is **real**. The seeded artifacts go through the same renderers Real Mode uses; the export file list is the actual renderer output, not a mock.

We will update this document as gaps are closed.
