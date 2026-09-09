// all.mjs — run every test file. `node tests/all.mjs`
//
// Each file runs in its own process because the harness exits with a status.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter(f => f.endsWith('.test.mjs')).sort();

let failed = 0;
for (const f of files) {
  const res = spawnSync(process.execPath, [join(here, f)], { stdio: 'inherit' });
  if (res.status !== 0) failed++;
}

console.log(failed
  ? `\n=== ${failed} of ${files.length} suites failed ===`
  : `\n=== all ${files.length} suites passed ===`);
process.exit(failed ? 1 : 0);
