#!/usr/bin/env node
// Run every src/**/*.test.ts under Node's test runner. Node only expands a
// glob passed to --test from v21, and its own discovery looks for .js files
// only, so on Node 18/20 `node --test 'src/**/*.test.ts'` finds nothing and
// `npm test` passes with zero tests. Listing the files here works on any
// supported Node and any shell.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function findTests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findTests(path);
    return entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

const files = findTests(resolve(repoRoot, 'src')).sort();
if (files.length === 0) {
  console.error('No *.test.ts files found under src/');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  cwd: repoRoot,
  stdio: 'inherit'
});
process.exit(result.status ?? 1);
