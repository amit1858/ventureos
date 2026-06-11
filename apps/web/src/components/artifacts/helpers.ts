/**
 * Shared, pure presentational helpers for Real-Mode artifact rendering.
 *
 * No JSX, no client hooks, no I/O — just class-name composition, label maps,
 * status→colour mapping and small formatters. Importing the CSS module here
 * keeps every artifact component visually consistent with one source of truth.
 */
import type {
  CommitteePosition,
  CommitteeStance,
  RiskLevel,
  ScoreDimension,
  VentureArtifactKind,
  VentureJobKind,
  VentureJobStatus,
  VentureStatus,
  VentureTimelineEventKind,
} from '@ventureos/contracts';

import styles from './artifacts.module.css';

export { styles };

/** Join class names, coercing the `string | undefined` CSS-module values
 *  (the workspace enables `noUncheckedIndexedAccess`) to a single string. */
export function cx(...names: Array<string | undefined | false>): string {
  return names.filter(Boolean).join(' ');
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

/** A 0..1 probability rendered as a percentage. */
export function prob(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Deterministic UTC timestamp (stable across server/client, unlike toLocaleString). */
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mon = MONTHS[d.getUTCMonth()] ?? '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${mon} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${hh}:${mm} UTC`;
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export function fmtCostCents(cents: number): string {
  return `~$${(cents / 100).toFixed(3)}`;
}

export const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  problemStrength: 'Problem strength',
  buyerUrgency: 'Buyer urgency',
  willingnessToPay: 'Willingness to pay',
  differentiation: 'Differentiation',
  adoptionFriction: 'Adoption friction',
  committeeConfidence: 'Committee confidence',
  executionRisk: 'Execution risk',
  marketClarity: 'Market clarity',
};

export const POSITION_LABELS: Record<CommitteePosition, string> = {
  support: 'Support',
  support_with_concerns: 'Support, with concerns',
  pilot_first: 'Pilot first',
  reject: 'Reject',
};

export const ARTIFACT_LABEL: Record<VentureArtifactKind, string> = {
  persona_set: 'Persona set',
  interview_transcript: 'Interview',
  focus_group_transcript: 'Focus group',
  buying_committee: 'Buying committee',
  persona_insights: 'Persona insights',
  research_graph: 'Research graph',
  venture_recommendation: 'Recommendation',
  buildsquad_pack: 'BuildSquad pack',
  evaluation_report: 'Evaluation report',
  github_repo: 'GitHub repo',
};

export const EVENT_LABELS: Record<VentureTimelineEventKind, string> = {
  venture_created: 'Venture created',
  venture_updated: 'Venture updated',
  venture_archived: 'Venture archived',
  persona_set_generated: 'Personas generated',
  interview_run: 'Interview run',
  focus_group_run: 'Focus group run',
  buying_committee_run: 'Buying committee run',
  persona_insights_generated: 'Persona insights generated',
  research_graph_built: 'Research graph built',
  recommendation_generated: 'Recommendation generated',
  buildsquad_pack_generated: 'BuildSquad pack generated',
  evaluation_report_generated: 'Evaluation report generated',
  job_started: 'Job started',
  job_progress: 'Job progress',
  job_succeeded: 'Job succeeded',
  job_failed: 'Job failed',
  github_export_started: 'GitHub export started',
  buildsquad_repo_pushed: 'Repository pushed',
};

export const JOB_KIND_LABEL: Record<VentureJobKind, string> = {
  'personalab.generate_personas': 'Generate personas',
  'personalab.run_interview': 'Run interview',
  'personalab.run_focus_group': 'Run focus group',
  'personalab.run_buying_committee': 'Run buying committee',
  'personalab.extract_insights': 'Extract insights',
  'graphify.build': 'Build research graph',
  'venturelab.recommend': 'VentureLab recommendation',
  'buildsquad.plan': 'BuildSquad plan',
  'github.export': 'GitHub export',
};

/** Where to send the user to re-run a job of a given kind (no retry endpoint exists). */
export function labLinkForJob(jobKind: VentureJobKind, ventureId: string): { href: string; label: string } {
  const vid = encodeURIComponent(ventureId);
  if (jobKind.startsWith('personalab.')) {
    return { href: `/labs/persona?ventureId=${vid}`, label: 'Re-run in PersonaLab' };
  }
  if (jobKind === 'graphify.build') {
    return { href: `/labs/research-graph?ventureId=${vid}`, label: 'Re-run in Graphify' };
  }
  if (jobKind === 'venturelab.recommend') {
    return { href: `/labs/venture?ventureId=${vid}`, label: 'Re-run in VentureLab' };
  }
  if (jobKind === 'buildsquad.plan') {
    return { href: `/labs/buildsquad?ventureId=${vid}`, label: 'Re-run in BuildSquad' };
  }
  if (jobKind === 'github.export') {
    return { href: `/ventures/${vid}?tab=buildplan`, label: 'Retry GitHub export' };
  }
  return { href: `/ventures/${vid}`, label: 'Back to workspace' };
}

export function decisionClass(d: string): string {
  const up = d.toUpperCase();
  if (up === 'PROCEED' || up === 'BUY') return cx(styles.proceed);
  if (up === 'PIVOT' || up === 'DEFER' || up === 'PROCEED_WITH_PIVOT_NOTES') return cx(styles.pivot);
  if (up === 'KILL' || up === 'REJECT') return cx(styles.kill);
  if (up === 'PILOT') return cx(styles.running);
  return cx(styles.neutral);
}

export function positionClass(p: CommitteePosition): string {
  if (p === 'support') return cx(styles.proceed);
  if (p === 'support_with_concerns') return cx(styles.running);
  if (p === 'pilot_first') return cx(styles.pivot);
  return cx(styles.kill);
}

export function stanceClass(s: CommitteeStance): string {
  if (s === 'champion') return cx(styles.proceed);
  if (s === 'supporter') return cx(styles.running);
  if (s === 'skeptic') return cx(styles.pivot);
  if (s === 'blocker') return cx(styles.kill);
  return cx(styles.neutral);
}

export function riskClass(level: RiskLevel | 'low' | 'med' | 'high'): string {
  if (level === 'high' || level === 'critical') return cx(styles.kill);
  if (level === 'medium' || level === 'med') return cx(styles.pivot);
  return cx(styles.done);
}

/** Scorecard bar colour. Avoids alarming red on intentional "lower is better" risk axes. */
export function scoreColor(score: number, higherIsBetter: boolean): string {
  const good = higherIsBetter ? score >= 70 : score <= 45;
  const bad = higherIsBetter ? score < 45 : score > 70;
  if (good) return cx(styles.barFillGreen);
  if (bad) return cx(styles.barFill);
  return cx(styles.barFillAmber);
}

export function jobStatusClass(s: VentureJobStatus): string {
  switch (s) {
    case 'queued': return cx(styles.queued);
    case 'running': return cx(styles.running);
    case 'succeeded': return cx(styles.done);
    case 'failed': return cx(styles.failed);
    case 'cancelled': return cx(styles.cancelled);
    default: return cx(styles.neutral);
  }
}

export function ventureStatusClass(s: VentureStatus): string {
  switch (s) {
    case 'approved':
    case 'building': return cx(styles.proceed);
    case 'researching': return cx(styles.running);
    case 'validating': return cx(styles.pivot);
    case 'pivoting': return cx(styles.cancelled);
    case 'rejected': return cx(styles.kill);
    default: return cx(styles.neutral);
  }
}

export function defaultRepoName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return slug || 'venture-export';
}
