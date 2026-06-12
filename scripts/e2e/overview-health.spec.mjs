// Overview domain-health chip: reachable / unreachable (+ "Fix it" opening
// the Cloudflare tab) / not-set-up states, driven through the real /info
// proxy with the public-health probe answered deterministically.
import { runSpec, check, step } from './lib/harness.mjs';

await runSpec(
  'overview-health',
  async ({ env, browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });

    step('reachable: probe answers ok');
    const page1 = await ctx.newPage();
    await page1.route('**/api/public-health*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );
    await page1.goto(`${env.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page1.waitForSelector('[data-testid="domain-health-reachable"]', { timeout: 30000 });
    check(true, 'reachable state shown for the published domain');
    check((await page1.locator('[data-testid="domain-health-fix"]').count()) === 0, 'no Fix it button while reachable');

    step('plain labels: jargon demoted to tooltips');
    check((await page1.locator('span[title="PKARR address"]').count()) === 1, '"Pubky address" label carries the technical term as a tooltip');
    check((await page1.locator('text=Pubky address').count()) >= 1, 'Pubky address label shown');
    check((await page1.locator('text=How Pubky apps find this server').count()) === 1, 'address helper line shown');
    check((await page1.locator('text=Public domain').count()) >= 1, 'Public domain label shown');
    check((await page1.locator('text=PKARR').count()) === 0, 'no visible PKARR jargon');

    step('get-started checklist: step states come from the admin signals');
    // Mock admin defaults: 5 signup codes, 3 users; no Cloudflare files, so
    // the server-derived mode is off and the reachable step stays pending
    // even though the domain probe answered ok.
    await page1.waitForSelector('[data-testid="setup-guide"]', { timeout: 30000 });
    const stepState = (page, id) => page.getAttribute(`[data-testid="${id}"]`, 'data-state');
    check((await stepState(page1, 'setup-step-reachable')) === 'pending', 'reachable step pending while mode is off');
    check((await stepState(page1, 'setup-step-invite')) === 'done', 'invite step done (num_signup_codes > 0)');
    check((await stepState(page1, 'setup-step-signup')) === 'done', 'signup step done (num_users > 0)');

    step('get-started checklist: fresh install has every step pending');
    const pageFresh = await ctx.newPage();
    await pageFresh.route('**/api/public-health*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false }) }),
    );
    await pageFresh.route('**/api/admin/info', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.num_users = 0;
      json.num_signup_codes = 0;
      await route.fulfill({ response: res, json });
    });
    await pageFresh.goto(`${env.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pageFresh.waitForSelector('[data-testid="setup-guide"]', { timeout: 30000 });
    check((await stepState(pageFresh, 'setup-step-reachable')) === 'pending', 'fresh install: reachable pending');
    check((await stepState(pageFresh, 'setup-step-invite')) === 'pending', 'fresh install: invite pending');
    check((await stepState(pageFresh, 'setup-step-signup')) === 'pending', 'fresh install: signup pending');
    check(
      (await pageFresh.locator('text=Your first invite is for your own account').count()) === 1,
      'first-invite copy shown',
    );

    step('get-started checklist: all steps done collapses to the all-set state');
    const pageDone = await ctx.newPage();
    await pageDone.route('**/api/public-health*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );
    await pageDone.route('**/api/cloudflare-config', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          supported: true,
          mode: 'token',
          domain: 'pubky.example.com',
          configured: true,
          restart_pending: false,
        }),
      }),
    );
    await pageDone.goto(`${env.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pageDone.waitForSelector('[data-testid="setup-guide-allset"]', { timeout: 30000 });
    check(true, 'all-set state shown when reachable, invite and signup are all done');
    check((await pageDone.locator('[data-testid="setup-guide"]').count()) === 0, 'full checklist collapsed');

    step('get-started checklist: dismissal sticks across reload, footer link restores');
    await pageDone.click('[data-testid="setup-guide-dismiss"]');
    await pageDone.waitForSelector('[data-testid="setup-guide-allset"]', { state: 'detached', timeout: 15000 });
    await pageDone.waitForSelector('[data-testid="setup-guide-link"]', { timeout: 15000 });
    check(true, 'dismissed: card gone, footer "Setup guide" link appeared');
    await pageDone.reload({ waitUntil: 'domcontentloaded' });
    await pageDone.waitForSelector('[data-testid="setup-guide-link"]', { timeout: 30000 });
    check(
      (await pageDone.locator('[data-testid="setup-guide"], [data-testid="setup-guide-allset"]').count()) === 0,
      'checklist stays dismissed after a reload',
    );
    await pageDone.click('[data-testid="setup-guide-link"]');
    await pageDone.waitForSelector('[data-testid="setup-guide-allset"]', { timeout: 15000 });
    check(true, 'footer link brings the checklist back');
    // The restore click also cleared the stored flag, so the later pages in
    // this shared context see the card again.
    await pageDone.close();

    step('unreachable: probe fails, Fix it opens the Cloudflare tab');
    const page2 = await ctx.newPage();
    await page2.route('**/api/public-health*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false }) }),
    );
    await page2.goto(`${env.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page2.waitForSelector('[data-testid="domain-health-unreachable"]', { timeout: 30000 });
    const fixLabel = (await page2.locator('[data-testid="domain-health-fix"]').textContent()).trim();
    check(fixLabel === 'Fix it', 'unreachable state offers "Fix it"', fixLabel);
    await page2.click('[data-testid="domain-health-fix"]');
    await page2.waitForSelector('[data-testid="cf-connect"], [data-testid="cf-connect-success"]', { timeout: 15000 });
    check(true, 'Fix it opened the Settings dialog on the Cloudflare tab');

    step('not set up: localhost domain');
    const page3 = await ctx.newPage();
    await page3.route('**/api/admin/info', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.pkarr_icann_domain = 'localhost:6286';
      await route.fulfill({ response: res, json });
    });
    await page3.goto(`${env.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page3.waitForSelector('[data-testid="domain-health-not-set-up"]', { timeout: 30000 });
    const setupLabel = (await page3.locator('[data-testid="domain-health-fix"]').textContent()).trim();
    check(setupLabel === 'Set up', 'not-set-up state offers "Set up"', setupLabel);
    check((await page3.locator('text=localhost:6286').count()) === 0, 'localhost value not leaked into the row');

    step('unreachable with a pending restart: "Not reachable yet", no Fix it');
    const page4 = await ctx.newPage();
    await page4.route('**/api/public-health*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false }) }),
    );
    await page4.route('**/api/cloudflare-config', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ supported: true, restart_pending: true }),
      }),
    );
    await page4.goto(`${env.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page4.waitForSelector('[data-testid="domain-health-restart-hint"]', { timeout: 30000 });
    const yetLabel = (await page4.locator('[data-testid="domain-health-unreachable"]').textContent()).trim();
    check(yetLabel.includes('Not reachable yet'), 'pending restart reads "Not reachable yet"', yetLabel);
    check((await page4.locator('[data-testid="domain-health-fix"]').count()) === 0, 'no Fix it while a restart is pending');
    const hint = (await page4.locator('[data-testid="domain-health-restart-hint"]').textContent()).trim();
    check(hint.includes('Restart the app from Umbrel to finish setup'), 'restart hint shown', hint);

    step('recovery: homeserver comes up after the page loaded');
    const page5 = await ctx.newPage();
    let adminDown = true;
    await page5.route('**/api/admin/**', (route) => {
      if (adminDown) {
        return route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'homeserver starting' }),
        });
      }
      return route.continue();
    });
    await page5.goto(`${env.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page5.waitForSelector('[data-testid="connection-error"]', { timeout: 30000 });
    check(true, 'connection error shown while the homeserver is down');
    check(
      (await page5.locator('text=Your homeserver may still be starting').count()) === 1,
      'error copy leads with the boot explanation',
    );
    const devDetails = page5.locator('[data-testid="connection-dev-details"]');
    check((await devDetails.count()) === 1, 'developer details present');
    check((await devDetails.getAttribute('open')) === null, 'developer details collapsed by default');
    check((await page5.locator('[data-testid="tab-users"]').count()) === 0, 'Users tab hidden while the homeserver is down');

    adminDown = false; // the homeserver "finishes booting"
    await page5.waitForSelector('[data-testid="connection-error"]', { state: 'detached', timeout: 30000 });
    check(true, 'connection recovered without a reload (background retry)');
    await page5.waitForSelector('[data-testid="tab-users"]', { timeout: 30000 });
    check(true, 'Users tab appeared after recovery without a reload');
  },
  { infoDomain: 'pubky.example.com:443' },
);
