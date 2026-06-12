// A real setup supersedes preview mode: enable preview, then complete the
// API-token setup against the mock Cloudflare API, and assert preview is
// fully torn down (marker gone, instant child killed, GET reports disabled,
// re-enable refused while the permanent setup exists).
import { runSpec, openCloudflareTab, check, step, VALID_TOKEN } from './lib/harness.mjs';

await runSpec('preview-supersede', async ({ env, browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 1100 } })).newPage();

  step('enable preview');
  await openCloudflareTab(page, env.baseUrl);
  await page.waitForSelector('[data-testid="cf-preview-enable"]', { timeout: 15000 });
  await page.click('[data-testid="cf-preview-enable"]');
  await page.waitForSelector('[data-testid="cf-preview-enabled"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="cf-preview-url"]', { timeout: 30000 });
  check(await env.fileExists('testdrive.env'), 'preview marker on disk');
  check(await env.fileExists('.testdrive.json'), 'instant tunnel running');

  step('complete a real token setup against the mock Cloudflare API');
  await page.click('[data-testid="cf-api-token-toggle"]');
  await page.waitForSelector('[data-testid="cf-auto-token"]', { timeout: 15000 });
  await page.fill('[data-testid="cf-auto-token"]', VALID_TOKEN);
  await page.click('[data-testid="cf-auto-load-zones"]');
  await page.waitForSelector('[data-testid="cf-auto-zone"]', { timeout: 15000 });
  await page.fill('[data-testid="cf-auto-subdomain"]', 'pubky');
  await page.click('[data-testid="cf-auto-create"]');
  await page.waitForSelector('[data-testid="cf-auto-success"]', { timeout: 20000 });
  check((await env.readConfigFile('domain'))?.trim() === 'pubky.example.com', 'real setup wrote the domain');
  check(((await env.readConfigFile('token')) ?? '').length > 10, 'real setup wrote the run token');

  step('preview torn down by the real setup');
  check(!(await env.fileExists('testdrive.env')), 'testdrive.env removed');
  check(!(await env.fileExists('.testdrive.json')), 'instant tunnel state cleared');
  const previewGet = await env.api('/api/cloudflare-preview');
  check(previewGet.data.enabled === false, 'GET reports preview disabled');
  check(previewGet.data.instant?.status === 'stopped', 'instant tunnel reported stopped');

  step('preview card reflects the teardown after a reload');
  await openCloudflareTab(page, env.baseUrl);
  await page.waitForFunction(
    () => document.querySelector('[data-testid="cf-mode-badge"]')?.textContent?.trim() === 'API token',
    { timeout: 15000 },
  );
  check(true, 'Status badge shows the token setup, not preview');
  // The token mode is active, so the cards sit behind the disclosure.
  await page.click('[data-testid="cf-switch-method-toggle"]');
  await page.waitForSelector('[data-testid="cf-preview-enable"]', { timeout: 15000 });
  check(true, 'enable button back (preview off)');

  step('re-enable is refused while a permanent setup exists');
  const reenable = await env.api('/api/cloudflare-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'enable' }),
  });
  check(reenable.status === 409, 'enable returns 409', `got ${reenable.status}`);
  check(
    /permanent Cloudflare setup already exists/i.test(reenable.data.error ?? ''),
    '409 explains the permanent setup',
    reenable.data.error,
  );
});
