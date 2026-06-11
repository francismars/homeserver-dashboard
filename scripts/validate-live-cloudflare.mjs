#!/usr/bin/env node
/**
 * Live release-gate validation for the automatic Cloudflare Tunnel setup.
 *
 * Runs the dashboard's own API routes against the REAL Cloudflare API with a
 * real token, end to end, and prints a PASS/FAIL verdict per step. This is
 * the final gate the mock-based suites cannot cover.
 *
 * Usage:
 *   1. Start the dashboard pointed at a scratch config dir:
 *        CLOUDFLARE_CONFIG_DIR=/tmp/cf-live-validate npm run dev
 *   2. In another terminal:
 *        node scripts/validate-live-cloudflare.mjs <zone-name> <subdomain>
 *      e.g.
 *        node scripts/validate-live-cloudflare.mjs scriptlesslabs.com cftest
 *   3. Paste a Cloudflare API token when prompted (created via the
 *      pre-filled link in Settings -> Cloudflare, or any token with
 *      Account>Cloudflare Tunnel>Edit + Zone>DNS>Edit + Zone>Zone>Read).
 *
 * The token is read from stdin (never argv, so it stays out of shell
 * history and process lists) and sent only to the local dashboard.
 *
 * What it exercises, in order:
 *   - zones listing (token validity + permissions)
 *   - full setup: tunnel adopt/create -> ingress -> DNS -> run-token fetch
 *   - idempotent re-run (must report "already in place" without changes)
 *   - the written token/domain files
 *   - public reachability of https://<subdomain>.<zone> (tunnel will only
 *     serve 502/530-class responses without a homeserver behind it when run
 *     on a dev box; DNS resolving + Cloudflare responding is the PASS bar)
 *
 * Cleanup guidance is printed at the end (the created DNS record + tunnel
 * are listed; remove them in the Cloudflare dashboard if this was a
 * throwaway test).
 */
import { createInterface } from 'readline';
import { readFile } from 'fs/promises';

const BASE = process.env.DASHBOARD_BASE || 'http://localhost:8080';
const CONFIG_DIR = process.env.CLOUDFLARE_CONFIG_DIR || '/tmp/cf-live-validate';

const [zoneName, subdomain] = process.argv.slice(2);
if (!zoneName) {
  console.error('usage: node scripts/validate-live-cloudflare.mjs <zone-name> [subdomain]');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const token = await new Promise((resolve) => rl.question('Paste Cloudflare API token: ', resolve));
rl.close();

let failures = 0;
const report = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` - ${detail}` : ''}`);
  if (!ok) failures++;
};

// 1. zones
const zonesRes = await fetch(`${BASE}/api/cloudflare-auto-setup/zones`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ api_token: token.trim() }),
});
const zonesData = await zonesRes.json();
report(zonesRes.ok, 'zones listing', zonesRes.ok ? `${zonesData.zones.length} zone(s)` : zonesData.error);
const zone = zonesRes.ok ? zonesData.zones.find((z) => z.name === zoneName) : undefined;
report(!!zone, `zone "${zoneName}" visible to token`, zone ? `id=${zone.id} status=${zone.status}` : 'not found');
if (!zone) process.exit(1);

// 2. full setup
const setupBody = { api_token: token.trim(), zone_id: zone.id, subdomain: subdomain || undefined };
const setupRes = await fetch(`${BASE}/api/cloudflare-auto-setup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(setupBody),
});
const setupData = await setupRes.json();
if (setupRes.status === 409 && setupData.type === 'dns_conflict') {
  console.log(`INFO  existing records at the hostname: ${JSON.stringify(setupData.existing_records)}`);
  console.log('INFO  re-run with a different subdomain, or confirm overwrite manually in the UI.');
  process.exit(1);
}
report(setupRes.ok, 'full setup', setupRes.ok ? setupData.hostname : setupData.error);
for (const s of setupData.steps ?? []) {
  console.log(`      step ${s.key}: ${s.status}${s.detail ? ` (${s.detail})` : ''}`);
}
if (!setupRes.ok) process.exit(1);

// 3. idempotent re-run
const rerunRes = await fetch(`${BASE}/api/cloudflare-auto-setup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(setupBody),
});
const rerunData = await rerunRes.json();
const dnsStep = (rerunData.steps ?? []).find((s) => s.key === 'dns');
report(
  rerunRes.ok && dnsStep?.detail === 'DNS record already in place',
  'idempotent re-run',
  dnsStep?.detail ?? rerunData.error,
);

// 4. files
try {
  const tok = await readFile(`${CONFIG_DIR}/token`, 'utf-8');
  const dom = await readFile(`${CONFIG_DIR}/domain`, 'utf-8');
  report(tok.startsWith('eyJ') && tok.length > 100, 'run token written', `${tok.length} chars`);
  report(dom === setupData.hostname, 'domain written', dom);
} catch (e) {
  report(false, 'credential files', String(e));
}

// 5. public reachability (Cloudflare edge answering for the hostname)
await new Promise((r) => setTimeout(r, 5000));
try {
  const probe = await fetch(`https://${setupData.hostname}/`, { redirect: 'manual' });
  // Without a connected tunnel/homeserver behind it, Cloudflare answers
  // 530/502/404; any HTTP answer proves DNS + edge routing work.
  report(true, 'edge reachability', `HTTP ${probe.status} from Cloudflare for ${setupData.hostname}`);
} catch (e) {
  report(false, 'edge reachability', String(e));
}

console.log('');
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
console.log('');
console.log('Cleanup (if this was a throwaway test): in the Cloudflare dashboard,');
console.log(`delete the CNAME at ${setupData.hostname} and, if unused, the`);
console.log('"pubky-homeserver" tunnel under Zero Trust -> Networks -> Tunnels.');
process.exit(failures === 0 ? 0 : 1);
