import type { PersonaLabPersona } from '@ventureos/contracts';

import { cx, prob, styles } from './helpers';
import { ScoreRing } from './primitives';

/** Renders persona artifacts as readable cards — never raw JSON. */
export function PersonaCards({ personas }: { personas: PersonaLabPersona[] }) {
  return (
    <div className={cx(styles.personaGrid)}>
      {personas.map((p) => (
        <article key={p.id} className={cx(styles.personaCard)}>
          <div className={cx(styles.personaTop)}>
            <div>
              <h3 className={cx(styles.personaName)}>{p.name}</h3>
              <span className={cx(styles.personaRole)}>{p.role}</span>
            </div>
            <ScoreRing value={p.confidenceScore * 100} size={48} />
          </div>
          {p.businessContext ? <p className={cx(styles.personaCtx)}>{p.businessContext}</p> : null}
          {p.quote ? <blockquote className={cx(styles.personaQuote)}>“{p.quote}”</blockquote> : null}
          <div className={cx(styles.grid2)}>
            <div>
              <p className={cx(styles.miniLabel)}>Goals</p>
              <ul className={cx(styles.bullets)}>{p.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
            <div>
              <p className={cx(styles.miniLabel)}>Pain points</p>
              <ul className={cx(styles.bullets)}>{p.painPoints.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          </div>
          <div className={cx(styles.grid2)}>
            <div>
              <p className={cx(styles.miniLabel)}>Objections</p>
              <ul className={cx(styles.bullets)}>{p.objections.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
            <div>
              <p className={cx(styles.miniLabel)}>Buying triggers</p>
              <ul className={cx(styles.bullets)}>{p.buyingTriggers.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          </div>
          <div className={cx(styles.chipRow)}>
            <span className={cx(styles.chip)}>Decision power: {p.decisionPower}</span>
            <span className={cx(styles.chip)}>Confidence: {prob(p.confidenceScore)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
