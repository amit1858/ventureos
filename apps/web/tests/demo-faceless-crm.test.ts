import { describe, expect, it } from 'vitest';

import { calculateVentureProgress, calculateVentureReadiness } from '@foundry/ventures';

import { facelessCrmDemo, getDemoVenture, listDemoVentures } from '../src/lib/demo';
import { buildDemoEvaluation, buildDemoExportFiles } from '../src/lib/demo/render';

describe('Demo registry', () => {
  it('exposes the Faceless CRM demo by slug', () => {
    expect(listDemoVentures().length).toBeGreaterThanOrEqual(1);
    expect(getDemoVenture('faceless-crm')).toBe(facelessCrmDemo);
    expect(getDemoVenture('does-not-exist')).toBeUndefined();
  });

  it('every demo has a unique slug', () => {
    const slugs = listDemoVentures().map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('Faceless CRM demo is well-formed', () => {
  const d = facelessCrmDemo;

  it('has the expected shape', () => {
    expect(d.slug).toBe('faceless-crm');
    expect(d.venture.title).toBe('Faceless CRM for SMB');
    expect(d.personas).toHaveLength(5);
    expect(d.recommendation.decision).toBe('PROCEED');
    expect(d.committee.deliberation).toBeDefined();
    expect(d.pack.mode).toBe('proceed');
  });

  it('artifact ledger is internally consistent', () => {
    expect(d.summary.artifactCount).toBe(d.artifacts.length);
    // Every artifact belongs to this venture and is version >= 1.
    for (const a of d.artifacts) {
      expect(a.ventureId).toBe(d.venture.ventureId);
      expect(a.version).toBeGreaterThanOrEqual(1);
    }
    // The scoring artifacts the readiness engine relies on are all present.
    const kinds = new Set(d.artifacts.map((a) => a.artifactKind));
    for (const k of ['persona_set', 'research_graph', 'buying_committee', 'venture_recommendation', 'buildsquad_pack']) {
      expect(kinds.has(k as never)).toBe(true);
    }
  });

  it('committee deliberation records at least one opinion change', () => {
    const delib = d.committee.deliberation!;
    expect(delib.opinionChanges.length).toBeGreaterThanOrEqual(1);
    // Every persona referenced in the deliberation exists in the persona set.
    const ids = new Set(d.personas.map((p) => p.id));
    for (const o of delib.phases.initialPositions) expect(ids.has(o.personaId)).toBe(true);
    for (const c of delib.phases.challenges) {
      expect(ids.has(c.fromPersonaId)).toBe(true);
      expect(ids.has(c.toPersonaId)).toBe(true);
    }
  });
});

describe('Summary matches the real scoring engine', () => {
  // The demo cannot silently drift from how Real Mode computes readiness/progress.
  const d = facelessCrmDemo;

  it('readiness recomputes to the hardcoded summary', () => {
    const readiness = calculateVentureReadiness(d.artifacts);
    expect(readiness).toEqual(d.summary.readiness);
  });

  it('progress recomputes to the hardcoded summary', () => {
    const progress = calculateVentureProgress(d.artifacts);
    expect(progress).toEqual(d.summary.progress);
  });

  it('latestRecommendation mirrors the recommendation artifact', () => {
    expect(d.summary.latestRecommendation?.decision).toBe(d.recommendation.decision);
    expect(d.summary.latestRecommendation?.overallScore).toBe(d.recommendation.overallScore);
    expect(d.summary.latestRecommendation?.confidenceScore).toBe(d.recommendation.confidenceScore);
  });
});

describe('Evaluation report renders from the real renderer', () => {
  const d = facelessCrmDemo;
  const evaluation = buildDemoEvaluation(d);

  it('produces a consistent, non-empty report', () => {
    expect(evaluation.markdown.length).toBeGreaterThan(200);
    expect(evaluation.report.recommendation.decision).toBe('PROCEED');
    expect(evaluation.report.readinessScore.overall).toBe(d.summary.readiness.overall);
    expect(evaluation.report.venture.title).toBe(d.venture.title);
  });
});

describe('GitHub export is build-ready and safe', () => {
  const d = facelessCrmDemo;
  const files = buildDemoExportFiles(d);

  it('emits the expected repo-ready files', () => {
    const paths = files.map((f) => f.path);
    expect(paths).toContain('README.md');
    expect(paths).toContain('PRD.md');
    expect(paths).toContain('ARCHITECTURE.md');
    expect(paths).toContain('ROADMAP.md');
    expect(paths).toContain('USER_STORIES.md');
    expect(paths).toContain('EVALUATION_REPORT.md');
    for (const f of files) expect(f.bytes).toBeGreaterThan(0);
  });

  it('the github_repo artifact lists the same files as the export', () => {
    const repo = d.artifacts.find((a) => a.artifactKind === 'github_repo');
    expect(repo).toBeDefined();
    const repoPaths = (repo!.payload as { files: { path: string }[] }).files.map((f) => f.path).sort();
    const exportPaths = files.map((f) => f.path).sort();
    expect(repoPaths).toEqual(exportPaths);
  });
});

describe('No secrets leak into demo data or exports', () => {
  const d = facelessCrmDemo;
  const haystack = [
    JSON.stringify(d),
    buildDemoEvaluation(d).markdown,
    ...buildDemoExportFiles(d).map((f) => f.content),
  ].join('\n');

  const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
    { name: 'OpenAI key', re: /sk-[A-Za-z0-9]{20,}/ },
    { name: 'Anthropic key', re: /sk-ant-[A-Za-z0-9-]{20,}/ },
    { name: 'GitHub PAT (classic)', re: /ghp_[A-Za-z0-9]{20,}/ },
    { name: 'GitHub PAT (fine-grained)', re: /github_pat_[A-Za-z0-9_]{20,}/ },
    { name: 'Google API key', re: /AIza[A-Za-z0-9_-]{30,}/ },
    { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
    { name: 'Slack token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
    { name: 'PEM private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  ];

  it('contains no secret-like tokens', () => {
    for (const { name, re } of SECRET_PATTERNS) {
      expect(haystack, `should not contain a ${name}`).not.toMatch(re);
    }
  });
});
