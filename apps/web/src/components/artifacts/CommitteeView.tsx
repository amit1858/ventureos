import type { BuyingCommitteeTranscript, PersonaLabPersona } from '@foundry/contracts';

import { cx, POSITION_LABELS, positionClass, prob, stanceClass, styles } from './helpers';
import { Badge, DecisionBadge } from './primitives';

function nameOf(personas: PersonaLabPersona[], id: string): string {
  return personas.find((p) => p.id === id)?.name ?? id;
}

/** Renders a buying-committee transcript as deliberation phases — never raw JSON. */
export function CommitteeView({
  committee,
  personas = [],
}: {
  committee: BuyingCommitteeTranscript;
  personas?: PersonaLabPersona[];
}) {
  const d = committee.deliberation;
  return (
    <div className={cx(styles.stack)}>
      <div className={cx(styles.card)}>
        <p className={cx(styles.cardTitle)}>Offer under evaluation</p>
        <p className={cx(styles.docText)}>{committee.offerSummary}</p>
        <div className={cx(styles.chipRow)} style={{ marginTop: '0.7rem' }}>
          <DecisionBadge decision={committee.decision} />
          {d ? <span className={cx(styles.chip)}>Consensus: {d.consensusLevel}</span> : null}
          {d ? <span className={cx(styles.chip)}>Confidence: {prob(d.confidenceScore)}</span> : null}
        </div>
      </div>

      <div className={cx(styles.card)}>
        <p className={cx(styles.cardTitle)}>Members</p>
        <div className={cx(styles.tableWrap)}>
          <table className={cx(styles.table)}>
            <thead>
              <tr><th>Persona</th><th>Committee role</th><th>Stance</th><th>Rationale</th></tr>
            </thead>
            <tbody>
              {committee.members.map((m) => (
                <tr key={m.personaId}>
                  <td>{nameOf(personas, m.personaId)}</td>
                  <td>{m.committeeRole}</td>
                  <td><Badge className={stanceClass(m.stance)}>{m.stance}</Badge></td>
                  <td>{m.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {d ? (
        <>
          <div className={cx(styles.grid2)}>
            <div className={cx(styles.card)}>
              <p className={cx(styles.cardTitle)}>Initial positions</p>
              <div className={cx(styles.timeline)}>
                {d.phases.initialPositions.map((o) => (
                  <div key={o.personaId} className={cx(styles.turn)}>
                    <div className={cx(styles.turnHead)}>
                      <span className={cx(styles.turnRole)}>{nameOf(personas, o.personaId)}</span>
                      <Badge className={positionClass(o.position)}>{POSITION_LABELS[o.position]}</Badge>
                      <span className={cx(styles.turnMeta)}>enthusiasm {prob(o.enthusiasm)}</span>
                    </div>
                    <p className={cx(styles.turnText)}>{o.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={cx(styles.card)}>
              <p className={cx(styles.cardTitle)}>Final consensus</p>
              <div className={cx(styles.timeline)}>
                {d.phases.consensus.map((o) => (
                  <div key={o.personaId} className={cx(styles.turn)}>
                    <div className={cx(styles.turnHead)}>
                      <span className={cx(styles.turnRole)}>{nameOf(personas, o.personaId)}</span>
                      <Badge className={positionClass(o.position)}>{POSITION_LABELS[o.position]}</Badge>
                      <span className={cx(styles.turnMeta)}>enthusiasm {prob(o.enthusiasm)}</span>
                    </div>
                    <p className={cx(styles.turnText)}>{o.willingnessToAdopt}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={cx(styles.card)}>
            <p className={cx(styles.cardTitle)}>Challenges &amp; responses</p>
            <div className={cx(styles.timeline)}>
              {d.phases.challenges.map((c, i) => {
                const resp = d.phases.responses.find((rr) => rr.challengeIndex === i);
                return (
                  <div key={i} className={cx(styles.turn)}>
                    <div className={cx(styles.turnHead)}>
                      <span className={cx(styles.turnRole)}>{nameOf(personas, c.fromPersonaId)}</span>
                      <span className={cx(styles.changeArrow)}>→</span>
                      <span className={cx(styles.turnRole)}>{nameOf(personas, c.toPersonaId)}</span>
                      <span className={cx(styles.chip)}>{c.topic}</span>
                    </div>
                    <p className={cx(styles.turnText)}>{c.argument}</p>
                    {resp ? (
                      <p className={cx(styles.turnMeta)}>
                        ↳ <strong>{nameOf(personas, resp.fromPersonaId)}</strong>: {resp.argument}
                        {resp.changedOpinion ? ' (changed position)' : ''}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {d.opinionChanges.length > 0 ? (
            <div className={cx(styles.card)}>
              <p className={cx(styles.cardTitle)}>Opinion changes</p>
              {d.opinionChanges.map((c, i) => (
                <div key={i} className={cx(styles.changeRow)}>
                  <strong>{nameOf(personas, c.personaId)}</strong>
                  <Badge className={positionClass(c.fromPosition)}>{POSITION_LABELS[c.fromPosition]}</Badge>
                  <span className={cx(styles.changeArrow)}>→</span>
                  <Badge className={positionClass(c.toPosition)}>{POSITION_LABELS[c.toPosition]}</Badge>
                  <span>{c.reason}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className={cx(styles.consensus)}>
            <p className={cx(styles.cardTitle)}>Decision rationale</p>
            <p className={cx(styles.docText)}>{committee.decisionRationale}</p>
            <div className={cx(styles.grid2)} style={{ marginTop: '0.8rem' }}>
              <div>
                <p className={cx(styles.miniLabel)}>Strongest supporting</p>
                <ul className={cx(styles.bullets)}>
                  {d.strongestSupportingArguments.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
              <div>
                <p className={cx(styles.miniLabel)}>Strongest opposing</p>
                <ul className={cx(styles.bullets)}>
                  {d.strongestOpposingArguments.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            </div>
            {d.unresolvedObjections.length > 0 ? (
              <>
                <p className={cx(styles.miniLabel)} style={{ marginTop: '0.8rem' }}>Unresolved objections</p>
                <ul className={cx(styles.bullets)}>
                  {d.unresolvedObjections.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </>
            ) : null}
          </div>
        </>
      ) : (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Next steps</p>
          <ul className={cx(styles.bullets)}>
            {committee.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
