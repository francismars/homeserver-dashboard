// API-token automatic setup against the mock Cloudflare API.
// Covers: domain-only config save rejected without a token, invalid token
// error, zones loading (pending zone disabled), the setup flow lock (409),
// DNS conflict + invalidation on subdomain change, the happy path, the
// overwrite flow, and the manual escape hatch.
import { promises as fs } from 'fs';
import path from 'path';
import { runSpec, openCloudflareTab, check, step, sleep, VALID_TOKEN } from './lib/harness.mjs';
import { RUN_TOKEN_TID } from './lib/mock-cf-server.mjs';

await runSpec('cf-auto', async ({ env, browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 950 } })).newPage();

  step('domain-only save is rejected while no token exists');
  const domainOnly = await env.api('/api/cloudflare-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: 'solo.example.com' }),
  });
  check(domainOnly.status === 400, 'domain-only POST returns 400', `got ${domainOnly.status}`);
  check(
    /token is required/i.test(domainOnly.data.error ?? ''),
    'rejection explains the missing token',
    domainOnly.data.error,
  );

  step('open the Cloudflare tab and expand the API-token setup');
  await openCloudflareTab(page, env.baseUrl);
  await page.click('[data-testid="cf-api-token-toggle"]');
  await page.waitForSelector('[data-testid="cf-auto-token"]', { timeout: 15000 });

  step('invalid token path');
  await page.fill('[data-testid="cf-auto-token"]', 'definitely-not-a-valid-token-xx');
  await page.click('[data-testid="cf-auto-load-zones"]');
  await page.waitForSelector('[data-testid="cf-auto-error"]', { timeout: 15000 });
  const invalidMsg = await page.locator('[data-testid="cf-auto-error"]').textContent();
  check(invalidMsg.length > 0, 'invalid-token error shown', invalidMsg.slice(0, 80));

  step('valid token: zones load, pending zone disabled');
  await page.fill('[data-testid="cf-auto-token"]', VALID_TOKEN);
  await page.click('[data-testid="cf-auto-load-zones"]');
  await page.waitForSelector('[data-testid="cf-auto-zone"]', { timeout: 15000 });
  const selectedZone = await page.locator('[data-testid="cf-auto-zone"]').textContent();
  check(selectedZone.includes('example.com'), 'first active zone preselected', selectedZone.trim());
  await page.locator('[data-testid="cf-auto-zone"]').click();
  await sleep(400);
  const pendingDisabled = await page
    .locator('[data-testid="cf-auto-zone-pending-domain.net"]')
    .getAttribute('data-disabled');
  check(pendingDisabled !== null, 'pending zone is disabled in the picker');
  await page.keyboard.press('Escape');
  await sleep(300);

  step('setup flow lock: concurrent setup attempt gets 409');
  const lockFile = path.join(env.configDir, '.flow-setup.lock');
  await fs.writeFile(lockFile, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }), 'utf-8');
  const locked = await env.api('/api/cloudflare-auto-setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_token: VALID_TOKEN, zone_id: 'a'.repeat(32), subdomain: 'pubky' }),
  });
  check(locked.status === 409, 'auto-setup under a held lock returns 409', `got ${locked.status}`);
  check(
    /already in progress/i.test(locked.data.error ?? ''),
    '409 says setup is already in progress',
    locked.data.error,
  );
  await fs.rm(lockFile, { force: true });

  step('conflict path: subdomain "taken" has a pre-existing A record');
  await page.fill('[data-testid="cf-auto-subdomain"]', 'taken');
  await page.click('[data-testid="cf-auto-create"]');
  await page.waitForSelector('[data-testid="cf-auto-conflict"]', { timeout: 20000 });
  const conflictText = await page.locator('[data-testid="cf-auto-conflict"]').textContent();
  check(conflictText.includes('taken.example.com'), 'conflict panel names the hostname', conflictText.slice(0, 90));

  step('changing the subdomain invalidates the pending conflict panel');
  await page.fill('[data-testid="cf-auto-subdomain"]', 'pubky');
  await sleep(400);
  check(
    (await page.locator('[data-testid="cf-auto-conflict"]').count()) === 0,
    'conflict panel disappears on subdomain change',
  );

  step('happy path on a clean subdomain');
  await page.click('[data-testid="cf-auto-create"]');
  await page.waitForSelector('[data-testid="cf-auto-success"]', { timeout: 20000 });
  const successText = await page.locator('[data-testid="cf-auto-success"]').textContent();
  check(successText.includes('pubky.example.com'), 'success feedback shows the hostname', successText.slice(0, 80));
  check((await env.readConfigFile('domain'))?.trim() === 'pubky.example.com', 'domain file written');
  check(((await env.readConfigFile('token')) ?? '').length > 10, 'run token marker written');
  // The locally-managed files the single cloudflared --config service runs are
  // materialized from the token (decoded into credentials.json + config.yml).
  const credsJson = await env.readConfigFile('credentials.json');
  check(!!credsJson && JSON.parse(credsJson).TunnelID === RUN_TOKEN_TID, 'credentials.json materialized from the token');
  const cfgYml = (await env.readConfigFile('config.yml')) ?? '';
  check(
    cfgYml.includes(`tunnel: ${RUN_TOKEN_TID}`) && cfgYml.includes('hostname: pubky.example.com'),
    'config.yml materialized with the tunnel id and hostname',
  );
  await page.waitForFunction(
    () => document.querySelector('[data-testid="cf-mode-badge"]')?.textContent?.trim() === 'API token',
    { timeout: 15000 },
  );
  check(true, 'Status badge flips to API token');

  step('overwrite flow end to end at taken.example.com (fresh page)');
  await openCloudflareTab(page, env.baseUrl);
  // A mode is active now, so the setup cards sit behind the disclosure.
  await page.click('[data-testid="cf-switch-method-toggle"]');
  await page.waitForSelector('[data-testid="cf-api-token-toggle"]', { timeout: 10000 });
  await page.click('[data-testid="cf-api-token-toggle"]');
  await page.waitForSelector('[data-testid="cf-auto-token"]', { timeout: 15000 });
  await page.fill('[data-testid="cf-auto-token"]', VALID_TOKEN);
  await page.click('[data-testid="cf-auto-load-zones"]');
  await page.waitForSelector('[data-testid="cf-auto-zone"]', { timeout: 15000 });
  await page.fill('[data-testid="cf-auto-subdomain"]', 'taken');
  await page.click('[data-testid="cf-auto-create"]');
  await page.waitForSelector('[data-testid="cf-auto-conflict"]', { timeout: 20000 });
  await page.click('[data-testid="cf-auto-overwrite"]');
  await page.waitForSelector('[data-testid="cf-auto-success"]', { timeout: 20000 });
  check(
    !env.cf.state.dnsRecords.some((r) => r.id === 'rec-taken'),
    'conflicting A record deleted through the real DELETE shape',
  );
  check(
    env.cf.state.dnsRecords.some((r) => r.name === 'taken.example.com' && r.type === 'CNAME'),
    'replacement CNAME created at taken.example.com',
  );

  step('manual escape hatch still reachable');
  await page.click('[data-testid="cf-manual-toggle"]');
  await sleep(300);
  check(await page.locator('#cf-domain').isVisible(), 'manual form toggles open');
});
