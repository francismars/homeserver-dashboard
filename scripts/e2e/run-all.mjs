// Sequential e2e runner: each spec boots its own dev server + fake
// environment, so they must not run in parallel (ports are free, but the
// machine would compile six Next dev servers at once).
//
//   npm run e2e            # all specs
//   npm run e2e -- preview # only specs whose filename includes "preview"
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

const SPECS = [
  'cf-auto.spec.mjs',
  'preview.spec.mjs',
  'disconnect.spec.mjs',
  'overview-health.spec.mjs',
  'connect-authorized.spec.mjs',
  'preview-supersede.spec.mjs',
];

const filters = process.argv.slice(2);
const selected = filters.length > 0 ? SPECS.filter((s) => filters.some((f) => s.includes(f))) : SPECS;
if (selected.length === 0) {
  console.error(`No spec matches ${JSON.stringify(filters)}. Available: ${SPECS.join(', ')}`);
  process.exit(1);
}

const results = [];
for (const spec of selected) {
  const startedAt = Date.now();
  console.log(`\n=== ${spec} ===`);
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(DIR, spec)], { stdio: 'inherit' });
    child.on('close', resolve);
    child.on('error', () => resolve(1));
  });
  results.push({ spec, ok: code === 0, seconds: Math.round((Date.now() - startedAt) / 1000) });
}

console.log('\n=== E2E SUMMARY ===');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.spec} (${r.seconds}s)`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? `\nALL ${results.length} SPECS PASSED` : `\n${failed}/${results.length} SPECS FAILED`);
process.exit(failed === 0 ? 0 : 1);
