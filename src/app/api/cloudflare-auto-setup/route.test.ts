// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { POST as autoSetupPost } from './route';
import { POST as zonesPost } from './zones/route';
import { GET as previewGet } from '../cloudflare-preview/route';

const TOKEN = 'cf-test-token-abcdefghijklmnop';
const ZONE_ID = 'a'.repeat(32);
const ACCOUNT_ID = 'acc-1';
const TUNNEL_ID = 'tun-uuid-1';

/** A real cloudflared-format run token (base64 of {a,s,t}); the route now
 * decodes it into credentials.json, so test tokens must be decodable. */
function mkToken(tid = '2043373f-18dd-4616-b30e-7f9d0e9d8bc6'): string {
  const secret = Buffer.alloc(32, 1).toString('base64');
  return Buffer.from(JSON.stringify({ a: 'acct', s: secret, t: tid }), 'utf-8').toString('base64');
}
const RUN_TOKEN_GET = mkToken();
const RUN_TOKEN_INLINE = mkToken('11111111-1111-4111-8111-111111111111');
const TOKEN_TID = '2043373f-18dd-4616-b30e-7f9d0e9d8bc6';

type MockRule = {
  match: (method: string, url: string) => boolean;
  reply: (method: string, url: string, body?: unknown) => { status?: number; json: unknown };
};

function cfOk(result: unknown) {
  return { status: 200, json: { success: true, errors: [], result } };
}
function cfErr(status: number, code: number, message: string) {
  return { status, json: { success: false, errors: [{ code, message }], result: null } };
}

/** Standard happy-path Cloudflare mock; tests override individual rules. */
function makeRules(overrides: Partial<Record<string, MockRule['reply']>> = {}): MockRule[] {
  const table: Array<[string, (m: string, u: string) => boolean, MockRule['reply']]> = [
    [
      'getZone',
      (m, u) => m === 'GET' && u.includes(`/zones/${ZONE_ID}`) && !u.includes('dns_records'),
      () => cfOk({ id: ZONE_ID, name: 'example.com', status: 'active', account: { id: ACCOUNT_ID } }),
    ],
    ['listTunnels', (m, u) => m === 'GET' && u.includes('/cfd_tunnel?'), () => cfOk([])],
    [
      // Per the API reference, the create response does NOT include a token
      // field (the GET .../token endpoint exists for that). Some guide pages
      // suggest otherwise; the route handles both, and the default mock
      // mirrors the reference schema.
      'createTunnel',
      (m, u) => m === 'POST' && u.endsWith('/cfd_tunnel'),
      () => cfOk({ id: TUNNEL_ID, name: 'pubky-homeserver', remote_config: true }),
    ],
    [
      'getTunnelToken',
      (m, u) => m === 'GET' && u.includes(`/cfd_tunnel/${TUNNEL_ID}/token`),
      () => cfOk(RUN_TOKEN_GET),
    ],
    ['putIngress', (m, u) => m === 'PUT' && u.includes(`/cfd_tunnel/${TUNNEL_ID}/configurations`), () => cfOk({})],
    ['listDns', (m, u) => m === 'GET' && u.includes('/dns_records?'), () => cfOk([])],
    [
      'createDns',
      (m, u) => m === 'POST' && u.endsWith('/dns_records'),
      () => cfOk({ id: 'rec-1', type: 'CNAME', name: 'pubky.example.com', content: `${TUNNEL_ID}.cfargotunnel.com` }),
    ],
    ['updateDns', (m, u) => m === 'PUT' && u.includes('/dns_records/'), () => cfOk({ id: 'rec-1' })],
    ['deleteDns', (m, u) => m === 'DELETE' && u.includes('/dns_records/'), () => cfOk({ id: 'rec-1' })],
  ];
  return table.map(([key, match, reply]) => ({ match, reply: overrides[key] ?? reply }));
}

function installFetchMock(rules: MockRule[], calls: Array<{ method: string; url: string; body?: unknown }>) {
  vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const rule = rules.find((r) => r.match(method, url));
    if (!rule) throw new Error(`Unmatched mock call: ${method} ${url}`);
    const { status = 200, json } = rule.reply(method, url, body);
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  });
}

describe('cloudflare-auto-setup route', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;
  let calls: Array<{ method: string; url: string; body?: unknown }>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-auto-test-'));
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
    process.env.PLATFORM = 'umbrel'; // these flows are Umbrel-only; keep happy-paths on umbrel
    calls = [];
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // The route reads CLOUDFLARE_CONFIG_DIR lazily (per request), so tests just
  // set the env var; no module-registry tricks needed.
  async function post(body: unknown) {
    return autoSetupPost(
      new NextRequest('http://localhost:8080/api/cloudflare-auto-setup', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  const validBody = { api_token: TOKEN, zone_id: ZONE_ID, subdomain: 'pubky' };

  it('refuses on standalone with 404 not_supported', async () => {
    process.env.PLATFORM = 'standalone';
    const res = await post(validBody);
    expect(res.status).toBe(404);
    expect((await res.json()).type).toBe('not_supported');
  });
  it('happy path: creates tunnel, ingress, DNS, writes files', async () => {
    installFetchMock(makeRules(), calls);
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.hostname).toBe('pubky.example.com');
    expect(data.steps).toEqual([
      { key: 'tunnel', status: 'done', detail: 'Tunnel created' },
      { key: 'ingress', status: 'done' },
      { key: 'dns', status: 'done' },
      { key: 'credentials', status: 'done' },
    ]);
    // Run token fetched via the dedicated GET (create responses do not carry it),
    // kept as the setup-method marker.
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe(RUN_TOKEN_GET);
    expect(await fs.readFile(path.join(tmpDir, 'domain'), 'utf-8')).toBe('pubky.example.com');
    // The locally-managed files that the single cloudflared --config service
    // actually runs are materialized from the token.
    const creds = JSON.parse(await fs.readFile(path.join(tmpDir, 'credentials.json'), 'utf-8'));
    expect(creds.TunnelID).toBe(TOKEN_TID);
    const configYml = await fs.readFile(path.join(tmpDir, 'config.yml'), 'utf-8');
    expect(configYml).toContain(`tunnel: ${TOKEN_TID}`);
    expect(configYml).toContain('hostname: pubky.example.com');
    expect(configYml).toContain('service: http://homeserver:6286');
    expect(calls.some((c) => c.method === 'GET' && c.url.includes(`/cfd_tunnel/${TUNNEL_ID}/token`))).toBe(true);
    // Ingress body shape matches the documented config schema
    const ingressCall = calls.find((c) => c.method === 'PUT' && c.url.includes('/configurations'));
    expect(ingressCall?.body).toEqual({
      config: {
        ingress: [{ hostname: 'pubky.example.com', service: 'http://homeserver:6286' }, { service: 'http_status:404' }],
      },
    });
    // DNS body shape
    const dnsCall = calls.find((c) => c.method === 'POST' && c.url.endsWith('/dns_records'));
    expect(dnsCall?.body).toEqual({
      type: 'CNAME',
      proxied: true,
      name: 'pubky.example.com',
      content: `${TUNNEL_ID}.cfargotunnel.com`,
    });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('fresh setup (mode off at entry): message says the tunnel connects on its own', async () => {
    installFetchMock(makeRules(), calls);
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.message).toContain('The tunnel connects within a minute');
    expect(data.message).toContain('publishes your public address');
    expect(data.message).not.toContain('unreachable');
  });

  it('re-setup over a working setup: message warns the domain stays unreachable until restart', async () => {
    // A live token setup at entry: the running cloudflared never re-reads
    // the token file, so DNS now points at a tunnel with no connector.
    await fs.writeFile(path.join(tmpDir, 'token'), 'previous-run-token-aaaaaaaaaaaaaaaaaaaa', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'domain'), 'old.example.com', 'utf-8');
    installFetchMock(makeRules(), calls);
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.message).toContain('unreachable until the app restarts');
    expect(data.message).not.toContain('connects within a minute');
  });

  it('maps a Cloudflare 429 to a friendly rate-limit message', async () => {
    installFetchMock(makeRules({ getZone: () => cfErr(429, 971, 'rate limited') }), calls);
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(429);
    expect(data.error).toBe('Cloudflare is rate limiting requests. Wait a minute and try again.');
  });

  it('apex: empty subdomain routes the zone itself', async () => {
    installFetchMock(makeRules(), calls);
    const res = await post({ api_token: TOKEN, zone_id: ZONE_ID });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.hostname).toBe('example.com');
  });

  it('adopts an existing tunnel and fetches its token via GET', async () => {
    installFetchMock(
      makeRules({
        listTunnels: () => cfOk([{ id: TUNNEL_ID, name: 'pubky-homeserver' }]),
      }),
      calls,
    );
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.steps[0]).toEqual({ key: 'tunnel', status: 'done', detail: 'Reusing existing tunnel' });
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/cfd_tunnel'))).toBe(false);
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe(RUN_TOKEN_GET);
  });

  it('DNS conflict without overwrite returns 409 BEFORE any account mutation', async () => {
    installFetchMock(
      makeRules({
        listDns: () => cfOk([{ id: 'rec-9', type: 'A', name: 'pubky.example.com', content: '1.2.3.4' }]),
      }),
      calls,
    );
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.type).toBe('dns_conflict');
    expect(data.existing_records).toEqual([{ type: 'A', content: '1.2.3.4' }]);
    // Cancelling at the prompt must have zero side effects: no tunnel
    // create/adopt, no ingress rewrite, nothing written to disk.
    expect(calls.some((c) => c.url.includes('cfd_tunnel'))).toBe(false);
    await expect(fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).rejects.toThrow();
  });

  it('MX and TXT records at the hostname are NOT conflicts and are never touched', async () => {
    installFetchMock(
      makeRules({
        listDns: () =>
          cfOk([
            { id: 'rec-mx', type: 'MX', name: 'example.com', content: 'mail.example.com' },
            { id: 'rec-txt', type: 'TXT', name: 'example.com', content: 'v=spf1 ...' },
          ]),
      }),
      calls,
    );
    // Apex setup with mail records present: must proceed without confirmation
    const res = await post({ api_token: TOKEN, zone_id: ZONE_ID });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.hostname).toBe('example.com');
    // The mail records must never be deleted or modified
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('dns_records'))).toBe(false);
  });

  it('stale tunnel CNAME (*.cfargotunnel.com) is repointed without confirmation', async () => {
    installFetchMock(
      makeRules({
        listDns: () =>
          cfOk([{ id: 'rec-old', type: 'CNAME', name: 'pubky.example.com', content: 'old-tunnel.cfargotunnel.com' }]),
      }),
      calls,
    );
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.steps.find((s: { key: string }) => s.key === 'dns').detail).toBe('Existing record repointed');
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/dns_records/rec-old'))).toBe(true);
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/dns_records'))).toBe(false);
  });

  it('refuses to adopt a locally-managed tunnel of the same name', async () => {
    installFetchMock(
      makeRules({
        listTunnels: () => cfOk([{ id: TUNNEL_ID, name: 'pubky-homeserver', remote_config: false }]),
      }),
      calls,
    );
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toContain('locally-managed');
    // No ingress rewrite of a tunnel we do not manage
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/configurations'))).toBe(false);
  });

  it('refuses to adopt a tunnel reporting config_src "local" even without remote_config', async () => {
    installFetchMock(
      makeRules({
        listTunnels: () => cfOk([{ id: TUNNEL_ID, name: 'pubky-homeserver', config_src: 'local' }]),
      }),
      calls,
    );
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toContain('locally-managed');
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/configurations'))).toBe(false);
  });

  it('uses a token from the create response when present (skips the GET)', async () => {
    installFetchMock(
      makeRules({
        createTunnel: () => cfOk({ id: TUNNEL_ID, name: 'pubky-homeserver', token: RUN_TOKEN_INLINE }),
      }),
      calls,
    );
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.method === 'GET' && c.url.includes(`/cfd_tunnel/${TUNNEL_ID}/token`))).toBe(false);
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe(RUN_TOKEN_INLINE);
  });

  it('tolerates the DNS-delete bare envelope (no success field)', async () => {
    installFetchMock(
      makeRules({
        listDns: () => cfOk([{ id: 'rec-9', type: 'A', name: 'pubky.example.com', content: '1.2.3.4' }]),
        // Real Cloudflare DELETE responses carry only {"result": {"id"}}
        deleteDns: () => ({ status: 200, json: { result: { id: 'rec-9' } } }),
      }),
      calls,
    );
    const res = await post({ ...validBody, overwrite_dns: true });
    expect(res.status).toBe(200);
  });

  it('DNS conflict with overwrite replaces an A record (delete + create)', async () => {
    installFetchMock(
      makeRules({
        listDns: () => cfOk([{ id: 'rec-9', type: 'A', name: 'pubky.example.com', content: '1.2.3.4' }]),
      }),
      calls,
    );
    const res = await post({ ...validBody, overwrite_dns: true });
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/dns_records/rec-9'))).toBe(true);
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/dns_records'))).toBe(true);
  });

  it('DNS conflict with overwrite updates a foreign CNAME in place', async () => {
    installFetchMock(
      makeRules({
        listDns: () => cfOk([{ id: 'rec-9', type: 'CNAME', name: 'pubky.example.com', content: 'other.example.net' }]),
      }),
      calls,
    );
    const res = await post({ ...validBody, overwrite_dns: true });
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/dns_records/rec-9'))).toBe(true);
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/dns_records'))).toBe(false);
  });

  it('idempotent re-run: our CNAME already in place, no DNS writes', async () => {
    installFetchMock(
      makeRules({
        listDns: () =>
          cfOk([{ id: 'rec-1', type: 'CNAME', name: 'pubky.example.com', content: `${TUNNEL_ID}.cfargotunnel.com` }]),
        listTunnels: () => cfOk([{ id: TUNNEL_ID, name: 'pubky-homeserver' }]),
      }),
      calls,
    );
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.steps.find((s: { key: string }) => s.key === 'dns').detail).toBe('DNS record already in place');
    expect(calls.some((c) => ['POST', 'PUT', 'DELETE'].includes(c.method) && c.url.includes('dns_records'))).toBe(
      false,
    );
  });

  it('inactive zone fails with an actionable message', async () => {
    installFetchMock(
      makeRules({
        getZone: () => cfOk({ id: ZONE_ID, name: 'example.com', status: 'pending', account: { id: ACCOUNT_ID } }),
      }),
      calls,
    );
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('nameservers');
  });

  it('403 on tunnel calls names the missing Cloudflare Tunnel permission', async () => {
    installFetchMock(
      makeRules({
        listTunnels: () => cfErr(403, 10000, 'Authentication error'),
      }),
      calls,
    );
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toContain('Cloudflare Tunnel');
    expect(data.steps).toEqual([{ key: 'tunnel', status: 'failed' }]);
  });

  it('403 on DNS calls names the missing DNS permission', async () => {
    installFetchMock(
      makeRules({
        listDns: () => cfErr(403, 10000, 'Authentication error'),
      }),
      calls,
    );
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toContain('DNS');
  });

  it('rejects a multi-label subdomain', async () => {
    installFetchMock(makeRules(), calls);
    const res = await post({ ...validBody, subdomain: 'foo.bar' });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed zone_id', async () => {
    installFetchMock(makeRules(), calls);
    const res = await post({ ...validBody, zone_id: 'nope' });
    expect(res.status).toBe(400);
  });

  it('never echoes the API token in any response or any log line', async () => {
    const logged: string[] = [];
    const capture = (...args: unknown[]) => {
      logged.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
    vi.spyOn(console, 'info').mockImplementation(capture);
    vi.spyOn(console, 'warn').mockImplementation(capture);
    vi.spyOn(console, 'error').mockImplementation(capture);

    // Exercise the happy path, the 409 path, and a hard failure
    installFetchMock(makeRules(), calls);
    const okRes = await post(validBody);
    expect(JSON.stringify(await okRes.json())).not.toContain(TOKEN);

    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(capture);
    vi.spyOn(console, 'warn').mockImplementation(capture);
    vi.spyOn(console, 'error').mockImplementation(capture);
    installFetchMock(
      makeRules({
        listDns: () => cfOk([{ id: 'rec-9', type: 'A', name: 'pubky.example.com', content: '1.2.3.4' }]),
      }),
      calls,
    );
    const conflictRes = await post(validBody);
    expect(JSON.stringify(await conflictRes.json())).not.toContain(TOKEN);

    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(capture);
    vi.spyOn(console, 'warn').mockImplementation(capture);
    vi.spyOn(console, 'error').mockImplementation(capture);
    installFetchMock(
      makeRules({
        listTunnels: () => cfErr(403, 10000, 'Authentication error'),
      }),
      calls,
    );
    const errRes = await post(validBody);
    expect(JSON.stringify(await errRes.json())).not.toContain(TOKEN);

    expect(logged.join('\n')).not.toContain(TOKEN);
  });

  it('returns 409 without touching Cloudflare while the setup lock is held by a live flow', async () => {
    installFetchMock(makeRules(), calls);
    await fs.writeFile(
      path.join(tmpDir, '.flow-setup.lock'),
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }),
    );
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toContain('already in progress');
    expect(calls).toHaveLength(0);
    await expect(fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).rejects.toThrow();
  });

  it('a setup lock orphaned by a crashed run (dead pid) is stolen, not a permanent 409', async () => {
    installFetchMock(makeRules(), calls);
    await fs.writeFile(
      path.join(tmpDir, '.flow-setup.lock'),
      JSON.stringify({ pid: 999999999, started_at: new Date().toISOString() }),
    );
    const res = await post(validBody);
    expect(res.status).toBe(200);
    await expect(fs.access(path.join(tmpDir, '.flow-setup.lock'))).rejects.toThrow();
  });

  it('success tears down preview mode: marker, child state and handshake gone, GET reports disabled', async () => {
    installFetchMock(makeRules(), calls);
    await fs.writeFile(path.join(tmpDir, 'testdrive.env'), 'TUNNEL_URL=x', 'utf-8');
    await fs.mkdir(path.join(tmpDir, 'preview'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'preview', 'published'), 'https://x.trycloudflare.com', 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, '.testdrive.json'),
      JSON.stringify({ pid: 999999999, started_at: new Date().toISOString() }),
      'utf-8',
    );
    const res = await post(validBody);
    expect(res.status).toBe(200);
    for (const f of ['testdrive.env', path.join('preview', 'published'), '.testdrive.json']) {
      await expect(fs.access(path.join(tmpDir, f))).rejects.toThrow();
    }
    const preview = await (await previewGet(new NextRequest('http://localhost:8080/api/cloudflare-preview'))).json();
    expect(preview.enabled).toBe(false);
    expect(preview.published_url).toBeUndefined();
  });

  it('re-setup overwrites the locally-managed config with the new tunnel', async () => {
    installFetchMock(makeRules(), calls);
    // Stale config from a prior setup: the run now overwrites it (one runtime
    // mode now, so there is no "two tunnels" risk to guard against).
    await fs.writeFile(path.join(tmpDir, 'config.yml'), 'tunnel: old-id', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'credentials.json'), '{"TunnelID":"old"}', 'utf-8');
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const configYml = await fs.readFile(path.join(tmpDir, 'config.yml'), 'utf-8');
    expect(configYml).toContain(`tunnel: ${TOKEN_TID}`);
    expect(configYml).toContain('hostname: pubky.example.com');
    const creds = JSON.parse(await fs.readFile(path.join(tmpDir, 'credentials.json'), 'utf-8'));
    expect(creds.TunnelID).toBe(TOKEN_TID);
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe(RUN_TOKEN_GET);
  });

  it('returns 500 when the credentials write fails, with the failed step marked', async () => {
    installFetchMock(makeRules(), calls);
    // A regular file in the way makes mkdir fail fast with ENOTDIR
    const blocker = path.join(tmpDir, 'blocker');
    await fs.writeFile(blocker, 'not a directory', 'utf-8');
    process.env.CLOUDFLARE_CONFIG_DIR = path.join(blocker, 'nested');
    const res = await post(validBody);
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.steps.find((s: { key: string }) => s.key === 'credentials').status).toBe('failed');
  });
});

describe('cloudflare-auto-setup zones route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.PLATFORM = 'umbrel'; // zones is part of the Umbrel-only auto-setup flow
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  async function post(body: unknown) {
    return zonesPost(
      new NextRequest('http://localhost:8080/api/cloudflare-auto-setup/zones', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  // (Standalone refusal for this route is covered in zones/route.test.ts.)

  it('maps zones and never echoes the token', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          errors: [],
          result: [
            { id: ZONE_ID, name: 'example.com', status: 'active', account: { id: ACCOUNT_ID, name: 'Acc' } },
            { id: 'b'.repeat(32), name: 'pending.net', status: 'pending', account: { id: ACCOUNT_ID } },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const res = await post({ api_token: TOKEN });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.zones).toEqual([
      { id: ZONE_ID, name: 'example.com', status: 'active', account_id: ACCOUNT_ID },
      { id: 'b'.repeat(32), name: 'pending.net', status: 'pending', account_id: ACCOUNT_ID },
    ]);
    expect(JSON.stringify(data)).not.toContain(TOKEN);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('401/403 from Cloudflare maps to a permission-hinting 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, errors: [{ code: 10000, message: 'Invalid token' }], result: null }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const res = await post({ api_token: TOKEN });
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toContain('Cloudflare Tunnel');
  });

  it('rejects a missing or short token without calling Cloudflare', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const res = await post({ api_token: 'short' });
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
