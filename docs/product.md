# What is VentureOS?

> **VentureOS is an AI-native venture operating system.** It turns a raw product idea into a validated, build-ready venture — with synthetic customer research, evidence graphs, a Proceed / Pivot / Kill recommendation, a full BuildSquad plan, an evaluation report, and a real GitHub repository — all produced by a governed swarm of specialized agents, not a single chatbot.

**Live deployment:** https://ventureos-dun.vercel.app · **Zero-key demo:** https://ventureos-dun.vercel.app/demo/faceless-crm · **Repo:** https://github.com/amit1858/ventureos

---

## TL;DR

If a "chat with GPT to draft a PRD" tool is a **typewriter**, VentureOS is a **product-discovery workshop**: a multi-agent system that simulates the customer, stress-tests the opportunity, plans the build, and ships a real repository — with an audit trail of which model said what, when, and with what evidence. You bring your own LLM keys; nothing leaves the boundary you don't explicitly authorize.

**One sentence:** *VentureOS decides what to build — before you write code — by running an opinionated swarm of agents over a structured Venture object, then handing you a buildable GitHub repo with a Proceed / Pivot / Kill recommendation.*

---

## The problem

Most "AI for product" tools generate documents. That's not the bottleneck. The actual bottleneck in turning an idea into a real product is the **discovery-to-build loop**:

| Stage | Today's reality |
| --- | --- |
| Customer discovery | Slow, biased, rarely run against an honest objection set |
| Opportunity sizing | Anecdote-driven; "go / pivot / kill" made on vibes |
| Validated insight → buildable PRD | Huge gap; usually re-done from scratch |
| Evidence trail | Lives in 12 Notion pages and one Slack thread |
| Provenance | Nobody can tell you *which model produced this paragraph* |

LLM tools today accelerate **execution** (Copilot, Cursor). VentureOS accelerates **the decision to build the right thing**. It's the deliberation layer that sits in front of your IDE.

---

## What you get, end-to-end

Give VentureOS a one-paragraph idea brief. Out the other end, you walk away with:

1. **A simulated buying committee** — synthetic SMB buyers, ops leads, finance, and economic buyers who actually *deliberate* about your offer, surface objections, and change positions
2. **A research graph** — a typed graph of problems, customer segments, competitors, risks and contradictions, with "god-nodes" surfaced where the same issue appears in multiple parts of the evidence
3. **A Proceed / Pivot / Kill recommendation** — with an explicit confidence score and provenance
4. **A BuildSquad plan** — PRD, architecture overview, 14-file repo scaffold, prioritized roadmap, user stories, and GTM notes from a PM + UX + architect + engineer + QA + GTM agent group
5. **An evaluation report** — `EVALUATION_REPORT.md` that names the model and provider behind each artifact, including readiness scores and risk coverage
6. **A real GitHub repository** — pushed under your account with the full artifact pack as the first commit, ready to clone and start coding

Every artifact is **typed**, **versioned**, and **stored** against a single `Venture` object. The next agent reads only those artifacts — never raw prompts. That's what makes this a system, not a script.

---

## How it works (the architecture, in one diagram)

```
                                ┌────────────────────────────┐
                                │       Venture (state)      │
                                │  brief · personas · graph  │
                                │  recommendation · plan     │
                                │  evaluation · export       │
                                └────────────┬───────────────┘
                                             │  (artifact handoff)
   Idea Intake                                ▼
        │
        ▼
   PersonaLab  ──▶  Buying Committee  ──▶  Research Graph
                                                │
                                                ▼
                                          VentureLab  ──▶  Proceed / Pivot / Kill
                                                                       │
                                                                       ▼
                                                                 BuildSquad
                                                                       │
                                                                       ▼
                                                                  Evaluation
                                                                       │
                                                                       ▼
                                                                GitHub Export
                                                                  (real repo)
```

Every arrow is a `VentureJob` — a durable, observable async task with status, progress %, provider + model + cost, elapsed time, and structured failure reasons. The Workspace UI always knows what's happening and why, with deep-links to retry the right thing.

---

## What the agent swarm actually does

| Lab | Agent group | Reads | Produces | Why it matters |
| --- | --- | --- | --- | --- |
| **PersonaLab** | Synthetic-customer simulator (TinyTroupe-style) | Brief + segment hints | Persona set + interview transcripts | Surfaces the questions your real customers would ask before you ship |
| **Buying Committee** | Multi-persona deliberation | Persona set + offer | Committee transcript + consensus + objection list | Tells you who'll block the deal and why |
| **Research Graph** | Evidence mapper (Graphify-inspired) | Brief + persona signals | Typed graph: problems · segments · competitors · risks · contradictions | Replaces "wall of bullet points" with structure you can reason over |
| **VentureLab** | Venture decision engine | Personas + committee + graph | Proceed / Pivot / Kill + confidence + rationale | The actual decision — not just analysis |
| **BuildSquad** | PM · UX · architect · engineer · QA · GTM agents | Validated venture | PRD + architecture + roadmap + user stories + 14-file repo scaffold | Closes the validated-insight → buildable-repo gap |
| **Evaluation** | Quality + provenance agent | Every artifact | `EVALUATION_REPORT.md` | Tells you *which model produced what*, with readiness + risk coverage scores |
| **GitHub Export** | Execution handoff | All artifacts | Real repo, single commit, your account | Hands the work to engineering with one click |

**This is what people mean by "agent swarms":** many specialized agents collaborating through a shared `Venture` context and versioned artifacts — not a single chatbot pretending to wear many hats.

---

## Why this is different

| Typical "AI for product" tool | VentureOS |
| --- | --- |
| One chatbot that drafts whatever you ask | A governed swarm of specialized agents with typed handoffs |
| Output is prose in a Markdown blob | Output is typed artifacts + a real GitHub repo |
| "Trust the model" | Every artifact carries which model + provider + cost produced it |
| Provider lock-in (built on one API) | **BYOK** — bring your own OpenAI · Anthropic · Gemini · Azure OpenAI key |
| Secrets in app config | BYOK keys are encrypted at rest with AES-256-GCM, never exposed to the browser, never logged |
| One identity, shared workspace | Google sign-in (per-user) · Alpha Workspace (shared, hackathon) · Demo Mode (public, zero-key) |
| No demo for evaluators | Fully seeded Demo Mode at `/demo/faceless-crm` with no setup |
| Mocked / placeholder output | Every artifact in Real Mode is the genuine output of a real provider call |

---

## Who it's for

- **Founders** weighing 3 product ideas — VentureOS gives you a defensible "go with idea 2" with provenance, not a hunch
- **Product managers** at established companies — replace the 6-week pre-PRD discovery sprint with a 2-day workshop that produces the same artifact pack, with audit trail
- **Strategy teams** evaluating adjacent markets — get a typed research graph + objection log + competitive map in hours
- **Hackathon and design-partner workflows** — a clean, structured way to take a partner's idea from intake to a build-ready repo in one session
- **Anyone who's tired of "chat with GPT and copy-paste into Notion"** — VentureOS treats discovery as a system, not a transcript

---

## Concrete value propositions

1. **Compress the discovery loop from weeks to hours.** Personas, buying committee, research graph, recommendation and BuildSquad plan that would take 4–6 weeks of human work are produced in one async session.
2. **Replace "vibes" with evidence + provenance.** Every conclusion cites which model, which artifact upstream, and which raw signal it came from. You can defend the decision in a stakeholder review.
3. **Stop wasting engineering on the wrong idea.** A Proceed / Pivot / Kill with a confidence score, *before* engineering writes code, with a clear "what would change my mind" objection list.
4. **Hand engineering a real starting point.** The GitHub export is a 14-file repo (README · ARCHITECTURE · PRD · ROADMAP · API spec · user stories · evaluation report · …) — not a 30-page PDF.
5. **Stay in control of cost and data.** BYOK keys, server-side encryption, no provider lock-in, no secrets sent to the browser, no third-party telemetry. You can audit exactly what got sent where.
6. **Bring the team.** Google sign-in + an optional email allowlist means you can share the deployed instance with ~10 testers and each gets a private workspace; ventures and BYOK credentials don't bleed across users.
7. **Evaluate the platform with no commitment.** The seeded Demo Mode shows the full pipeline end-to-end without any keys, accounts, or sign-up.

---

## The product surfaces

| Surface | What it does |
| --- | --- |
| **Homepage** (`/`) | Multi-agent positioning, workflow visualization, two CTAs: "Try Demo" and "Sign in to Real Mode" |
| **Demo Mode** (`/demo/faceless-crm`) | Fully seeded "Faceless CRM for SMB" venture — taken from idea through GitHub-ready artifacts, no keys, no setup, no provider calls |
| **Venture Workspace** (`/ventures/[id]`) | The main product surface — readiness ring, per-dimension coverage, latest recommendation, active jobs, next-best-action, artifact gallery, export status |
| **PersonaLab** (`/labs/persona`) | Generate personas, run buying committees |
| **Research Graph** (`/labs/research-graph`) | Build and visualize the evidence graph |
| **VentureLab** (`/labs/venture`) | Run the Proceed / Pivot / Kill engine |
| **BuildSquad** (`/labs/buildsquad`) | Generate the PRD + architecture + roadmap + repo scaffold |
| **BYOK Settings** (`/settings/byok`) | Add / validate / delete LLM provider credentials and GitHub PAT |
| **GitHub Export** | Preview + push the full artifact pack to a real GitHub repo on your account |
| **Sign-in** (`/signin`) | Google OAuth for invited testers (allowlist-gated) |
| **Access** (`/access`) | Choose between Google sign-in, Alpha Workspace, or Demo Mode |

---

## Architecture in one paragraph

VentureOS is a **TypeScript-first monorepo** (pnpm + turbo) with a strict five-plane layout — Experience, Orchestration, Lab, Provider, Persistence. Every lab is a pure package (`@ventureos/personalab`, `@ventureos/venturelab`, `@ventureos/buildsquad`, `@ventureos/research-graph`) that consumes and produces JSON contracts from `@ventureos/contracts`. Long-running work runs as a `VentureJob` so the UI always sees status / progress / provider · model · cost / elapsed / failure guidance. Provider SDKs (OpenAI, Anthropic, Gemini, Azure OpenAI, Octokit) live only in their named adapter packages, enforced by a custom `lint:arch` check that fails the build if anything imports `openai`, `@anthropic-ai/sdk`, etc., outside its approved package.

See [`architecture-overview.md`](architecture-overview.md) for the full breakdown.

---

## Access modes at a glance

| Mode | Who | Auth | Keys | Best for |
| --- | --- | --- | --- | --- |
| **Demo Mode** | Anyone | None | None | Judges, evaluators, "show me what this does" — open at `/demo/faceless-crm` |
| **Google sign-in** | Invited testers via allowlist (`VENTUREOS_ALLOWED_EMAILS`) | Supabase Auth + Google OAuth | BYOK | Sharing the deployment with ~10 testers, each getting a private workspace |
| **Alpha Workspace** | Anyone with the URL who clicks through `/access` | Server cookie + env flag | BYOK | Hackathon judges, single-tester self-evaluation |
| **Local dev cookie** | Local-dev only (`NODE_ENV !== 'production'`) | `vos_dev_user` cookie | BYOK | Running on your laptop |

Identity priority is enforced server-side: **real Supabase user > Alpha Workspace > dev cookie > none**. A real Google user always outranks the Alpha fallback, so signed-in testers never accidentally write to the shared `alpha-user` workspace.

See [`security-byok.md`](security-byok.md) for the full identity-resolution table.

---

## Security posture

- **BYOK secrets are server-side only.** They never reach the browser. The UI shows masked previews only.
- **At-rest encryption.** Provider keys and GitHub PATs are encrypted with `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY` (AES-256-GCM).
- **No provider keys in environment.** Provider API keys + GitHub PATs are entered exclusively through `/settings/byok`, never via Vercel env vars.
- **Per-user RLS isolation.** Under Google sign-in, two testers on the same deployment cannot see, modify, validate, or delete each other's BYOK providers or ventures.
- **No secret leaks in exports.** A dedicated test asserts no `ghp_…` / `sk-…` shaped strings ever appear in exported file contents.
- **No telemetry.** VentureOS does not ship telemetry to a third party. The only outbound calls are to the LLM provider you configured.
- **Import boundaries enforced.** A custom `lint:arch` check fails the build if app or lab code imports provider SDKs directly.

See [`security-byok.md`](security-byok.md) and [`security.md`](security.md).

---

## Status

- ✅ **Demo Mode** — public, zero-key, fully seeded, deployed
- ✅ **Real Mode** — BYOK provider system with OpenAI, Anthropic, Gemini, Azure OpenAI adapters
- ✅ **PersonaLab + Buying Committee + Research Graph + VentureLab + BuildSquad + Evaluation + GitHub Export** — all wired end-to-end
- ✅ **Google sign-in** — Supabase Auth with per-user workspaces, email allowlist, deployed and tested
- ✅ **Alpha Workspace** — server-cookie-gated fallback for hackathon and personal testing
- ✅ **GitHub Export** — Octokit-backed export creating a real repo with 14 artifact files
- ✅ **Quality gates** — `lint`, `lint:arch`, `typecheck` (29 packages), `test` (72 tests), `build` all green
- ✅ **Vercel deployment** documented for Microsoft / Azure AD machines (Azure-AD workaround procedure)

See [`product-roadmap.md`](product-roadmap.md) for what's next, and [`known-limitations.md`](known-limitations.md) for what we're explicitly *not* claiming yet.

---

## Honest limits

We are deliberate about what VentureOS is and is not. From [`known-limitations.md`](known-limitations.md):

- The TS implementation is canonical. The TinyTroupe / Graphify / Squad-OSS Python adapters are **scaffolded seams**, not wired runtimes. We say "TinyTroupe-style" and "Graphify-inspired" intentionally.
- `VentureJob` is durable per-process but not crash-safe across mid-flight process restarts. A future iteration would back this with Temporal or similar.
- Cost is recorded per-call, not streamed token-by-token while a job is in-flight.
- GitHub export is single-commit to `main` on a new repo (the `repo_exists` failure is intentional and actionable). PR-based export is future work.
- Auth is light. Google sign-in + Alpha Workspace are appropriate for invited-tester deployments. A full per-user OAuth/SSO flow with org-level RBAC is roadmap work.

Read the full list — we keep it up to date.

---

## Try it

1. **Just look at it** → https://ventureos-dun.vercel.app/demo/faceless-crm (no setup)
2. **Sign in and run it on your own idea** → https://ventureos-dun.vercel.app/signin → Continue with Google (you must be on the allowlist; ask Amit)
3. **Run it locally** → `corepack pnpm install && corepack pnpm --filter @ventureos/web dev` → open http://localhost:3000

See [`setup-local.md`](setup-local.md) for local Real Mode, [`deployment.md`](deployment.md) for the full Vercel deployment runbook (including Supabase Google OAuth setup), and the [`README`](../README.md) for the engineering quick-start.

---

## Where to go next

| If you're a… | Read this |
| --- | --- |
| Judge or evaluator | [`demo-script.md`](demo-script.md) — 3 / 5 / 7-minute guided walkthroughs |
| Engineer | [`architecture-overview.md`](architecture-overview.md), [`repository-structure.md`](repository-structure.md), [`provider-abstraction.md`](provider-abstraction.md) |
| Security reviewer | [`security-byok.md`](security-byok.md), [`security.md`](security.md) |
| Operator deploying it | [`deployment.md`](deployment.md), [`setup-local.md`](setup-local.md), [`known-limitations.md`](known-limitations.md) |
| Product / strategy | [`vision.md`](vision.md), [`product-roadmap.md`](product-roadmap.md), [`faceless-crm-reference-scenario.md`](faceless-crm-reference-scenario.md) |
| Researcher / curious about the design | [`agent-swarms.md`](agent-swarms.md), [`evaluation-framework.md`](evaluation-framework.md), [`adapter-strategy.md`](adapter-strategy.md) |
