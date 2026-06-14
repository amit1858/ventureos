# Submission form copy

> Paste these blocks directly into the **Microsoft Build AI / HackerEarth**
> submission form. Every block is self-contained — no editing required.

---

## Project Title

```
VentureOS
```

---

## One-liner / Tagline

```
AI-native multi-agent venture operating system that turns raw ideas into validated, build-ready ventures with agent swarms.
```

---

## Short description (≤ 280 chars)

```
VentureOS gives every idea an agent swarm. Synthetic personas, a buying committee, a research graph, validation, BuildSquad planning and an evaluation agent collaborate to turn a raw idea into a validated, GitHub-ready venture — before a single line of code ships.
```

---

## Long description (judge-facing)

```
VentureOS helps founders and product teams decide what to build before they build it. It uses a swarm of specialized AI agents to:

- simulate synthetic customers (PersonaLab)
- run a buying committee that debates and challenges assumptions
- structure evidence into a navigable research graph
- score venture readiness and recommend Proceed / Pivot / Kill (VentureLab)
- generate execution artifacts: PRD, architecture, roadmap, user stories and risks (BuildSquad)
- produce a versioned evaluation report with full provenance
- export the whole venture as a 14-file, GitHub-ready repo scaffold

Every agent reads and writes against one typed Venture object, executed via the VentureJob async primitive. Contracts-first. Provenance-aware. BYOK-only — provider keys (OpenAI, Anthropic, Gemini, Azure OpenAI) and GitHub PATs are encrypted server-side, never logged, never shipped to the browser.

The deployed app ships with a zero-key Demo Mode at /demo/faceless-crm — judges can walk the full pipeline end-to-end without signing in or supplying a single key.

Real Mode adds Google sign-in via Supabase Auth (with an optional email allowlist) so invited testers get per-user workspaces. Demo Mode and Real Mode coexist; the public Demo Mode is the recommended judging path.
```

---

## Track

```
Agent Swarms
```

---

## Why this fits Agent Swarms

```
VentureOS is not a single chatbot. It coordinates multiple specialized agents across the venture lifecycle: persona agents, a buying-committee agent, research-graph agents, a venture-validation agent, BuildSquad planning agents and an evaluation agent.

Each step produces a typed, versioned artifact the next agent reads. The agents share one Venture context, run as VentureJobs with full provenance, and surface their decisions in an auditable Evaluation Report. Provider keys are user-owned (BYOK), so the same swarm runs against any LLM (OpenAI, Anthropic, Gemini, Azure OpenAI) without lock-in.

This is the agent-swarm pattern applied to the hardest problem in product: deciding what to build before you build it.
```

---

## Live app URL

```
https://ventureos-dun.vercel.app
```

---

## Recommended demo path (zero-key, no sign-in)

```
https://ventureos-dun.vercel.app/demo/faceless-crm
```

---

## GitHub repository

```
https://github.com/amit1858/ventureos
```

---

## Demo video

> Paste your YouTube unlisted URL or MP4 download link here.

```
(your video URL — see demo-script.md for the 3-min script)
```

---

## Submission deck (PDF)

```
docs/hackathon/VentureOS-Submission-Deck.pdf
```

---

## Team

```
Amit Pandey — solo build
```

---

## Tagged release

```
v1.0-submission — https://github.com/amit1858/ventureos/releases/tag/v1.0-submission
```

---

## Tech stack (compact)

```
Next.js 14 (app router) · TypeScript · pnpm + turbo monorepo · Vercel (deployment) · Supabase (Postgres + Auth) · Google OAuth · BYOK provider layer: OpenAI / Anthropic / Gemini / Azure OpenAI · Octokit (BYOK GitHub export) · vitest (72 tests)
```

---

## AI tools / techniques used

```
- Multi-agent workflow with shared typed Venture context
- TinyTroupe-style synthetic persona simulation (pain, JTBD, decision drivers)
- Graphify-inspired research-graph workflow (problems / evidence / contradictions)
- BuildSquad planning agents (PRD, architecture, roadmap, stories, risks)
- Evaluation agent that renders a versioned readiness report from artifacts
- Model + provider metadata recorded on every artifact (audit trail)
- BYOK provider abstraction — no provider lock-in, no SDKs leaked outside approved packages (lint:arch import boundary checks)

Note: TinyTroupe / Graphify adapters are scaffolded; full Python runtime parity is a roadmap item — see docs/known-limitations.md.
```

---

## Notable engineering controls (for judges)

```
- Contracts-first architecture — every artifact is a typed JSON contract in @ventureos/contracts
- VentureJob async execution primitive with timeline, provenance, retries and cancellation
- import-boundary checks (pnpm lint:arch) keep vendor SDKs out of app code
- Sanitized API errors — no provider keys, tokens or stack traces leak in HTTP responses
- 72 web tests + static-source contract tests on every Real-Mode page
- Demo Mode is fully sandboxed — seeded data, no provider calls, no GitHub calls
- Encrypted BYOK credentials at rest (server-side AES-GCM)
- Optional email allowlist (VENTUREOS_ALLOWED_EMAILS) gates Google sign-in
```

---

## Known limitations (be honest with judges)

```
- TinyTroupe / Graphify adapters are scaffolded — full Python runtime parity is a roadmap item.
- Multi-user collaboration and role-based access control are future work; per-user Google-auth workspaces are supported today.
- Microsoft Entra ID and GitHub OAuth are roadmap; Google sign-in via Supabase Auth is shipped.
- No billing, invite emails, or multi-tenant orgs yet.
- See docs/known-limitations.md for the full list.
```

---

## Test access (if the judge wants Real Mode)

```
Real Mode requires Google sign-in. The deployed app has an email allowlist; to test the BYOK flow end-to-end please email the project owner or use the public, zero-key Demo Mode at /demo/faceless-crm — it shows the full pipeline output without any credentials.
```

---

## Contact

```
GitHub: https://github.com/amit1858
Repo issues: https://github.com/amit1858/ventureos/issues
```

---

## Final pre-submission checklist

- [x] GitHub repo is public (`amit1858/ventureos`)
- [x] Live app works in incognito (`https://ventureos-dun.vercel.app`)
- [x] Zero-key demo works in incognito (`/demo/faceless-crm`)
- [x] Submission deck is under 20 MB (current: ~0.7 MB PDF, ~1.8 MB PPTX)
- [x] README is public-safe (no secrets, no internal sprint notes)
- [x] Tagged release `v1.0-submission` exists on GitHub
- [x] `docs/product.md` is the front door for first-time visitors
- [x] `docs/hackathon/` has deck + script + this submission copy
- [ ] Demo video recorded and uploaded (≤ 3 min, ≥ 720p) — **see demo-script.md**
- [ ] Submission form filled and submitted
