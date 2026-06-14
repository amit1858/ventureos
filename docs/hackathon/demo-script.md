# Demo video script — 3 minutes

> **Total runtime:** 3:00 (180 seconds, hard cap)
> **Format:** screen capture of live deployment at <https://ventureos-dun.vercel.app>
> **Voiceover:** calm, paced, ~150 wpm. Use the teleprompter version below.
> **Resolution:** 1280×720 minimum; 1920×1080 recommended.
> **Browser:** Chrome / Edge, dark mode preferred (matches the app's theme).
> **Mic:** any USB headset is fine — just be in a quiet room.
>
> Submit either as **MP4** or as an **unlisted YouTube link**.

---

## Recommended judge path

Live app: <https://ventureos-dun.vercel.app/>

Direct demo: <https://ventureos-dun.vercel.app/demo/faceless-crm>

Use the zero-key demo first. It requires no sign-in, no provider keys
and no GitHub PAT — every artifact is seeded and the same for every
judge. Real Mode is optional for deeper testing through Google sign-in
or the Alpha Workspace plus BYOK.

---

## Pre-roll setup (do this once before recording)

1. Open Chrome / Edge in an incognito window at 1280×720 or 1920×1080.
2. Visit <https://ventureos-dun.vercel.app> once to warm the CDN.
3. Close all other tabs. Hide the bookmarks bar (Ctrl+Shift+B).
4. Quit Slack / Teams / mail notifications.
5. Open OBS, QuickTime, or Loom. Set capture region to the browser
   viewport (no OS chrome).
6. Do **one** dry run silently to feel the scroll pace.

---

## Teleprompter — paced for 3:00

> The bracketed cues are visual actions. Everything outside the
> brackets is what you say.

---

### 0:00 – 0:20 · Problem  (20s)

> **[Cue: open `https://ventureos-dun.vercel.app/` with the homepage hero visible.]**

> "Most teams start *building* before they know whether an idea is
> *worth* building.
>
> They burn weeks of engineering on something synthetic personas could
> have invalidated in an afternoon.
>
> VentureOS solves this by giving every idea its own multi-agent
> validation and planning system — before a single line of code ships."

---

### 0:20 – 0:45 · Homepage + positioning  (25s)

> **[Cue: stay on the homepage. Slowly scroll past the hero, past the
> pipeline strip — the 8 numbered cards from Idea Intake to GitHub Export.]**

> "VentureOS is an AI-native, *multi-agent* venture operating system.
>
> It uses persona agents, a buying-committee agent, research-graph
> agents, a venture-validation agent, BuildSquad planning agents and
> an evaluation agent.
>
> Each one has a job. Each one produces a typed, versioned artifact
> the next agent reads."

---

### 0:45 – 1:15 · Demo scenario  (30s)

> **[Cue: click 'Try the demo'. From `/demo`, click 'Faceless CRM for SMB'.
> Land on `/demo/faceless-crm`. Hold on the readiness ring `97 / 100`
> and the 6-stage progress.]**

> "Here's the demo. *Faceless CRM for SMB* — a small-business CRM
> idea, pressure-tested end-to-end.
>
> No sign-in, no API keys, no GitHub token. The full agent swarm
> output is seeded so anyone can walk it.
>
> Readiness score is 97 out of 100. Confidence 82 percent. Decision:
> *Proceed*. Let's see why."

---

### 1:15 – 1:45 · Persona swarm + buying committee  (30s)

> **[Cue: scroll down to STEP 2 — '5 synthetic personas'. Hover over
> Maya, Diego, Priya, Sam, Nadia. Then scroll to STEP 3 — 'Agentic
> deliberation'. Show the deliberation transcript with SUPPORT /
> CHAMPION / BLOCKER / SKEPTIC tags.]**

> "PersonaLab generates five synthetic SMB buyers — a champion, an
> economic buyer, a privacy blocker, an influencer and a workflow lead.
>
> The Buying Committee then runs *agentic deliberation*: the personas
> debate, challenge each other's assumptions, and converge on a
> recommendation. Every claim is provenance-tagged."

---

### 1:45 – 2:10 · Evidence and validation  (25s)

> **[Cue: scroll to STEP 5 — 'Research graph'. Pan the graph nodes.
> Then scroll to STEP 6 — 'Validation and recommendation'. Show the
> Proceed badge and the rationale.]**

> "The Research Graph structures every claim. Problems, evidence,
> competitors, contradictions — all mapped, all auditable.
>
> VentureLab takes the graph plus the committee output, scores the
> opportunity, and recommends *Proceed*, *Pivot* or *Kill* with full
> rationale. Not a verdict from a black box — an evaluation you can
> challenge."

---

### 2:10 – 2:40 · BuildSquad + Evaluation Report  (30s)

> **[Cue: scroll to STEP 6 — 'Build plan'. Show the architecture +
> roadmap + stories cards. Then scroll to STEP 7 — 'Evaluation report'.
> Land on the `EVALUATION_REPORT.md` panel with readiness, confidence,
> rationale.]**

> "Once a venture is validated, BuildSquad converts validation into
> execution: PRD, architecture, roadmap, user stories, risks.
>
> The Evaluation Report is a *first-class artifact*. Readiness score,
> evidence coverage, validation confidence, the rationale behind the
> Proceed decision — one auditable document, rendered by the real
> renderer, not a slide."

---

### 2:40 – 3:00 · GitHub export + close  (20s)

> **[Cue: scroll to STEP 8 — 'GitHub export (simulated)'. Show the
> 14-file repo scaffold list and the simulated PR URL.]**

> "Finally, VentureOS exports the whole venture into a GitHub-ready
> repository — README, VISION, PRD, ARCHITECTURE, ROADMAP, user
> stories, evaluation report, fourteen files in total.
>
> The whole pipeline is BYOK. Provider keys stay on the server,
> encrypted, never logged.
>
> VentureOS gives every idea an agent swarm — so teams can decide
> what to build, *before* they build it."

> **[Cue: end on the GitHub export panel or fade out to the homepage.]**

---

## Compressed cue sheet (printable)

| Time | URL / Action | What you say (1-line cue) |
|---|---|---|
| 0:00 | `/`  homepage hero visible | Teams build before they validate. VentureOS fixes that. |
| 0:20 | `/`  scroll past pipeline strip | Multi-agent OS. Each agent has a job. Each produces an artifact. |
| 0:45 | Click *Try the demo* → *Faceless CRM* | Zero-key demo. Readiness 97, decision Proceed. Let's see why. |
| 1:15 | Scroll to *Personas* + *Buying Committee* | 5 synthetic buyers. Agentic deliberation. Provenance-tagged. |
| 1:45 | Scroll to *Research Graph* + *Validation* | Evidence mapped. Proceed / Pivot / Kill with full rationale. |
| 2:10 | Scroll to *Build Plan* + *Evaluation Report* | PRD + architecture + roadmap. Evaluation is a first-class artifact. |
| 2:40 | Scroll to *GitHub export* | 14-file scaffold. BYOK. Decide what to build, before you build it. |
| 3:00 | End | (cut) |

---

## Fallback plans (read before recording)

| If this happens | Do this |
|---|---|
| The live URL is slow on demo day | Reload once; the CDN warms in <5s. If still slow, capture screenshots beforehand and narrate over them. |
| You stumble on a section | Cut, re-record from the previous cue. Don't try to recover live. |
| The demo content changes | The demo is seeded — content is stable. If you see different copy, hard-refresh (Ctrl+Shift+R). |
| You go over 3:00 | Trim the *Buying Committee* narration to 20s. It is the most compressible block. |

---

## Voiceover tips

- **Pause** for half a second after each cue change. The judge needs to
  see the screen, *then* hear the line. Talking over a transition is
  the most common amateur mistake.
- **Slow down** on numbers. "Ninety-seven out of one hundred" reads
  more confident than "ninety-seven-out-of-one-hundred."
- **Don't say "as you can see"**. Trust the visual.
- **Smile while you talk**. It changes your tone even if no one sees it.

---

## After you record

1. Trim head and tail silence (>0.5s on each end).
2. Apply a light noise-reduction filter if your room had air-con.
3. Export as **MP4 (H.264, 1080p, 30fps)** at 8–10 Mbps. The whole file
   should be under 100 MB.
4. Upload to YouTube as **unlisted**. Title the video
   `VentureOS — Microsoft Build AI / HackerEarth — Agent Swarms`.
5. Paste both the YouTube URL and the MP4 download link into the
   HackerEarth submission form video field.
