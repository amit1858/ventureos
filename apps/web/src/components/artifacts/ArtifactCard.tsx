import type { VentureArtifact, VentureTimelineEvent } from '@foundry/contracts';

import { ARTIFACT_LABEL, cx, fmtCostCents, fmtDuration, fmtTime, styles } from './helpers';
import { RawJson } from './primitives';
import { DownloadButton } from './DownloadButton';

interface Provenance {
  jobId?: string;
  provider?: string;
  model?: string;
  durationMs?: number;
  costCents?: number;
}

function provenanceFor(artifact: VentureArtifact, events: VentureTimelineEvent[]): Provenance {
  const match = events.find((e) => e.artifactId === artifact.artifactId && e.metrics) ??
    events.find((e) => e.artifactId === artifact.artifactId);
  if (!match) return {};
  const m = match.metrics;
  const prov: Provenance = {};
  if (match.jobId) prov.jobId = match.jobId;
  if (m?.providerName) prov.provider = m.providerName;
  if (m?.providerModel) prov.model = m.providerModel;
  if (m?.executionDurationMs != null) prov.durationMs = m.executionDurationMs;
  if (m?.estimatedCostCents != null) prov.costCents = m.estimatedCostCents;
  return prov;
}

export function ArtifactCard({
  artifact,
  events = [],
}: {
  artifact: VentureArtifact;
  events?: VentureTimelineEvent[];
}) {
  const p = provenanceFor(artifact, events);
  const filename = `${artifact.artifactKind}-v${artifact.version}-${artifact.artifactId}.json`;
  return (
    <article className={cx(styles.artifactCard)}>
      <div className={cx(styles.artifactHead)}>
        <h3 className={cx(styles.artifactKind)}>{ARTIFACT_LABEL[artifact.artifactKind]}</h3>
        <span className={cx(styles.artifactVer)}>v{artifact.version}</span>
      </div>
      {artifact.summary ? <p className={cx(styles.artifactSummary)}>{artifact.summary}</p> : null}
      <div className={cx(styles.artifactMeta)}>
        <span><strong>Created</strong> {fmtTime(artifact.createdAt)}</span>
        {p.jobId ? <span><strong>Job</strong> {p.jobId.slice(0, 10)}</span> : null}
        {p.provider && p.model ? <span><strong>Model</strong> {p.provider} · {p.model}</span> : null}
        {p.durationMs != null ? <span><strong>Duration</strong> {fmtDuration(p.durationMs)}</span> : null}
        {p.costCents != null ? <span><strong>Cost</strong> {fmtCostCents(p.costCents)}</span> : null}
      </div>
      <div className={cx(styles.artifactActions)}>
        <DownloadButton filename={filename} content={JSON.stringify(artifact, null, 2)} mime="application/json" label="Download JSON" />
      </div>
      <RawJson data={artifact.payload} />
    </article>
  );
}

/** Grid of artifact cards, newest first. Raw JSON lives behind a disclosure per card. */
export function ArtifactsView({
  artifacts,
  events = [],
}: {
  artifacts: VentureArtifact[];
  events?: VentureTimelineEvent[];
}) {
  const sorted = [...artifacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className={cx(styles.artifactGrid)}>
      {sorted.map((a) => <ArtifactCard key={a.artifactId} artifact={a} events={events} />)}
    </div>
  );
}
