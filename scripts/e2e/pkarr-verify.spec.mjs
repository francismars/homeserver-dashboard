// Overview "Pubky network" row: the dashboard fetches the homeserver's PKARR
// record from the (mock) pkarr relay, verifies the real ed25519 signature,
// reconciles it against /info, and renders verified / mismatch / not_found /
// unavailable - plus the View dialog with the parsed record.
import { runSpec, check, step } from './lib/harness.mjs';
import { buildHomeserverRecord } from './lib/mock-pkarr-relay.mjs';

await runSpec('pkarr-verify', async ({ env, browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });

  // A real signed record (fresh keypair) seeded into the mock relay, with
  // /info reporting matching expectations.
  const record = buildHomeserverRecord({ ip: '203.0.113.7', port: 6287, domain: 'pubky.example.com' });
  env.pkarrRelay.setRecord(record.pubkey, record.payload);
  env.admin.info.public_key = record.pubkey;
  env.admin.info.pkarr_pubky_address = '203.0.113.7:6287';
  env.admin.info.pkarr_icann_domain = 'pubky.example.com:443';

  const newPage = async () => {
    const page = await ctx.newPage();
    // The domain-health probe would hit the real pubky.example.com.
    await page.route('**/api/public-health*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );
    await page.goto(`${env.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    return page;
  };

  step('verified: record matches /info expectations');
  const page1 = await newPage();
  await page1.waitForSelector('[data-testid="pkarr-health-verified"]', { timeout: 30000 });
  check(true, 'Published chip shown (signature verified server-side)');
  check(
    env.pkarrRelay.requests.includes(record.pubkey),
    'the mock relay actually served the record',
    `asked for: ${[...new Set(env.pkarrRelay.requests)].join(', ')}`,
  );

  step('View dialog: parsed record table + age + pkdns link');
  await page1.click('[data-testid="pkarr-view-record"]');
  await page1.waitForSelector('[data-testid="pkarr-record-viewer"]', { timeout: 10000 });
  const recordsText = await page1.locator('[data-testid="pkarr-viewer-records"]').textContent();
  check(recordsText.includes('HTTPS'), 'records table lists the HTTPS record');
  check(recordsText.includes('port=6287'), 'HTTPS record shows the published port');
  check(recordsText.includes('ipv4hint=203.0.113.7'), 'HTTPS record shows the published IP');
  check(recordsText.includes('pubky.example.com'), 'records table lists the domain record');
  const age = await page1.locator('[data-testid="pkarr-viewer-age"]').textContent();
  check(/Published .*ago/.test(age), 'age line present', age.trim());
  check(
    (await page1.locator('[data-testid="pkarr-viewer-mismatch"]').count()) === 0,
    'no mismatch box when verified',
  );
  const pkdnsHref = await page1.locator('[data-testid="pkarr-viewer-pkdns-link"]').getAttribute('href');
  check(pkdnsHref === `https://pkdns.net/?id=${record.pubkey}`, 'pkdns.net link targets this pubkey', pkdnsHref);
  await page1.keyboard.press('Escape');
  await page1.close();

  step('mismatch: /info now claims a different domain');
  env.admin.info.pkarr_icann_domain = 'moved.example.org:443';
  const page2 = await newPage();
  await page2.waitForSelector('[data-testid="pkarr-health-mismatch"]', { timeout: 30000 });
  check(true, "Doesn't match config chip shown");
  await page2.click('[data-testid="pkarr-view-record"]');
  await page2.waitForSelector('[data-testid="pkarr-viewer-mismatch"]', { timeout: 10000 });
  const cmp = await page2.locator('[data-testid="pkarr-viewer-mismatch"]').textContent();
  check(cmp.includes('moved.example.org'), 'comparison shows the configured value', cmp.slice(0, 120));
  check(cmp.includes('pubky.example.com'), 'comparison shows the published value');
  await page2.close();

  step('not_found: a pubkey with no record on the relay');
  const unpublished = buildHomeserverRecord({}); // keypair only; never seeded
  env.admin.info.public_key = unpublished.pubkey;
  env.admin.info.pkarr_icann_domain = 'pubky.example.com:443';
  const page3 = await newPage();
  await page3.waitForSelector('[data-testid="pkarr-health-not-found"]', { timeout: 30000 });
  check(true, 'Not published chip shown');
  check((await page3.locator('[data-testid="pkarr-view-record"]').count()) === 0, 'no View button without a record');

  step('re-check button asks the relay again');
  const asksBefore = env.pkarrRelay.requests.length;
  await page3.click('[data-testid="pkarr-health-recheck"]');
  await page3.waitForSelector('[data-testid="pkarr-health-not-found"]', { timeout: 30000 });
  check(env.pkarrRelay.requests.length > asksBefore, 'relay was queried again', `${asksBefore} -> ${env.pkarrRelay.requests.length}`);
  await page3.close();

  step('unavailable: relay down is not blamed on the server');
  await env.pkarrRelay.close();
  const page4 = await newPage();
  await page4.waitForSelector('[data-testid="pkarr-health-unavailable"]', { timeout: 30000 });
  const title = await page4.locator('[data-testid="pkarr-health-unavailable"]').getAttribute('title');
  check(title.includes('does not mean anything is wrong'), 'copy does not blame the server');
});
