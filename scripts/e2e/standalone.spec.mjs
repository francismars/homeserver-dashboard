// Standalone deployment (PLATFORM unset): the Cloudflare SETUP surface is
// hidden and its routes refuse, but the read-only status views remain, and
// the copy is generic (no Umbrel wording).
import { runSpec, openSettingsDialog, gotoDashboard, check, step } from './lib/harness.mjs';

await runSpec(
  'standalone',
  async ({ env, browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    // Make the published address look like a real reachable domain so the
    // status rows render (a standalone operator may front their own proxy).
    await page.route('**/api/public-health*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );
    await gotoDashboard(page, env.baseUrl);

    step('Settings has no Cloudflare tab');
    await openSettingsDialog(page);
    check((await page.locator('button:has-text("Cloudflare")').count()) === 0, 'no Cloudflare tab in Settings');
    await page.keyboard.press('Escape');

    step('Overview: no Cloudflare CTA / reachable step, but status rows + pkarr remain');
    // Public-address reachability row is still there.
    await page.waitForSelector('[data-testid="domain-health-reachable"]', { timeout: 30000 });
    check(true, 'public-address reachability row shown');
    check((await page.locator('[data-testid="domain-health-fix"]').count()) === 0, 'no "Set up access"/"Fix it" CTA');
    check(
      (await page.locator('[data-testid="setup-step-reachable"]').count()) === 0,
      'no get-started reachable step',
    );
    // The pkarr "Pubky network" row is a status view and stays.
    await page.waitForSelector('[data-testid^="pkarr-health-"]', { timeout: 30000 });
    check(true, 'pkarr Pubky-network row shown');
    // Backup note is generic.
    const backup = (await page.locator('[data-testid="backup-note"]').textContent()) ?? '';
    check(!/umbrel/i.test(backup), 'backup note has no Umbrel wording', backup.slice(0, 60));

    step('Cloudflare setup routes refuse on standalone (404 not_supported)');
    const res = await env.api('/api/cloudflare-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enable' }),
    });
    check(res.status === 404 && res.data.type === 'not_supported', 'CF setup route 404s', `got ${res.status}`);

    step('/cloudflare-guide shows the standalone notice, not the Umbrel guide');
    const guide = await ctx.newPage();
    await guide.goto(`${env.baseUrl}/cloudflare-guide`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await guide.waitForSelector('[data-testid="cloudflare-guide-standalone"]', { timeout: 30000 });
    check(true, 'standalone guide notice shown');
  },
  { platform: 'standalone', infoDomain: 'pubky.example.com:443' },
);
