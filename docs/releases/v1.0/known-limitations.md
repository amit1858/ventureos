# Foundry Release 1.0 — Known Limitations

These are the honest, documented limitations of Release 1.0. None is a functional defect; each is either a scope decision or a deferred enhancement.

| # | Limitation | Impact | Planned resolution |
|---|---|---|---|
| 1 | No global cross-venture Usage Intelligence dashboard | Usage/cost telemetry is captured and visible per run, but there is no single aggregate dashboard across all ventures | Release 1.1 |
| 2 | Buying committee calls are sequential | Multi-persona deliberation can be slow for large committees | Release 1.1 (parallelization) |
| 3 | Gemini and Azure OpenAI are not live-validated | Adapters exist and are covered by unit tests, but no end-to-end live run was performed | Release 1.1 (live validation) |
| 4 | Advanced implementation workspaces retain utilitarian styling | Some secondary/advanced screens are less polished than the primary journey | Incremental |
| 5 | No external durable job queue | In-flight long-running jobs may not survive a process interruption or redeploy | Release 1.1 (durable queue) |
| 6 | Vercel/project URL rename is separate from this release | Production remains at `ventureos-dun.vercel.app` even though the product is Foundry | Operational follow-up |
| 7 | Historical VentureOS artifacts remain archived | The original submission deck/screenshots are intentionally preserved unchanged under `docs/archive/` | Intentional |

## Explicitly NOT limitations

- The former developer-facing JSON hand-off screens (manual paste of personas/committee/recommendation/graph JSON, Venture ID text fields) have been **removed**. Research Graph, Venture Validation, and Build Planning now auto-discover the selected venture's artifacts. This is fixed behavior, not a limitation.
