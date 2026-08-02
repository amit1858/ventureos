import type { EvaluationReport } from '@foundry/contracts';

import { cx, pct, prob, styles } from './helpers';
import { Stat } from './primitives';
import { MarkdownPreview } from './MarkdownPreview';
import { CopyButton } from './CopyButton';
import { DownloadButton } from './DownloadButton';

/** Renders the EvaluationReport artifact as a markdown preview with copy/download. */
export function EvaluationView({ report, markdown }: { report: EvaluationReport; markdown: string }) {
  const r = report;
  return (
    <div className={cx(styles.stack)}>
      <div className={cx(styles.grid4)}>
        <Stat value={`${r.readinessScore.overall}`} label="Readiness" sub="/ 100" />
        <Stat value={r.recommendation.confidence != null ? prob(r.recommendation.confidence) : '—'} label="Confidence" />
        <Stat value={pct(r.coverage.research.score * 100)} label="Research coverage" />
        <Stat value={pct(r.coverage.risk.score * 100)} label="Risk coverage" />
      </div>

      <div className={cx(styles.card)}>
        <div className={cx(styles.copyRow)}>
          <p className={cx(styles.cardTitle)} style={{ margin: 0 }}>EVALUATION_REPORT.md</p>
          <span style={{ display: 'flex', gap: '0.4rem' }}>
            <CopyButton text={markdown} label="Copy markdown" />
            <DownloadButton filename="EVALUATION_REPORT.md" content={markdown} mime="text/markdown" />
          </span>
        </div>
        <MarkdownPreview markdown={markdown} />
      </div>
    </div>
  );
}
