import { renderPack } from '@ventureos/buildsquad';
import type { BuildSquadArtifactPack } from '@ventureos/contracts';

import { cx, styles } from './helpers';
import { Badge } from './primitives';
import { CopyButton } from './CopyButton';
import { DownloadButton } from './DownloadButton';

/** Renders a BuildSquad pack as readable product artifacts — never raw JSON. */
export function BuildPlanView({ pack }: { pack: BuildSquadArtifactPack }) {
  const v = pack.productVision;
  const files = renderPack(pack);
  return (
    <div className={cx(styles.stack)}>
      <div className={cx(styles.card)}>
        <div className={cx(styles.copyRow)}>
          <p className={cx(styles.cardTitle)} style={{ margin: 0 }}>Product vision</p>
          <Badge className={styles.neutral}>mode: {pack.mode}</Badge>
        </div>
        <p className={cx(styles.docText)}><strong>{v.productPromise}</strong></p>
        {v.problem ? <p className={cx(styles.docText)} style={{ marginTop: '0.5rem' }}>{v.problem}</p> : null}
        {v.whyNow ? <p className={cx(styles.docText)} style={{ marginTop: '0.5rem' }}><span className={cx(styles.muted)}>Why now:</span> {v.whyNow}</p> : null}
        <div className={cx(styles.grid2)} style={{ marginTop: '0.8rem' }}>
          <div>
            <p className={cx(styles.miniLabel)}>Differentiation</p>
            <ul className={cx(styles.bullets)}>{v.differentiation.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
          <div>
            <p className={cx(styles.miniLabel)}>Success metrics</p>
            <ul className={cx(styles.bullets)}>{v.successMetrics.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        </div>
      </div>

      {pack.pivot ? (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Pivot brief</p>
          <p className={cx(styles.docText)}>{pack.pivot.pivotBrief}</p>
          <p className={cx(styles.miniLabel)} style={{ marginTop: '0.6rem' }}>Revised problem</p>
          <p className={cx(styles.docText)}>{pack.pivot.revisedProblemStatement}</p>
          <p className={cx(styles.miniLabel)} style={{ marginTop: '0.6rem' }}>Revised MVP direction</p>
          <p className={cx(styles.docText)}>{pack.pivot.revisedMvpDirection}</p>
        </div>
      ) : null}

      {pack.kill ? (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Kill rationale</p>
          <ul className={cx(styles.bullets)}>{pack.kill.killRationale.map((x, i) => <li key={i}>{x}</li>)}</ul>
          {pack.kill.alternativeIdeas.length > 0 ? (
            <>
              <p className={cx(styles.miniLabel)} style={{ marginTop: '0.6rem' }}>Alternative ideas</p>
              <ul className={cx(styles.bullets)}>
                {pack.kill.alternativeIdeas.map((a, i) => <li key={i}><strong>{a.title}</strong> — {a.rationale}</li>)}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {pack.mvpScope ? (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>MVP scope</p>
          <div className={cx(styles.grid3)}>
            <div>
              <p className={cx(styles.miniLabel)}>Must have</p>
              <ul className={cx(styles.bullets)}>{pack.mvpScope.mustHave.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div>
              <p className={cx(styles.miniLabel)}>Should have</p>
              <ul className={cx(styles.bullets)}>{pack.mvpScope.shouldHave.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div>
              <p className={cx(styles.miniLabel)}>Later</p>
              <ul className={cx(styles.bullets)}>{pack.mvpScope.later.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          </div>
          {pack.mvpScope.explicitCuts.length > 0 ? (
            <>
              <p className={cx(styles.miniLabel)} style={{ marginTop: '0.8rem' }}>Explicit cuts</p>
              <ul className={cx(styles.bullets)}>
                {pack.mvpScope.explicitCuts.map((c, i) => <li key={i}><strong>{c.item}</strong> — {c.reason}</li>)}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {pack.userStories && pack.userStories.length > 0 ? (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>User stories ({pack.userStories.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {pack.userStories.map((s) => (
              <div key={s.id} className={cx(styles.storyCard)}>
                <div className={cx(styles.storyHead)}>
                  <span className={cx(styles.storyId)}>{s.id}</span>
                  <span className={cx(styles.storyTitle)}>{s.title}</span>
                  <Badge className={s.priority === 'must' ? styles.proceed : styles.neutral}>{s.priority}</Badge>
                </div>
                <p className={cx(styles.docText)}>{s.story}</p>
                <ul className={cx(styles.bullets)}>{s.acceptanceCriteria.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {pack.architectureBrief ? (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Architecture</p>
          <div className={cx(styles.tableWrap)}>
            <table className={cx(styles.table)}>
              <thead><tr><th>Component</th><th>Responsibility</th></tr></thead>
              <tbody>
                {pack.architectureBrief.components.map((c) => (
                  <tr key={c.name}><td className={cx(styles.mono)}>{c.name}</td><td>{c.responsibility}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {pack.architectureBrief.integrations.length > 0 ? (
            <div className={cx(styles.chipRow)} style={{ marginTop: '0.6rem' }}>
              {pack.architectureBrief.integrations.map((x, i) => <span key={i} className={cx(styles.chip)}>{x}</span>)}
            </div>
          ) : null}
        </div>
      ) : null}

      {pack.roadmap ? (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>4-week roadmap</p>
          <div className={cx(styles.grid4)}>
            {pack.roadmap.weeks.map((w) => (
              <div key={w.week} className={cx(styles.stat)}>
                <span className={cx(styles.statLabel)}>Week {w.week}</span>
                <span className={cx(styles.barLabel)} style={{ fontWeight: 600 }}>{w.theme}</span>
                <ul className={cx(styles.bullets)}>{w.deliverables.map((d, i) => <li key={i}>{d}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {pack.prd ? (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>PRD requirements</p>
          <div className={cx(styles.tableWrap)}>
            <table className={cx(styles.table)}>
              <thead><tr><th>ID</th><th>Requirement</th><th>Type</th></tr></thead>
              <tbody>
                {pack.prd.requirements.map((req) => (
                  <tr key={req.id}><td className={cx(styles.mono)}>{req.id}</td><td>{req.text}</td><td>{req.type}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {pack.prototypeBrief ? (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Prototype brief</p>
          <p className={cx(styles.docText)}>{pack.prototypeBrief.demoScenario}</p>
          <div className={cx(styles.grid2)} style={{ marginTop: '0.6rem' }}>
            <div>
              <p className={cx(styles.miniLabel)}>Pages</p>
              <ul className={cx(styles.bullets)}>
                {pack.prototypeBrief.pages.map((pg, i) => <li key={i}><strong>{pg.name}</strong> — {pg.purpose}</li>)}
              </ul>
            </div>
            <div>
              <p className={cx(styles.miniLabel)}>UI components</p>
              <div className={cx(styles.chipRow)}>
                {pack.prototypeBrief.uiComponents.map((u, i) => <span key={i} className={cx(styles.chip)}>{u}</span>)}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pack.agentCritiques.length > 0 ? (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Agent critiques</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pack.agentCritiques.map((c, i) => (
              <div key={i} className={cx(styles.critique)}>
                <div className={cx(styles.turnHead)}>
                  <span className={cx(styles.turnRole)}>{c.role}</span>
                  <Badge className={c.severity === 'blocker' ? styles.kill : c.severity === 'warning' ? styles.pivot : styles.neutral}>{c.severity}</Badge>
                  <span className={cx(styles.chip)}>{c.targetSection}</span>
                </div>
                <p className={cx(styles.docText)}>{c.comment}</p>
                {c.suggestion ? <p className={cx(styles.turnMeta)}>↳ {c.suggestion}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={cx(styles.card)}>
        <p className={cx(styles.cardTitle)}>Markdown files</p>
        <p className={cx(styles.cardSub)}>The exact files a GitHub export writes — copy or download any of them.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {files.map((f) => (
            <div key={f.path} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span className={cx(styles.mono)}>{f.path}</span>
              <span style={{ display: 'flex', gap: '0.4rem' }}>
                <CopyButton text={f.content} label="Copy" />
                <DownloadButton filename={f.path} content={f.content} mime="text/markdown" />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
