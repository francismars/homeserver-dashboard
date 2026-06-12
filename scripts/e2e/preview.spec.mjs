// Preview mode (temporary published address): limitations card, enable with
// instant URL + restart callout, the honest disable response message, and the
// on-disk marker lifecycle (testdrive.env).
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
  check(true, 'enabled state + restart callout shown');
  await page.waitForSelector('[data-testid="cf-preview-url"]', { timeout: 30000 });
  const url = await page.locator('[data-testid="cf-preview-url"] code').textContent();
  check(url.includes('.trycloudflare.com'), 'instant URL surfaced from the tunnel log', url);
  check(await env.fileExists('testdrive.env'), 'testdrive.env marker written');
  check(await env.fileExists('.testdrive.json'), 'instant tunnel state file written');

  step('disable: honest response message + clean disk state');
  const disableResponse = page.waitForResponse(
    (res) => res.url().includes('/api/cloudflare-preview') && res.request().method() === 'POST',
    { timeout: 15000 },
  );
  await page.click('[data-testid="cf-preview-disable"]');
  const disableData = await (await disableResponse).json();
  // killPid reports whether the child is actually gone; with the fake binary
  // the kill always succeeds, so the message must be the clean variant. The
  // "did not exit" variant needs an unkillable child and is asserted by the
  // route's unit tests instead.
  check(disableData.message === 'Preview disabled.', 'disable response message is honest', disableData.message);
  check(disableData.enabled === false, 'disable response reports enabled=false');
  await page.waitForSelector('[data-testid="cf-preview-enable"]', { timeout: 10000 });
  const calloutText = await page.locator('[data-testid="restart-callout"]').last().textContent();
  check(
    /turn the preview off|unpublish/i.test(calloutText),
    'post-disable restart callout shown',
    calloutText.slice(0, 70),
  );
  check(!(await env.fileExists('testdrive.env')), 'testdrive.env removed');
  check(!(await env.fileExists('.testdrive.json')), 'instant tunnel state cleared');
});
