#!/usr/bin/env node
/**
 * Foundry architectural boundary check.
 *
 * Rules (CI-enforced):
 *   1. Provider SDKs (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `@azure/openai`)
 *      may ONLY be imported from `packages/providers/<provider>-ts/`.
 *   2. External engine SDKs may ONLY be imported from their dedicated adapter package:
 *        - `tinytroupe` → `packages/adapters/tinytroupe-py/`
 *        - `graphify` / `graphifyy` → `packages/adapters/graphify-py/`
 *        - `@bradygaster/squad-cli` (Squad-OSS) → `packages/adapters/squad-ts/`
 *        - `@octokit/*` → `packages/adapters/github-ts/`
 *   3. App code (`apps/**`) may only import from `@foundry/*` packages, never SDKs directly.
 *
 * Exits non-zero with a list of violations.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';

const ROOT = process.cwd();

// rule { sdkPattern, allowedPathPrefix(es), lang }
const RULES = [
  // TS/JS provider SDKs
  { sdk: /^openai($|\/)/, allow: 'packages/providers/openai-ts/', langs: ['ts', 'tsx', 'js', 'mjs'] },
  { sdk: /^@anthropic-ai\/sdk($|\/)/, allow: 'packages/providers/anthropic-ts/', langs: ['ts', 'tsx', 'js', 'mjs'] },
  { sdk: /^@google\/generative-ai($|\/)/, allow: 'packages/providers/gemini-ts/', langs: ['ts', 'tsx', 'js', 'mjs'] },
  { sdk: /^@azure\/openai($|\/)/, allow: 'packages/providers/azure-openai-ts/', langs: ['ts', 'tsx', 'js', 'mjs'] },
  // Engine SDKs
  { sdk: /^@bradygaster\/squad/, allow: 'packages/adapters/squad-ts/', langs: ['ts', 'tsx', 'js', 'mjs'] },
  { sdk: /^@octokit\//, allow: 'packages/adapters/github-ts/', langs: ['ts', 'tsx', 'js', 'mjs'] },
  // Persistence SDKs — server-only.
  {
    sdk: /^@supabase\/supabase-js($|\/)/,
    allow: ['packages/credentials/', 'packages/ventures/', 'apps/web/src/lib/supabase/', 'apps/web/src/lib/ventures.ts', 'apps/web/src/lib/jobs.ts'],
    langs: ['ts', 'tsx', 'js', 'mjs'],
  },
  {
    sdk: /^@supabase\/ssr($|\/)/,
    allow: ['apps/web/src/lib/supabase/'],
    langs: ['ts', 'tsx', 'js', 'mjs'],
  },
  // Python engines
  { sdk: /^tinytroupe($|\.)/, allow: 'packages/adapters/tinytroupe-py/', langs: ['py'] },
  { sdk: /^graphify(?:y)?($|\.)/, allow: 'packages/adapters/graphify-py/', langs: ['py'] },
];

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.turbo', 'dist', 'build', '.venv', '__pycache__', '.uv-cache']);

/** @returns {Promise<string[]>} */
async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let s;
    try { s = await stat(full); } catch { continue; }
    if (s.isDirectory()) {
      out.push(...(await walk(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

const TS_IMPORT_RE = /(?:^|\n)\s*(?:import\s+(?:[^'"]*?\s+from\s+)?|export\s+[^'"]*?\s+from\s+)['"]([^'"]+)['"]/g;
const TS_REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
const PY_IMPORT_RE = /(?:^|\n)\s*(?:from\s+([\w.]+)\s+import\b|import\s+([\w.,\s]+))/g;

function langOf(path) {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return path.endsWith('.tsx') ? 'tsx' : 'ts';
  if (path.endsWith('.js')) return 'js';
  if (path.endsWith('.mjs')) return 'mjs';
  if (path.endsWith('.py')) return 'py';
  return null;
}

function* importsIn(content, lang) {
  if (lang === 'py') {
    let m;
    while ((m = PY_IMPORT_RE.exec(content))) {
      if (m[1]) yield m[1];
      else if (m[2]) {
        for (const piece of m[2].split(',')) {
          const name = piece.trim().split(/\s+as\s+/)[0];
          if (name) yield name;
        }
      }
    }
  } else {
    let m;
    while ((m = TS_IMPORT_RE.exec(content))) yield m[1];
    while ((m = TS_REQUIRE_RE.exec(content))) yield m[1];
  }
}

function toPosix(p) {
  return p.split(sep).join(posix.sep);
}

async function main() {
  const files = await walk(ROOT);
  const violations = [];

  for (const file of files) {
    const lang = langOf(file);
    if (!lang) continue;
    const rel = toPosix(relative(ROOT, file));
    if (rel.startsWith('scripts/')) continue; // this script itself is exempt

    let content;
    try { content = await readFile(file, 'utf8'); } catch { continue; }

    for (const spec of importsIn(content, lang)) {
      for (const rule of RULES) {
        if (!rule.langs.includes(lang)) continue;
        if (!rule.sdk.test(spec)) continue;
        const allowed = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
        const ok = allowed.some((prefix) => rel.startsWith(prefix));
        if (!ok) {
          violations.push({ file: rel, importSpec: spec, allowed: allowed.join(' or ') });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log('check-import-boundaries: OK (no violations).');
    process.exit(0);
  }

  console.error('check-import-boundaries: FAILED. Architectural violations:\n');
  for (const v of violations) {
    console.error(`  - ${v.file}`);
    console.error(`      imports '${v.importSpec}'`);
    console.error(`      allowed only in: ${v.allowed}\n`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error('check-import-boundaries crashed:', e);
  process.exit(2);
});
