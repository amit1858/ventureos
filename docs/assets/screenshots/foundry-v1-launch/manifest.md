# Foundry 1.0 — Launch Screenshot Library

**Source:** Production only — `https://ventureos-dun.vercel.app`
**Deployment:** `dpl_258x9SjRM9X4uG2o5vF59hF5UbPh` (merged `main`, PR #14 → `290f2e1`)
**Captured:** 2026-08-05
**Viewports:** Desktop 1440×900 · Mobile 390×844 · retina `deviceScaleFactor: 2`
**Design system:** Foundry violet (`--accent` unified) · dark theme
**Data:** 100% synthetic — the seeded *Faceless CRM for SMB* Demo-Mode venture + marketing copy. No real user, venture, email, key, or internal ID appears in any frame.
**Chrome:** None. Playwright renders the page only (no address bar, tabs, or OS chrome). Sticky headers were flattened to `static` before full-section captures so no nav bar floats mid-image.

> **Why Demo Mode is the source.** Production authentication is Google OAuth only; the alpha-workspace path is disabled on this deployment (`POST /api/access/alpha` → `503`). Rather than expose a real signed-in user's data, the canonical library is captured from Foundry's own **synthetic** surfaces — the marketing site and the fully-seeded Guided Demo (`/demo/faceless-crm`), which renders the identical component tree the authenticated workspace uses. Three screens that only exist behind auth are documented as gaps below.

---

## Inventory

| # | File | Screen | Route | Dimensions (px) | Source | Purpose | Synthetic? | Redaction |
|---|------|--------|-------|-----------------|--------|---------|-----------|-----------|
| 1 | `01-landing-hero.png` | Landing hero | `/` | 2880×1800 | Marketing | Product promise + operating-model chips + primary CTA | ✅ | none needed |
| 2 | `02-operating-model.png` | Operating model | `/` | 2880×1800 | Marketing | Discover → Evaluate → Govern → Learn model cards | ✅ | none needed |
| 3 | `03-my-ventures-portfolio.png` | My Ventures (portfolio proxy) | `/demo` | 2880×1800 | Demo index | Venture card w/ readiness ring + PROCEED badge + coverage chips | ✅ | none needed |
| 3b | `03b-my-ventures-gate.png` | My Ventures (auth gate) | `/ventures` | 2880×1800 | Auth gate | Polished signed-out gate for the portfolio | ✅ | none needed |
| 4 | `04-venture-workspace-overview.png` | Venture workspace overview | `/demo/faceless-crm` `#overview` | 1984×1090 | Guided demo | Readiness 97, PROCEED, confidence, 6-step pipeline, coverage, next action | ✅ | none needed |
| 5 | `05-persona-cards.png` | Persona cards | `…#personas` | 1984×3038 | Guided demo | 5 synthetic personas: goals, pains, objections, confidence rings | ✅ | none needed |
| 6 | *(gap)* | Focus Group | — | — | — | Not present in Demo Mode; authenticated Persona Lab only | — | see gaps |
| 7 | `07-buying-committee.png` | Buying Committee | `…#committee` | 1984×4308 | Guided demo | Multi-stakeholder deliberation → consensus decision | ✅ | none needed |
| 8 | `08-research-graph.png` | Research Graph | `…#research` | 1984×1414 | Guided demo | 13 nodes / 15 edges, key concepts, strongest signals, contradictions | ✅ | none needed |
| 9 | `09-validation-recommendation.png` | Validation recommendation | `…#validation` | 1984×4640 | Guided demo | PROCEED, 8-dimension scorecard, evidence, assumptions, risks, roadmap | ✅ | none needed |
| 10 | `10-build-plan.png` | Build Plan | `…#buildplan` | 1984×6862 | Guided demo | PRD, architecture, roadmap, user stories, milestones | ✅ | none needed |
| 11 | `11-evaluation-report.png` | Evaluation report | `…#evaluation` | 1984×1472 | Guided demo | `EVALUATION_REPORT.md` w/ metrics + Copy-markdown | ✅ | none needed |
| 12 | `12-timeline.png` | Timeline | `…#timeline` | 1984×1742 | Guided demo | Auditable, time-stamped venture event log | ✅ | none needed |
| 13 | `13-artifact-library.png` | Artifact library (GitHub export) | `…#export` | 1984×1088 | Guided demo | Generated repo files + byte sizes + BYOK-safety note | ✅ | none needed |
| 14 | `14-provider-keys-gate.png` | Provider Keys (auth gate) | `/settings/byok` | 2880×1800 | Auth gate | BYOK AES-256-GCM security model + "masked preview only" copy + empty state | ✅ | none needed |
| 15 | `15-guided-demo.png` | Guided Demo | `/demo/faceless-crm` | 2880×1800 | Guided demo | Walkthrough entry (Demo-Mode banner + venture header) | ✅ | none needed |
| 16 | `16-mobile-landing.png` | Mobile landing | `/` | 780×1688 | Marketing | Responsive hero, hamburger nav, wrapped chips | ✅ | none needed |
| 17 | `17-mobile-workspace.png` | Mobile workspace (synthetic) | `/demo/faceless-crm` `#overview` | 780×1688 | Guided demo | Responsive workspace overview + readiness ring | ✅ | none needed |
| — | `_contact-sheet.png` | Contact sheet | — | 2200-wide | Composite | All frames in one grid for review | ✅ | none needed |

---

## Authenticated-only screens (not synthetically reachable in production)

These three require a signed-in Supabase session and therefore cannot be captured from a synthetic production surface without either (a) exposing a real user's data, or (b) enabling the alpha workspace + running a live BYOK pipeline. They are **not** included as production captures; the closest synthetic proxy is noted.

| Runbook screen | Why it's a gap | Proxy included |
|----------------|----------------|----------------|
| **6 — Focus Group** | No Focus Group section exists in Demo Mode; it lives only in the authenticated Persona Lab. | `07-buying-committee.png` (closest multi-persona deliberation) |
| **14 — Provider Keys, masked credential** | The masked-credential row requires a stored BYOK credential (authenticated). | `14-provider-keys-gate.png` (security model + empty state) |
| **3 — My Ventures, populated portfolio** | A populated portfolio requires an authenticated session with real ventures. | `03-my-ventures-portfolio.png` (demo card) + `03b-my-ventures-gate.png` (gate) |

**To close these three** (owner's choice, none required for the current package):
1. Temporarily set `VENTUREOS_ALPHA_ACCESS=true` on the production Vercel project + redeploy. I can then drive an **isolated synthetic `alpha@foundry.local` workspace** end-to-end (BYOK + full pipeline) and capture Focus Group, a masked Provider Keys row, and a populated My Ventures — all synthetic — then the flag is reverted. *(This is a production-config change during the engineering freeze, so it's owner-gated.)*
2. Or capture those three yourself from your authenticated session, cropping out the account email/avatar.

---

## Redaction report

- **Emails:** none present. Seeded demo data scanned — 0 email-like strings. Auth gates show no account.
- **API keys / secrets:** none. Provider Keys screen is the signed-out state (no credential); demo data scanned — 0 secret-like tokens.
- **Internal IDs:** none in-frame. Vercel deployment/project/org IDs live only in release docs, never on a captured screen.
- **Real user data:** none. All content is the fictional *Faceless CRM for SMB* venture.
- **Note — persona name "Sam Whitfield" (`05-persona-cards.png`):** a fictional seeded persona ("Fractional VP Sales"), unrelated to any real person; it ships in the public demo.
- **Note — domain string `ventureos`:** the production domain is still `ventureos-dun.vercel.app`. It never appears in-frame (no browser chrome captured). Only relevant if the owner later renames the Vercel domain to a Foundry alias for share links.

---

## Reproducibility

Captured with `review-harness/launch-shots.mjs` (Playwright, Chromium) against production. Full per-shot metadata: `_capture.json`. Contact sheet: `_contact-sheet.png` (built by `contact-sheet.mjs`). Re-running overwrites this folder only; prior evidence in `docs/assets/screenshots/v1.0/` is untouched.
