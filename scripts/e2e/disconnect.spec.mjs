// Disconnect from a completed Connect (locally-managed) setup, asserting the
// single-surface model: the Status section is the only place that says
// "connected" (mode badge + domain + one reachability chip + ONE disconnect
// button); the setup cards sit behind a "Switch setup method" disclosure as
// pure actions. Then: two-click confirm, full on-disk reset (config.yml,
// credentials, token/domain files, homeserver icann_domain), the cards
// returning as direct actions, and the domain-only save rejection afterwards.
//
// Also the durable restart-pending signal and the published-vs-reachable
// split: state newer than the wrapper boot stamp keeps the restart callout
// up EVEN while HTTPS works (publication is /info truth, not reachability);
// a simulated wrapper run (newer stamp + /info advertising the domain)
// clears it; a disconnect re-arms it, surviving a full page reload.
import { promises as fs } from 'fs';
import path from 'path';
import { runSpec, openCloudflareTab, gotoDashboard, check, step } from './lib/harness.mjs';

await runSpec(
  'disconnect',
  async ({ env, browser }) => {
    step('wrapper booted 5 minutes ago; then a completed Connect setup landed on disk');
    await env.writeBootStamp(new Date(Date.now() - 5 * 60_000));
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
    // The Status surface probes the configured domain on open; answer
    // "reachable" - the point of the durable signal is that HTTPS working
    // must NOT suppress the publication callout.
    await page.route('**/api/public-health*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );

    step('Status is the single surface asserting the connected state');
    await openCloudflareTab(page, env.baseUrl);
    await page.waitForSelector('[data-testid="cf-mode-badge"]', { timeout: 15000 });
    const badge = (await page.locator('[data-testid="cf-mode-badge"]').textContent()).trim();
    check(badge === 'Connected account', 'mode badge says Connected account', badge);
    const address = (await page.locator('[data-testid="cf-status-address"]').textContent()).trim();
    check(address === 'pubky.example.com', 'Status shows the domain', address);
    await page.waitForSelector('[data-testid="cf-status-reachable"]', { timeout: 20000 });
    check(true, 'one reachability chip, fed by the probe');
    check((await page.locator('[data-testid="cf-disconnect"]').count()) === 1, 'exactly one Disconnect button');
    check((await page.locator('[data-testid="cf-connect-success"]').count()) === 0, 'no per-card success state');

    step('setup newer than the boot stamp: restart callout despite HTTPS reachability');
    const preBoot = await env.api('/api/cloudflare-config');
    check(preBoot.data.restart_pending === true, 'restart_pending true (state newer than the stamp)');
    check(preBoot.data.restart_reason === 'setup_changed', 'reason is setup_changed', preBoot.data.restart_reason);
    await page.waitForSelector('[role="dialog"] [data-testid="restart-callout"]', { timeout: 15000 });
    const publishCallout = await page.locator('[role="dialog"] [data-testid="restart-callout"]').textContent();
    check(
      /publishes your public address/i.test(publishCallout),
      'callout asks for a restart to publish, not to reconnect',
      publishCallout.slice(0, 80),
    );
    const unpublished = (await page.locator('[data-testid="cf-status-unpublished"]').textContent()).trim();
    check(unpublished === 'Restart to publish', '/info still on localhost: Restart to publish', unpublished);

    step('simulate the wrapper run: newer boot stamp + /info advertises the domain');
    await env.writeBootStamp();
    env.admin.info.pkarr_icann_domain = 'pubky.example.com:443';
    await openCloudflareTab(page, env.baseUrl);
    await page.waitForSelector('[data-testid="cf-status-published"]', { timeout: 20000 });
    const published = (await page.locator('[data-testid="cf-status-published"]').textContent()).trim();
    check(published === 'Published', '/info matches the configured domain: Published', published);
    check(
      (await page.locator('[data-testid="restart-callout"]').count()) === 0,
      'restart callout gone everywhere (Overview included)',
    );
    const postBoot = await env.api('/api/cloudflare-config');
    check(postBoot.data.restart_pending === false, 'restart_pending false once the stamp is newest');

    step('setup cards are demoted to pure actions behind the disclosure');
    check((await page.locator('[data-testid="cf-connect"]').count()) === 0, 'cards collapsed while a mode is active');
    await page.click('[data-testid="cf-switch-method-toggle"]');
    await page.waitForSelector('[data-testid="cf-connect-start"]', { timeout: 10000 });
    check(true, 'Connect card is a pure action inside the disclosure');
    check(
      (await page.locator('[data-testid="cf-connect-success"]').count()) === 0,
      'no duplicate connected claim inside the cards',
    );
    check((await page.locator('[data-testid="cf-disconnect"]').count()) === 1, 'still only the Status disconnect');

    step('two-click disconnect on the Status surface');
    await page.click('[data-testid="cf-disconnect"]');
    const armed = await page.locator('[data-testid="cf-disconnect"]').textContent();
    check(/confirm/i.test(armed), 'first click arms the confirmation', armed.trim());
    await page.click('[data-testid="cf-disconnect"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="cf-mode-badge"]')?.textContent?.trim() === 'Off',
      { timeout: 15000 },
    );
    check(true, 'mode badge back to Off');
    const callout = await page.locator('[role="dialog"] [data-testid="restart-callout"]').first().textContent();
    check(/Disconnected/.test(callout), 'post-disconnect restart callout on the Status surface', callout.slice(0, 60));
    check((await page.locator('[data-testid="cf-disconnect"]').count()) === 0, 'Disconnect button gone');
    check(
      (await page.locator('[data-testid="cf-switch-method-toggle"]').count()) === 0,
      'disclosure gone: cards are direct again',
    );
    await page.waitForSelector('[data-testid="cf-connect-start"]', { timeout: 15000 });
    check(
      (await page.locator('[data-testid="cf-connect-success"]').count()) === 0,
      'no card claims connected after disconnect (the old contradiction)',
    );

    step('disk state actually reset');
    check(!(await env.fileExists('config.yml')), 'config.yml removed');
    check(!(await env.fileExists('credentials.json')), 'credentials.json removed');
    check((await env.readConfigFile('domain')) === '', 'domain file truncated');
    check((await env.readConfigFile('token')) === '', 'token file truncated');
    const hsConfig = await fs.readFile(env.hsConfigPath, 'utf-8');
    check(hsConfig.includes('icann_domain = "localhost"'), 'icann_domain reset to localhost');
    check(!hsConfig.includes('public_icann_http_port'), 'public_icann_http_port line removed');

    step('disconnect re-arms the durable signal; it survives a full reload');
    const postDisconnect = await env.api('/api/cloudflare-config');
    check(postDisconnect.data.restart_pending === true, 'restart_pending true again after the disconnect');
    await gotoDashboard(page, env.baseUrl);
    await page.waitForSelector('[data-testid="restart-callout"]', { timeout: 30000 });
    const overviewCallout = await page.locator('[data-testid="restart-callout"]').first().textContent();
    check(
      /Restart the Pubky Homeserver app from Umbrel/.test(overviewCallout),
      'Overview shows the restart callout after a reload',
      overviewCallout.slice(0, 60),
    );
    await openCloudflareTab(page, env.baseUrl);
    await page.waitForSelector('[role="dialog"] [data-testid="restart-callout"]', { timeout: 15000 });
    const dialogCallout = await page
      .locator('[role="dialog"] [data-testid="restart-callout"]')
      .first()
      .textContent();
    check(
      /Restart the Pubky Homeserver app from Umbrel/.test(dialogCallout),
      'Status callout persists across the reload (no session state)',
      dialogCallout.slice(0, 60),
    );

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
