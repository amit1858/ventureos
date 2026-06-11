/**
 * Demo evaluation + export rendering.
 *
 * Re-uses the SAME pure renderers Real Mode uses (`@ventureos/buildsquad`) so
 * the demo's evaluation report and the "files that would be pushed to GitHub"
 * are byte-for-byte what a real export produces — no bespoke demo markdown.
 *
 * Pure functions only (no I/O, no secrets, no SDKs), safe to call from a server
 * component or a test.
 */
import { renderPack, renderEvaluationReport } from '@ventureos/buildsquad';
import type { EvaluationReport } from '@ventureos/contracts';

import type { DemoVenture } from './types';

export interface DemoEvaluation {
  report: EvaluationReport;
  markdown: string;
}

/** Synthesize the EvaluationReport artifact + EVALUATION_REPORT.md for a demo venture. */
export function buildDemoEvaluation(demo: DemoVenture): DemoEvaluation {
  const { artifact, markdown } = renderEvaluationReport({
    venture: demo.venture,
    pack: demo.pack,
    recommendation: demo.recommendation,
    personas: demo.personas,
    graph: demo.research,
    committee: demo.committee,
    readiness: demo.summary.readiness,
    sourceArtifacts: demo.artifacts.map((a) => ({ kind: a.artifactKind, version: a.version })),
    generatorVersion: 'evaluation-report@1 (demo)',
    now: () => new Date(demo.venture.updatedAt),
  });
  return { report: artifact, markdown };
}

export interface DemoExportFile {
  path: string;
  content: string;
  bytes: number;
}

/** The exact file set a Real Mode GitHub export would create for this venture. */
export function buildDemoExportFiles(demo: DemoVenture): DemoExportFile[] {
  const { markdown } = buildDemoEvaluation(demo);
  const files = [
    ...renderPack(demo.pack),
    { path: 'EVALUATION_REPORT.md', content: markdown },
  ];
  return files.map((f) => ({
    path: f.path,
    content: f.content,
    bytes: new TextEncoder().encode(f.content).length,
  }));
}
