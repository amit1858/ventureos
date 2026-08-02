# End-to-End Test Plan

This is the manual + automated test matrix for Foundry pre-submission. Run before each tagged build.

Legend: 🟢 fully automated · 🟡 partially automated · ⚪ manual.

## 1. Fresh clone setup

| # | Step | Expected | Status |
|---|---|---|---|
| 1.1 | `git clone ...` | Clone succeeds | ⚪ |
| 1.2 | `corepack pnpm install` | Installs without errors | ⚪ |
| 1.3 | `corepack pnpm run ci` | All gates green | 🟢 |
| 1.4 | `corepack pnpm --filter "@foundry/web" dev` | Server boots, no `.env.local` errors when only Demo paths are hit | ⚪ |

## 2. Demo Mode

| # | Step | Expected | Status |
|---|---|---|---|
| 2.1 | Visit `/demo` | Lists at least one demo venture, badges render | ⚪ |
| 2.2 | Visit `/demo/faceless-crm` | Banner shows "Demo Mode — seeded data"; Agent Swarms framing strip is visible | ⚪ |
| 2.3 | Scroll the walkthrough | Pipeline, coverage rings, personas, committee, research, recommendation, BuildSquad, evaluation, simulated export, timeline all render | ⚪ |
| 2.4 | Footer | "This is a seeded demo. Real Mode uses BYOK and real GitHub export." appears at bottom | ⚪ |
| 2.5 | Network panel | No requests to `api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `api.github.com` | ⚪ |
| 2.6 | Click `Switch to Real Mode (BYOK)` link | Navigates to `/settings/byok` | ⚪ |

## 3. BYOK setup

| # | Step | Expected | Status |
|---|---|---|---|
| 3.1 | Open `/settings/byok` | UI renders, no console errors | ⚪ |
| 3.2 | Add OpenAI key | Validated; shown as `••••• last4`; default flag settable | ⚪ |
| 3.3 | Add invalid key | Actionable error; key not persisted | ⚪ |
| 3.4 | Add Anthropic key | Validated; available models listed | ⚪ |
| 3.5 | Add GitHub PAT (with `repo`) | Validated; account info shown | ⚪ |
| 3.6 | Add GitHub PAT missing `repo` scope | `insufficient_scope` error names the missing scope | ⚪ |
| 3.7 | Delete a credential | Disappears from UI; subsequent runs that need it fail with a clear "missing credential" failure card | ⚪ |
| 3.8 | Server inspector | Page source contains **no** raw key values | ⚪ |

## 4. Create venture (Real Mode)

| # | Step | Expected | Status |
|---|---|---|---|
| 4.1 | `/ventures/new` | Form renders; brief, target market, constraints | ⚪ |
| 4.2 | Submit valid brief | Redirects to Workspace; Overview shows the new venture | ⚪ |
| 4.3 | Submit empty brief | Inline validation; no server round-trip | ⚪ |

## 5. PersonaLab

| # | Step | Expected | Status |
|---|---|---|---|
| 5.1 | Run PersonaLab from Workspace | Job appears with status `running`, progress, provider · model · cost | ⚪ |
| 5.2 | Completion | Personas tab shows persona cards; raw JSON hidden behind details | ⚪ |
| 5.3 | Failure injection (revoke key mid-run) | Failure card with stable code + retry guidance | ⚪ |

## 6. Buying committee

| # | Step | Expected | Status |
|---|---|---|---|
| 6.1 | Run committee deliberation | Transcript renders: initial positions, challenges, opinion changes, final consensus | ⚪ |
| 6.2 | "Why pilot, not buy" section appears when applicable | Visible | ⚪ |

## 7. Research graph

| # | Step | Expected | Status |
|---|---|---|---|
| 7.1 | Run research graph | Graph stats + god-nodes + strongest signals + contradictions render | ⚪ |
| 7.2 | Empty input | Empty state with next-best-action CTA | ⚪ |

## 8. VentureLab

| # | Step | Expected | Status |
|---|---|---|---|
| 8.1 | Run VentureLab | Recommendation card shows Proceed/Pivot/Kill + confidence; scorecard renders | ⚪ |
| 8.2 | Evidence and counter-signals | Both sections render | ⚪ |

## 9. BuildSquad

| # | Step | Expected | Status |
|---|---|---|---|
| 9.1 | Run BuildSquad | Pack renders: vision, MVP, user stories, architecture, roadmap, PRD, critiques | ⚪ |
| 9.2 | Renderer unit tests | `renderRepoScaffold` tests pass | 🟢 |

## 10. Evaluation report

| # | Step | Expected | Status |
|---|---|---|---|
| 10.1 | Generate evaluation report | Report renders in-app with readiness, recommendation, coverage, assumptions, risks, validation roadmap | ⚪ |
| 10.2 | Copy / download | Both work; content matches what export would push | ⚪ |
| 10.3 | Provenance | Model/provider metadata visible where available | ⚪ |

## 11. GitHub export

| # | Step | Expected | Status |
|---|---|---|---|
| 11.1 | Preview export | Modal shows the 14 expected files; no PAT required to preview | ⚪ |
| 11.2 | Export with valid PAT | Repo created under user's account; success card shows repo URL + short SHA + Copy / Open actions | ⚪ |
| 11.3 | Export when repo exists | `repo_exists` failure card with rename guidance | ⚪ |
| 11.4 | Export with missing scope | `insufficient_scope` failure card naming the required scopes | ⚪ |
| 11.5 | Network unreachable | `network` failure code; retryable hint | ⚪ |
| 11.6 | Workspace Overview after success | Shows GitHub export status, repo link, short SHA | ⚪ |
| 11.7 | Timeline | New "github_export_completed" event with clickable URL | ⚪ |
| 11.8 | Secret-leakage test | `GithubExportPanel` and reason-code tests pass; no `ghp_…` ever appears in exported content | 🟢 |

## 12. Server restart persistence

| # | Step | Expected | Status |
|---|---|---|---|
| 12.1 | Create venture, restart `pnpm dev` | Venture and artifacts still visible | ⚪ |
| 12.2 | BYOK credentials persist after restart | Still listed, still validated | ⚪ |

## 13. Error cases

| # | Step | Expected | Status |
|---|---|---|---|
| 13.1 | Visit non-existent venture slug | 404 with helpful link back to ventures index | ⚪ |
| 13.2 | Visit non-existent demo slug | 404 (demo dynamic route returns notFound) | ⚪ |
| 13.3 | Force `json_parse` failure | Structured failure card | ⚪ |
| 13.4 | Force `rate_limited` failure | Failure card with retry-after hint | ⚪ |

## 14. Secret safety

| # | Step | Expected | Status |
|---|---|---|---|
| 14.1 | `git ls-files` for `.env*` | No matches | ⚪ |
| 14.2 | `git log -p` for `ghp_`, `sk-`, `xoxp-`, `sk_live_` | No matches | ⚪ |
| 14.3 | View-source any page | No raw credentials | ⚪ |
| 14.4 | Network capture during BYOK validation | Outbound only to provider endpoints | ⚪ |

## 15. Agent Swarms positioning

| # | Step | Expected | Status |
|---|---|---|---|
| 15.1 | Homepage hero eyebrow | "AI-native multi-agent venture OS" visible | ⚪ |
| 15.2 | Multi-agent architecture section | 6 agent group cards present | ⚪ |
| 15.3 | Pipeline section | Step / agent role / artifact / signal table renders | ⚪ |
| 15.4 | Why Agent Swarms section | Visible with the four-cell swarm strip | ⚪ |
| 15.5 | Demo page Agent Swarms framing strip | Visible above the step nav | ⚪ |

## 16. Homepage CTAs

| # | Step | Expected | Status |
|---|---|---|---|
| 16.1 | "Try the demo →" | Navigates to `/demo/faceless-crm` | ⚪ |
| 16.2 | "Create a venture" | Navigates to `/ventures/new` | ⚪ |
| 16.3 | "Configure BYOK" | Navigates to `/settings/byok` | ⚪ |
| 16.4 | "View GitHub repo" | Opens https://github.com/amit1858/foundry in a new tab | ⚪ |
| 16.5 | "View architecture" | Scrolls to the architecture section | ⚪ |

## 17. Demo route stability

| # | Step | Expected | Status |
|---|---|---|---|
| 17.1 | Refresh demo page 10× | No hydration mismatches | ⚪ |
| 17.2 | Static generation | `generateStaticParams` enumerates all registered demo slugs | 🟡 |

## 18. Quality gates

| # | Command | Expected | Status |
|---|---|---|---|
| 18.1 | `corepack pnpm run lint` | Green | 🟢 |
| 18.2 | `corepack pnpm run lint:arch` | No violations | 🟢 |
| 18.3 | `corepack pnpm run typecheck` | Green | 🟢 |
| 18.4 | `corepack pnpm run test` | All packages green | 🟢 |
| 18.5 | `corepack pnpm run build` | All 16 packages build | 🟢 |

## How to use this document

1. Before tagging a build, walk the table top to bottom and mark each row pass/fail in a copy.
2. File issues for any 🟡/⚪ that fail; do **not** modify this table in-place — keep it as the canonical checklist.
3. When a manual row becomes automatable, promote the status icon and add the test reference in a footnote.
