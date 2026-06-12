// Connect Cloudflare account flow with the fake cloudflared binary:
// prerequisites copy on the idle card, browser-auth wait state, the
// cert-derived subdomain picker (fixture cert authorizes example.com), the
// full-hostname fallback when the cert does not parse, and the expired
// idle card.
import { promises as fs } from 'fs';
import path from 'path';
import { runSpec, openCloudflareTab, check, step, sleep, FIXTURE_CERT } from './lib/harness.mjs';

await runSpec('connect-authorized', async ({ env, browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 1100 } })).newPage();

  step('idle card shows the prerequisites copy');
  await openCloudflareTab(page, env.baseUrl);
  await page.waitForSelector('[data-testid="cf-connect-start"]', { timeout: 15000 });
  const prereqs = await page.locator('[data-testid="cf-connect-prereqs"]').textContent();
  check(
    prereqs.includes('a free Cloudflare account with your domain added'),
    'prerequisites copy present',
    prereqs.slice(0, 60),
  );
  check(
    (await page.locator('[data-testid="cf-connect"]').textContent()).includes('No domain? Try Preview mode below.'),
    'preview pointer line present',
  );

  step('start login: waiting card with auth link');
  await page.click('[data-testid="cf-connect-start"]');
  await page.waitForSelector('[data-testid="cf-connect-waiting"]', { timeout: 25000 });
  const authHref = await page.locator('[data-testid="cf-connect-auth-link"]').getAttribute('href');
  check(authHref.startsWith('https://dash.cloudflare.com/argotunnel?'), 'auth link parsed from the login log');

  step('deliver the fixture cert (authorizes example.com)');
  await fs.mkdir(path.join(env.configDir, '.cloudflared'), { recursive: true });
  await fs.copyFile(FIXTURE_CERT, path.join(env.configDir, '.cloudflared', 'cert.pem'));
  await page.waitForSelector('[data-testid="cf-connect-authorized"]', { timeout: 20000 });
  check(true, 'authorized panel appeared (cert relocated + detected)');

  step('subdomain-only input with locked suffix and suggestion chips');
  await page.waitForSelector('[data-testid="cf-connect-subdomain"]', { timeout: 5000 });
  const suffix = (await page.locator('[data-testid="cf-connect-domain-suffix"]').textContent()).trim();
  check(suffix === '.example.com', 'suffix locked to the authorized zone', suffix);
  for (const chip of ['pubky', 'hs', 'homeserver']) {
    check((await page.locator(`[data-testid="cf-connect-chip-${chip}"]`).count()) === 1, `chip "${chip}" present`);
  }
  await page.click('[data-testid="cf-connect-chip-hs"]');
  check(
    (await page.locator('[data-testid="cf-connect-subdomain"]').inputValue()) === 'hs',
    'chip fills the subdomain input',
  );

  step('dotted input is rejected client-side');
  await page.fill('[data-testid="cf-connect-subdomain"]', 'bad.dot');
  await page.waitForSelector('[data-testid="cf-connect-subdomain-invalid"]', { timeout: 5000 });
  check(
    await page.locator('[data-testid="cf-connect-complete"]').isDisabled(),
    'Finish setup disabled for an invalid subdomain',
  );

  step('complete with subdomain "pubky"');
  await page.fill('[data-testid="cf-connect-subdomain"]', 'pubky');
  await page.click('[data-testid="cf-connect-complete"]');
  await page.waitForSelector('[data-testid="cf-connect-success"]', { timeout: 30000 });
  const successText = await page.locator('[data-testid="cf-connect-success"]').textContent();
  check(successText.includes('pubky.example.com'), 'success card names the hostname', successText.slice(0, 80));

  step('completion artifacts on disk');
  const configYml = await env.readConfigFile('config.yml');
  check(
    configYml !== null && configYml.includes('hostname: pubky.example.com'),
    'config.yml written with the hostname',
  );
  check(await env.fileExists('credentials.json'), 'credentials.json written');
  check((await env.readConfigFile('domain'))?.trim() === 'pubky.example.com', 'domain file written');
  check((await env.readConfigFile('token')) === '', 'token file truncated (mode switch)');
  check(!(await env.fileExists('cert.pem')), 'authorization cert deleted after completion');
  check(!(await env.fileExists('.cloudflared')), 'scratch dir removed');

  step('domain-only save is rejected while the Connect setup exists');
  const domainOnly = await env.api('/api/cloudflare-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: 'other.example.com' }),
  });
  check(domainOnly.status === 400, 'domain-only POST returns 400', `got ${domainOnly.status}`);
  check(
    /managed by the Connect/i.test(domainOnly.data.error ?? ''),
    'rejection explains the Connect-managed domain',
    domainOnly.data.error,
  );

  step('fallback path: unparseable cert keeps the full-hostname input');
  const disconnect = await env.api('/api/cloudflare-disconnect', { method: 'POST' });
  check(disconnect.status === 200, 'disconnect resets the setup for the second pass');
  await openCloudflareTab(page, env.baseUrl);
  await page.waitForSelector('[data-testid="cf-connect-start"]', { timeout: 15000 });
  await page.click('[data-testid="cf-connect-start"]');
  await page.waitForSelector('[data-testid="cf-connect-waiting"]', { timeout: 25000 });
  await fs.mkdir(path.join(env.configDir, '.cloudflared'), { recursive: true });
  await fs.writeFile(path.join(env.configDir, '.cloudflared', 'cert.pem'), 'NOT-A-PARSEABLE-CERT', 'utf-8');
  await page.waitForSelector('[data-testid="cf-connect-authorized"]', { timeout: 20000 });
  check(
    (await page.locator('[data-testid="cf-connect-hostname"]').count()) === 1,
    'full-hostname input shown when authorized_domain is null',
  );
  check(
    (await page.locator('[data-testid="cf-connect-subdomain"]').count()) === 0,
    'subdomain picker absent without a parsed zone',
  );

  step('expired authorization: idle card explains why');
  await env.api('/api/cloudflare-connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel' }),
  });
  // An unused cert older than the 15-minute window expires on the next read.
  const certPath = path.join(env.configDir, 'cert.pem');
  await fs.writeFile(certPath, 'STALE-CERT', 'utf-8');
  const past = new Date(Date.now() - 16 * 60 * 1000);
  await fs.utimes(certPath, past, past);
  await openCloudflareTab(page, env.baseUrl);
  await page.waitForSelector('[data-testid="cf-connect-expired"]', { timeout: 15000 });
  const expiredText = await page.locator('[data-testid="cf-connect-expired"]').textContent();
  check(/authorization link expired/i.test(expiredText), 'expired idle card shown', expiredText.trim());
  await sleep(200);
  check(!(await env.fileExists('cert.pem')), 'stale cert reaped on read');
});
