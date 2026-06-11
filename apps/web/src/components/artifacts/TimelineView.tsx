import type { VentureTimelineEvent } from '@ventureos/contracts';

import { cx, EVENT_LABELS, fmtCostCents, fmtDuration, fmtTime, styles } from './helpers';

function metricsLine(e: VentureTimelineEvent): string {
  const m = e.metrics;
  if (!m) return '';
  const bits: string[] = [];
  if (m.providerName && m.providerModel) bits.push(`${m.providerName} · ${m.providerModel}`);
  if (m.executionDurationMs != null) bits.push(fmtDuration(m.executionDurationMs));
  if (m.estimatedCostCents != null) bits.push(fmtCostCents(m.estimatedCostCents));
  return bits.join('  ·  ');
}

/** Chronological venture story — newest first. */
export function TimelineView({ events }: { events: VentureTimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className={cx(styles.timeline)}>
      {sorted.map((e) => {
        const metrics = metricsLine(e);
        const failed = e.eventKind === 'job_failed';
        return (
          <div key={e.eventId} className={cx(styles.turn)}>
            <div className={cx(styles.turnHead)}>
              <span className={cx(styles.turnRole)}>{e.label}</span>
              <span className={cx(styles.badge, failed ? styles.failed : styles.neutral)}>{EVENT_LABELS[e.eventKind]}</span>
              <span className={cx(styles.turnMeta)}>{fmtTime(e.at)}</span>
            </div>
            {metrics ? <p className={cx(styles.turnMeta)}>{metrics}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
