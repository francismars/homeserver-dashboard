#!/usr/bin/env node
/**
 * Live release-gate validation for the Cloudflare Tunnel setups.
 *
 * Runs the dashboard's own API routes against the REAL Cloudflare API with a
 * real token, end to end, and prints a PASS/FAIL verdict per step. This is
 * the final gate the mock-based suites cannot cover.
 *
 * Usage:
 *   1. Start the dashboard pointed at a scratch config dir:
 *        CLOUDFLARE_CONFIG_DIR=/tmp/cf-live-validate npm run dev
 *   2. In another terminal:
 *        node scripts/validate-live-cloudflare.mjs <zone-name> <subdomain> [--keep] [--skip-preview]
 *      e.g.
 *        node scripts/validate-live-cloudflare.mjs scriptlesslabs.com cftest
 *   3. Paste a Cloudflare API token when prompted (created via the
 *      pre-filled link in Settings -> Cloudflare, or any token with
 *      Account>Cloudflare Tunnel>Edit + Zone>DNS>Edit + Zone>Zone>Read).
 *
 * The token is read from stdin (never argv, so it stays out of shell
 * history and process lists) and sent only to the local dashboard.
 *
 * What it exercises, in order (every setup tier):
 *   - preview mode: enable (real quick tunnel; needs cloudflared on the
 *     dashboard host), instant URL assignment, reachability of the URL,
 *     disable + marker removal. Runs FIRST because enable is refused once
 *     a permanent setup exists. Skipped when cloudflared is unavailable or
 *     with --skip-preview.
 *   - zones listing (token validity + permissions)
 *   - full setup: tunnel adopt/create -> ingress -> DNS -> run-token fetch
 *   - idempotent re-run (must report "already in place" without changes)
 *   - the written token/domain files
 *   - public reachability of https://<subdomain>.<zone> (tunnel will only
 *     serve 502/530-class responses without a homeserver behind it when run
 *     on a dev box; DNS resolving + Cloudflare responding is the PASS bar)
 *   - disconnect: full local teardown (token/domain truncated, config.yml +
 *     credentials removed, configured=false). Skipped with --keep.
 *
 * Cleanup guidance is printed at the end (the created DNS record + tunnel
 * are listed; disconnect cannot remove them at Cloudflare, by design).
 */
import { createInterface } from 'readline';
import { readFile, access } from 'fs/promises';

const BASE = process.env.DASHBOARD_BASE || 'http://localhost:8080';
const CONFIG_DIR = process.env.CLOUDFLARE_CONFIG_DIR || '/tmp/cf-live-validate';

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const KEEP = flags.includes('--keep');
const SKIP_PREVIEW = flags.includes('--skip-preview');
const [zoneName, subdomain] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!zoneName) {
  console.error('usage: node scripts/validate-live-cloudflare.mjs <zone-name> [subdomain] [--keep] [--skip-preview]');
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
const fileGone = async (p) =>
  access(p).then(
    () => false,
    () => true,
  );

// 0. preview tier (must run before the permanent setup exists)
if (SKIP_PREVIEW) {
  console.log('INFO  preview tier skipped (--skip-preview)');
} else {
  const enableRes = await fetch(`${BASE}/api/cloudflare-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'enable' }),
  });
  const enableData = await enableRes.json();
  if (enableRes.status === 503) {
    console.log('INFO  preview tier skipped (cloudflared not available on this host)');
  } else {
    report(enableRes.ok && enableData.enabled === true, 'preview enable', enableData.error);
    if (enableRes.ok) {
      // The instant quick tunnel prints its URL within ~10s and registers a
      // few seconds later; poll the dashboard's own status route.
      let instantUrl = null;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline && !instantUrl) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await fetch(`${BASE}/api/cloudflare-preview`, { cache: 'no-store' });
        const statusData = await statusRes.json();
        if (statusData.instant?.status === 'running' && statusData.instant.url) {
          instantUrl = statusData.instant.url;
        }
        if (statusData.instant?.error) {
          report(false, 'preview instant tunnel', statusData.instant.error);
          break;
        }
      }
      report(!!instantUrl, 'preview instant URL assigned', instantUrl ?? 'no URL within 90s');
      if (instantUrl) {
        try {
          const probe = await fetch(instantUrl, { redirect: 'manual' });
          // Any HTTP answer proves the quick tunnel serves; without a
          // homeserver behind it a 502 from Cloudflare is expected.
          report(true, 'preview URL reachable', `HTTP ${probe.status}`);
        } catch (e) {
          report(false, 'preview URL reachable', String(e));
        }
      }
      const disableRes = await fetch(`${BASE}/api/cloudflare-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      });
      const disableData = await disableRes.json();
      report(
        disableRes.ok && disableData.enabled === false,
        'preview disable',
        disableData.message ?? disableData.error,
      );
      report(await fileGone(`${CONFIG_DIR}/testdrive.env`), 'preview marker removed');
    }
  }
}

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

// 6. disconnect (full local teardown of whatever mode is configured)
if (KEEP) {
  console.log('INFO  disconnect skipped (--keep): the saved token/domain stay in place');
} else {
  const discRes = await fetch(`${BASE}/api/cloudflare-disconnect`, { method: 'POST' });
  const discData = await discRes.json();
  report(discRes.ok && discData.ok === true, 'disconnect', discData.error);
  for (const s of discData.steps ?? []) {
    console.log(`      step ${s.key}: ${s.status}`);
  }
  try {
    const tok = await readFile(`${CONFIG_DIR}/token`, 'utf-8');
    const dom = await readFile(`${CONFIG_DIR}/domain`, 'utf-8');
    report(tok === '' && dom === '', 'token/domain files truncated');
  } catch (e) {
    report(false, 'token/domain files truncated', String(e));
  }
  report(
    (await fileGone(`${CONFIG_DIR}/config.yml`)) && (await fileGone(`${CONFIG_DIR}/credentials.json`)),
    'locally-managed artifacts removed',
  );
  const cfgRes = await fetch(`${BASE}/api/cloudflare-config`, { cache: 'no-store' });
  const cfgData = await cfgRes.json();
  report(cfgRes.ok && cfgData.configured === false, 'status reports unconfigured', `configured=${cfgData.configured}`);
}

console.log('');
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
console.log('');
console.log('Cleanup (if this was a throwaway test): in the Cloudflare dashboard,');
console.log(`delete the CNAME at ${setupData.hostname} and, if unused, the`);
console.log('"pubky-homeserver" tunnel under Zero Trust -> Networks -> Tunnels.');
console.log('(Disconnect only resets local state; it keeps no credentials that');
console.log('could delete the Cloudflare-side objects.)');
process.exit(failures === 0 ? 0 : 1);
