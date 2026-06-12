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
  },
  { infoDomain: 'pubky.example.com:443' },
);
