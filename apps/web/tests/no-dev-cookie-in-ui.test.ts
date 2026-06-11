/**
 * Locks in that no production-facing UI string mentions the legacy
 * `vos_dev_user` cookie. The deployed app must replace dev-cookie instructions
 * with the polished /access screen.
 *
 * Scans all *.tsx pages/components under apps/web/src for the substring,
 * skipping doc-only files. Limits surface area to client/server React modules,
 * which is where any leaked string would render.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', 'src');

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

describe('No production UI mentions the legacy dev cookie', () => {
  // auth.ts is the one legitimate mention: it implements the dev fallback for
  // local-dev-only and documents that production never honours it. Test files
  // also mention the string by name.
  const ALLOWED = new Set<string>([
    path.join(ROOT, 'lib', 'auth.ts'),
  ]);

  it('no source file under apps/web/src/app references `vos_dev_user`', () => {
    const offenders: string[] = [];
    for (const file of walk(path.join(ROOT, 'app'))) {
      if (ALLOWED.has(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes('vos_dev_user')) offenders.push(file);
    }
    expect(offenders, `Found dev-cookie reference in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no source file under apps/web/src/components references `vos_dev_user`', () => {
    const componentsDir = path.join(ROOT, 'components');
    if (!fs.existsSync(componentsDir)) return;
    const offenders: string[] = [];
    for (const file of walk(componentsDir)) {
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes('vos_dev_user')) offenders.push(file);
    }
    expect(offenders, `Found dev-cookie reference in: ${offenders.join(', ')}`).toEqual([]);
  });
});
