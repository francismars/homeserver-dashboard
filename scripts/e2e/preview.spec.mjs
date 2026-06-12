// Preview mode (temporary published address): limitations card, enable with
// instant URL + restart callout + Status surface pickup, the honest disable
// response message (API), the on-disk marker lifecycle (testdrive.env), and
// turning preview off through the single Status-surface Disconnect.
import { runSpec, openCloudflareTab, check, step, sleep } from './lib/harness.mjs';

await runSpec('preview', async ({ env, browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 1100 } })).newPage();

  step('open the Cloudflare tab');
  await openCloudflareTab(page, env.baseUrl);
  await page.waitForSelector('[data-testid="cf-preview"]', { timeout: 15000 });

  step('limitations expandable');
  await page.click('[data-testid="cf-preview-limitations"]');
  await sleep(300);
  const lims = await page.locator('[data-testid="cf-preview"] ul li').count();
  check(lims >= 5, 'limitations listed', `${lims} items`);

  step('enable: instant URL + loud restart callout + marker on disk');
  await page.click('[data-testid="cf-preview-enable"]');
  await page.waitForSelector('[data-testid="cf-preview-enabled"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="restart-callout"]', { timeout: 5000 });
  check(true, 'enabled feedback + restart callout shown');
  await page.waitForSelector('[data-testid="cf-preview-url"]', { timeout: 30000 });
  const url = await page.locator('[data-testid="cf-preview-url"] code').textContent();
  check(url.includes('.trycloudflare.com'), 'instant URL surfaced from the tunnel log', url);
  check(await env.fileExists('testdrive.env'), 'testdrive.env marker written');
  check(await env.fileExists('.testdrive.json'), 'instant tunnel state file written');

  step('Status surface picks up preview mode');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="cf-mode-badge"]')?.textContent?.trim() === 'Preview',
    { timeout: 15000 },
  );
  check(true, 'mode badge says Preview');
  await page.waitForFunction(
    () =>
      (document.querySelector('[data-testid="cf-status-address"]')?.textContent ?? '').includes('.trycloudflare.com'),
    { timeout: 15000 },
  );
  check(true, 'Status shows the temporary address');

  step('disable (API): honest response message + clean disk state');
  const disable = await env.api('/api/cloudflare-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'disable' }),
  });
  // killPid reports whether the child is actually gone; with the fake binary
  // the kill always succeeds, so the message must be the clean variant. The
  // "did not exit" variant needs an unkillable child and is asserted by the
  // route's unit tests instead.
  check(disable.data.message === 'Preview disabled.', 'disable response message is honest', disable.data.message);
  check(disable.data.enabled === false, 'disable response reports enabled=false');
  check(!(await env.fileExists('testdrive.env')), 'testdrive.env removed');
  check(!(await env.fileExists('.testdrive.json')), 'instant tunnel state cleared');

  step('a fresh open reflects the off state');
  await openCloudflareTab(page, env.baseUrl);
  await page.waitForSelector('[data-testid="cf-mode-badge"]', { timeout: 15000 });
  const badge = (await page.locator('[data-testid="cf-mode-badge"]').textContent()).trim();
  check(badge === 'Off', 'mode badge back to Off', badge);
  await page.waitForSelector('[data-testid="cf-preview-enable"]', { timeout: 10000 });
  check(true, 'preview card back to its pure enable action');

  step('Status-surface Disconnect also turns preview off');
  await page.click('[data-testid="cf-preview-enable"]');
  await page.waitForSelector('[data-testid="cf-preview-enabled"]', { timeout: 15000 });
  check(await env.fileExists('testdrive.env'), 'preview re-enabled');
  await page.waitForSelector('[data-testid="cf-disconnect"]', { timeout: 15000 });
  await page.click('[data-testid="cf-disconnect"]');
  await page.click('[data-testid="cf-disconnect"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="cf-mode-badge"]')?.textContent?.trim() === 'Off',
    { timeout: 15000 },
  );
  check(true, 'disconnect resets the badge to Off');
  check(!(await env.fileExists('testdrive.env')), 'marker removed by disconnect');
  check(!(await env.fileExists('.testdrive.json')), 'instant tunnel state cleared by disconnect');
});
