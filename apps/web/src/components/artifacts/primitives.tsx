import type { ReactNode } from 'react';
import type { VentureJobStatus, VentureStatus } from '@ventureos/contracts';

import {
  cx,
  decisionClass,
  jobStatusClass,
  styles,
  ventureStatusClass,
} from './helpers';

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx(styles.badge, className)}>{children}</span>;
}

export function JobStatusBadge({ status }: { status: VentureJobStatus }) {
  return <Badge className={jobStatusClass(status)}>{status}</Badge>;
}

export function VentureStatusBadge({ status }: { status: VentureStatus }) {
  return <Badge className={ventureStatusClass(status)}>{status}</Badge>;
}

export function DecisionBadge({ decision }: { decision: string }) {
  return <Badge className={decisionClass(decision)}>{decision}</Badge>;
}

/** Self-contained readiness ring (inline SVG, no external CSS dependency). */
export function ScoreRing({
  value,
  size = 80,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = Math.max(5, Math.round(size * 0.08));
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const off = c - (v / 100) * c;
  const colour = v >= 70 ? '#56c596' : v >= 45 ? '#f3b350' : '#ef6a6a';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2a2a30" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.28} fill="#e8e8ea" fontWeight={700}>
          {v}
        </text>
      </svg>
      {label ? <span className={cx(styles.statLabel)}>{label}</span> : null}
    </div>
  );
}

export function Bar({
  label,
  value,
  fill,
}: {
  label: string;
  value: number;
  fill?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cx(styles.bar)}>
      <div className={cx(styles.barHead)}>
        <span className={cx(styles.barLabel)}>{label}</span>
        <span className={cx(styles.barVal)}>{v}</span>
      </div>
      <div className={cx(styles.barTrack)}>
        <div className={cx(styles.barFill, fill)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function Stat({ value, label, sub }: { value: ReactNode; label: string; sub?: string }) {
  return (
    <div className={cx(styles.stat)}>
      <span className={cx(styles.statValue)}>{value}</span>
      <span className={cx(styles.statLabel)}>{label}</span>
      {sub ? <span className={cx(styles.statSub)}>{sub}</span> : null}
    </div>
  );
}

export function EmptyState({
  icon = '○',
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className={cx(styles.empty)}>
      <div className={cx(styles.emptyIcon)}>{icon}</div>
      <p className={cx(styles.emptyTitle)}>{title}</p>
      {text ? <p className={cx(styles.emptyText)}>{text}</p> : null}
      {action ? (
        <a className={cx(styles.btn, styles.btnPrimary)} href={action.href}>{action.label}</a>
      ) : null}
    </div>
  );
}

/** Raw JSON, collapsed by default (native <details> — secondary, never the default view). */
export function RawJson({ data, label = 'View raw JSON' }: { data: unknown; label?: string }) {
  return (
    <details className={cx(styles.rawDetails)}>
      <summary className={cx(styles.rawSummary)}>{label}</summary>
      <pre className={cx(styles.rawPre)}>{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}
