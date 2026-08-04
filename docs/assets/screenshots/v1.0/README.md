# Foundry — Release 1.0 Screenshot Library

Canonical captures for Release 1.0. **All images were captured from the live production
deployment** (`https://ventureos-dun.vercel.app`, deployment `dpl_DAiLACJVNLt54EGfsF6MLNJTFGBQ`)
using only **public, synthetic demo data** — no sign-in, no API keys, no real user data.

The persona → committee → research → validation → build stages are captured from the
public **Guided Demo** (`/demo/faceless-crm`), which renders the full pipeline with seeded
data and requires no authentication.

| File | Screen | Route | Viewport | Data |
|---|---|---|---|---|
| `01-landing-desktop.png` | Landing (hero + operating model) | `/` | 1440×900 | public |
| `02-landing-mobile.png` | Landing (mobile) | `/` | 390×844 | public |
| `03-navigation.png` | Primary navigation bar | `/` | 1440×— | public |
| `04-demo-index.png` | Guided Demo index | `/demo` | 1440×900 | synthetic |
| `05-demo-personas.png` | Personas | `/demo/faceless-crm#personas` | 1440×— | synthetic |
| `06-demo-committee.png` | Buying Committee | `/demo/faceless-crm#committee` | 1440×— | synthetic |
| `07-demo-research-graph.png` | Research Graph | `/demo/faceless-crm#research` | 1440×— | synthetic |
| `08-demo-validation.png` | Venture Validation (Proceed/Pivot/Kill) | `/demo/faceless-crm#validation` | 1440×— | synthetic |
| `09-demo-buildplan.png` | Build Plan | `/demo/faceless-crm#buildplan` | 1440×— | synthetic |
| `10-demo-evaluation.png` | Evaluation report | `/demo/faceless-crm#evaluation` | 1440×— | synthetic |
| `11-demo-export.png` | GitHub export (simulated) | `/demo/faceless-crm#export` | 1440×— | synthetic |
| `12-about.png` | About | `/about` | 1440×900 | public |
| `13-security.png` | Security | `/security` | 1440×900 | public |
| `14-privacy.png` | Privacy | `/privacy` | 1440×900 | public |
| `15-signin.png` | Sign-in (open-posture, neutral copy) | `/signin` | 1440×900 | public |

## Signed-in screens (not included — human-gated)

The following surfaces require an authenticated Google session, which cannot be exercised
by headless automation on production (the dev-cookie bypass is disabled when
`NODE_ENV=production`). Capture these manually after signing in — see
`../../releases/v1.0/production-smoke-test.md` for the checklist:

My Ventures · Create Venture · PersonaLab (live run) · Research Graph lab · Venture
Validation lab · Build Planning lab · Venture Workspace · BYOK provider keys (masked).
