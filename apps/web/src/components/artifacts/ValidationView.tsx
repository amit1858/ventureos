import type { VentureRecommendation } from '@ventureos/contracts';

import { cx, DIMENSION_LABELS, prob, riskClass, scoreColor, styles } from './helpers';
import { Badge, DecisionBadge } from './primitives';

/** Renders a VentureLab recommendation as a readable validation report. */
export function ValidationView({ recommendation }: { recommendation: VentureRecommendation }) {
  const r = recommendation;
  return (
    <div className={cx(styles.stack)}>
      <div className={cx(styles.card)}>
        <div className={cx(styles.copyRow)}>
          <DecisionBadge decision={r.decision} />
          <span className={cx(styles.barVal)}>
            Score {r.overallScore}/100 · Confidence {prob(r.confidenceScore)}
          </span>
        </div>
        <p className={cx(styles.docText)} style={{ marginTop: '0.6rem' }}>{r.executiveSummary}</p>
        {r.decisionRationale.length > 0 ? (
          <>
            <p className={cx(styles.miniLabel)} style={{ marginTop: '0.8rem' }}>Why this decision</p>
            <ul className={cx(styles.bullets)}>
              {r.decisionRationale.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </>
        ) : null}
      </div>

      <div className={cx(styles.card)}>
        <p className={cx(styles.cardTitle)}>Scorecard</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {r.scores.map((s) => (
            <div key={s.dimension} className={cx(styles.bar)}>
              <div className={cx(styles.barHead)}>
                <span className={cx(styles.barLabel)}>
                  {DIMENSION_LABELS[s.dimension]}
                  {!s.higherIsBetter ? <span className={cx(styles.chip)} style={{ marginLeft: '0.4rem' }}>lower is better</span> : null}
                </span>
                <span className={cx(styles.barVal)}>{s.score}/100</span>
              </div>
              <div className={cx(styles.barTrack)}>
                <div className={cx(styles.barFill, scoreColor(s.score, s.higherIsBetter))} style={{ width: `${s.score}%` }} />
              </div>
              <span className={cx(styles.statSub)}>{s.explanation}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={cx(styles.grid2)}>
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Supporting evidence</p>
          <ul className={cx(styles.bullets)}>
            {r.evidence.map((e, i) => (
              <li key={i}>“{e.quote}” <span className={cx(styles.statSub)}>— {e.source}</span></li>
            ))}
          </ul>
        </div>
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Counter-signals</p>
          {r.counterSignals.length > 0 ? (
            <ul className={cx(styles.bullets)}>
              {r.counterSignals.map((e, i) => (
                <li key={i}>“{e.quote}” <span className={cx(styles.statSub)}>— {e.source}</span></li>
              ))}
            </ul>
          ) : <p className={cx(styles.muted)}>No counter-signals recorded.</p>}
        </div>
      </div>

      <div className={cx(styles.card)}>
        <p className={cx(styles.cardTitle)}>Key assumptions</p>
        <div className={cx(styles.tableWrap)}>
          <table className={cx(styles.table)}>
            <thead><tr><th>Assumption</th><th>Type</th><th>Risk</th><th>How we validate</th></tr></thead>
            <tbody>
              {r.assumptions.map((a) => (
                <tr key={a.id}>
                  <td>{a.text}</td>
                  <td className={cx(styles.mono)}>{a.type}</td>
                  <td><Badge className={riskClass(a.riskLevel)}>{a.riskLevel}</Badge></td>
                  <td>{a.validationStrategy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cx(styles.card)}>
        <p className={cx(styles.cardTitle)}>Risks</p>
        <div className={cx(styles.tableWrap)}>
          <table className={cx(styles.table)}>
            <thead><tr><th>Risk</th><th>Impact</th><th>Likelihood</th><th>Mitigation</th></tr></thead>
            <tbody>
              {r.risks.map((rk) => (
                <tr key={rk.id}>
                  <td>{rk.risk}</td>
                  <td><Badge className={riskClass(rk.impact)}>{rk.impact}</Badge></td>
                  <td><Badge className={riskClass(rk.likelihood)}>{rk.likelihood}</Badge></td>
                  <td>{rk.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cx(styles.card)}>
        <p className={cx(styles.cardTitle)}>Validation roadmap</p>
        <div className={cx(styles.timeline)}>
          {r.nextSteps.map((n) => (
            <div key={n.id} className={cx(styles.turn)}>
              <div className={cx(styles.turnHead)}>
                <span className={cx(styles.storyId)}>P{n.priority}</span>
                <span className={cx(styles.turnRole)}>{n.title}</span>
                {n.blocksDecision ? <Badge className={styles.pivot}>blocks decision</Badge> : null}
                <span className={cx(styles.chip)}>{n.category}</span>
                <span className={cx(styles.chip)}>effort: {n.effort}</span>
              </div>
              <p className={cx(styles.turnMeta)}>{n.rationale}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
