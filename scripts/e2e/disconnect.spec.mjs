// Disconnect flow from a completed Connect (locally-managed) setup:
// self-dismissing restart callout when the domain is reachable, two-click
// confirm, full on-disk reset (config.yml, credentials, token/domain files,
// homeserver icann_domain), and the domain-only save rejection afterwards.
import { promises as fs } from 'fs';
import path from 'path';
import { runSpec, openCloudflareTab, check, step } from './lib/harness.mjs';

await runSpec(
  'disconnect',
  async ({ env, browser }) => {
    step('seed a completed Connect setup on disk');
    const configYml = [
      'tunnel: e2e-local-tunnel-id',
      'credentials-file: /etc/cloudflared-config/credentials.json',
      'no-autoupdate: true',
      'ingress:',
      '  - hostname: pubky.example.com',
      '    service: http://homeserver:6286',
      '  - service: http_status:404',
      '',
    ].join('\n');
    await fs.writeFile(path.join(env.configDir, 'config.yml'), configYml, 'utf-8');
    await fs.writeFile(
      path.join(env.configDir, 'credentials.json'),
      '{"AccountTag":"e2e","TunnelSecret":"x","TunnelID":"e2e-local-tunnel-id"}',
      'utf-8',
    );
    await fs.writeFile(path.join(env.configDir, 'domain'), 'pubky.example.com', 'utf-8');
    await fs.writeFile(path.join(env.configDir, 'token'), '', 'utf-8');

    const page = await (await browser.newContext({ viewport: { width: 1200, height: 1100 } })).newPage();
    // The completed card probes the published hostname; answer "reachable"
    // so the restart callout self-dismisses (field-feedback behavior).
    await page.route('**/api/public-health*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );

    step('completed card with self-dismissed callout');
    await openCloudflareTab(page, env.baseUrl);
    await page.waitForSelector('[data-testid="cf-connect-success"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="cf-connect-live"]', { timeout: 20000 });
    const calloutsInCard = await page
      .locator('[data-testid="cf-connect-success"] [data-testid="restart-callout"]')
      .count();
    check(calloutsInCard === 0, 'reachable domain: no restart callout inside the success card');

    step('two-click disconnect');
    await page.click('[data-testid="cf-connect-disconnect"]');
    const armed = await page.locator('[data-testid="cf-connect-disconnect"]').textContent();
    check(/confirm/i.test(armed), 'first click arms the confirmation', armed.trim());
    await page.click('[data-testid="cf-connect-disconnect"]');
    await page.waitForSelector('[data-testid="cf-connect-start"]', { timeout: 15000 });
    check(true, 'Connect card back to idle');
    const callout = await page.locator('[data-testid="restart-callout"]').first().textContent();
    check(/Disconnected/.test(callout), 'post-disconnect restart callout shown', callout.slice(0, 60));

    step('disk state actually reset');
    check(!(await env.fileExists('config.yml')), 'config.yml removed');
    check(!(await env.fileExists('credentials.json')), 'credentials.json removed');
    check((await env.readConfigFile('domain')) === '', 'domain file truncated');
    check((await env.readConfigFile('token')) === '', 'token file truncated');
    const hsConfig = await fs.readFile(env.hsConfigPath, 'utf-8');
    check(hsConfig.includes('icann_domain = "localhost"'), 'icann_domain reset to localhost');
    check(!hsConfig.includes('public_icann_http_port'), 'public_icann_http_port line removed');

    step('domain-only save is rejected after disconnect (no token left)');
    const domainOnly = await env.api('/api/cloudflare-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'again.example.com' }),
    });
    check(domainOnly.status === 400, 'domain-only POST returns 400', `got ${domainOnly.status}`);
    check(/token is required/i.test(domainOnly.data.error ?? ''), 'rejection names the missing token');
  },
  { hsDomain: 'pubky.example.com', hsPort: true },
);
