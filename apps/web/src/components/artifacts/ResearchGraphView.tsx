import type { ResearchGraph } from '@foundry/contracts';

import { cx, prob, styles } from './helpers';
import { RawJson, Stat } from './primitives';

/** Renders a research graph as scannable tables/cards. Raw JSON is secondary. */
export function ResearchGraphView({ graph }: { graph: ResearchGraph }) {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const sources = graph.sources ?? [];
  const topNodes = [...nodes].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 6);

  const edgeTypes = new Map<string, number>();
  for (const e of edges) edgeTypes.set(e.type, (edgeTypes.get(e.type) ?? 0) + 1);

  return (
    <div className={cx(styles.stack)}>
      <div className={cx(styles.grid4)}>
        <Stat value={graph.stats?.nodes ?? nodes.length} label="Nodes" />
        <Stat value={graph.stats?.edges ?? edges.length} label="Edges" />
        <Stat value={graph.godNodes?.length ?? 0} label="God-nodes" />
        <Stat value={graph.contradictions?.length ?? 0} label="Contradictions" />
      </div>

      <div className={cx(styles.grid2)}>
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>God-nodes (highest centrality)</p>
          {graph.godNodes && graph.godNodes.length > 0 ? (
            <div className={cx(styles.tableWrap)}>
              <table className={cx(styles.table)}>
                <thead><tr><th>Concept</th><th>Degree</th><th>Community</th></tr></thead>
                <tbody>
                  {graph.godNodes.map((g, i) => (
                    <tr key={`${g.label}-${i}`}><td>{g.label}</td><td>{g.degree}</td><td>{g.community}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className={cx(styles.muted)}>No god-nodes identified.</p>}
        </div>
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Strongest signals</p>
          {topNodes.length > 0 ? (
            <div className={cx(styles.tableWrap)}>
              <table className={cx(styles.table)}>
                <thead><tr><th>Signal</th><th>Type</th><th>Conf.</th></tr></thead>
                <tbody>
                  {topNodes.map((n) => (
                    <tr key={n.id}><td>{n.label}</td><td className={cx(styles.mono)}>{n.type}</td><td>{prob(n.confidence)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className={cx(styles.muted)}>Stat-only graph — no node detail available.</p>}
        </div>
      </div>

      <div className={cx(styles.grid2)}>
        {edgeTypes.size > 0 ? (
          <div className={cx(styles.card)}>
            <p className={cx(styles.cardTitle)}>Edge summary</p>
            <div className={cx(styles.chipRow)}>
              {[...edgeTypes.entries()].map(([type, count]) => (
                <span key={type} className={cx(styles.chip)}>{type}: {count}</span>
              ))}
            </div>
          </div>
        ) : null}
        {sources.length > 0 ? (
          <div className={cx(styles.card)}>
            <p className={cx(styles.cardTitle)}>Sources ({sources.length})</p>
            <ul className={cx(styles.bullets)}>
              {sources.slice(0, 8).map((s, i) => (
                <li key={i}>{(s as { title?: string; url?: string }).title ?? (s as { url?: string }).url ?? `Source ${i + 1}`}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {graph.contradictions && graph.contradictions.length > 0 ? (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Contradictions</p>
          <ul className={cx(styles.bullets)}>
            {graph.contradictions.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      ) : null}

      {graph.surprisingConnections && graph.surprisingConnections.length > 0 ? (
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Surprising connections</p>
          <ul className={cx(styles.bullets)}>
            {graph.surprisingConnections.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      ) : null}

      <RawJson data={graph} />
    </div>
  );
}
