# VentureOS — Hackathon Submission Pack

> **Microsoft Build AI / HackerEarth · Agent Swarms track · v0.3-alpha**
>
> Live app · <https://ventureos-dun.vercel.app>
> Demo path · <https://ventureos-dun.vercel.app/demo/faceless-crm>
> Repo · <https://github.com/amit1858/ventureos>

This folder contains everything a judge or evaluator needs to assess
VentureOS without running the codebase.

## Contents

| File | What it is |
| --- | --- |
| [`VentureOS-Submission-Deck.pdf`](./VentureOS-Submission-Deck.pdf) | 10-slide submission deck (PDF, < 1 MB) |
| [`demo-script.md`](./demo-script.md) | 3-minute voiceover script + shot list for the live walkthrough video |
| [`submission-form.md`](./submission-form.md) | Ready-to-paste copy for the HackerEarth submission form |
| [`screenshots/`](./screenshots/) | Real, dated screenshots of the deployed product |

## Primary judging path

The fastest way to evaluate VentureOS end-to-end is the zero-key Demo Mode:

1. Open <https://ventureos-dun.vercel.app/>
2. Click **Try the demo**
3. Open **Faceless CRM for SMB**
4. Scroll the guided walkthrough — Personas → Buying Committee → Research
   Graph → Validation → Build Plan → Evaluation → GitHub Export

No sign-in. No API keys. No GitHub PAT. The full pipeline ships
seeded so the agent-swarm output is identical for every judge.

## Why this fits the Agent Swarms track

VentureOS is not a single chat-bot. It orchestrates a swarm of
specialized agents across the venture lifecycle:

| Step | Agent group | Output |
| --- | --- | --- |
| 01 | Idea intake | Brief, target market, constraints |
| 02 | PersonaLab | Synthetic SMB buyers, operators, finance |
| 03 | Buying Committee | Multi-persona deliberation + recommendation |
| 04 | Research Graph | Problems, evidence, competitors, contradictions |
| 05 | VentureLab | Proceed / Pivot / Kill + confidence + rationale |
| 06 | BuildSquad | PRD, architecture, roadmap, user stories, risks |
| 07 | Evaluation | Versioned readiness report with provenance |
| 08 | GitHub export | 14-file repo scaffold, BYOK PAT, classified errors |

Every agent reads and writes against one typed `Venture` object via
the `VentureJob` async primitive. Contracts-first. Provenance-aware.
BYOK provider layer (OpenAI · Anthropic · Gemini · Azure OpenAI).

## Related repository docs

- [`docs/product.md`](../product.md) — single-source product narrative (start here)
- [`docs/agent-swarms.md`](../agent-swarms.md) — Agent-Swarms-track framing
- [`docs/architecture-overview.md`](../architecture-overview.md) — engineering architecture
- [`docs/demo-mode.md`](../demo-mode.md) — how Demo Mode works
- [`docs/security-byok.md`](../security-byok.md) — BYOK + secrets posture
- [`docs/deployment.md`](../deployment.md) — how to deploy your own copy
- [`docs/known-limitations.md`](../known-limitations.md) — what's NOT shipped yet
