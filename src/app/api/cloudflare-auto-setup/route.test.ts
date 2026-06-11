import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const TOKEN = 'cf-test-token-abcdefghijklmnop';
const ZONE_ID = 'a'.repeat(32);
const ACCOUNT_ID = 'acc-1';
const TUNNEL_ID = 'tun-uuid-1';

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
      'createTunnel',
      (m, u) => m === 'POST' && u.endsWith('/cfd_tunnel'),
      () => cfOk({ id: TUNNEL_ID, name: 'pubky-homeserver', token: 'run-token-xyz' }),
    ],
    [
      'getTunnelToken',
      (m, u) => m === 'GET' && u.includes(`/cfd_tunnel/${TUNNEL_ID}/token`),
      () => cfOk('run-token-from-get'),
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
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-auto-test-'));
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
    calls = [];
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function post(body: unknown) {
    const { POST } = await import('./route');
    return POST(
      new NextRequest('http://localhost:8080/api/cloudflare-auto-setup', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  const validBody = { api_token: TOKEN, zone_id: ZONE_ID, subdomain: 'pubky' };

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
    // Files written with the run token from the create response (no extra GET)
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe('run-token-xyz');
    expect(await fs.readFile(path.join(tmpDir, 'domain'), 'utf-8')).toBe('pubky.example.com');
    expect(calls.some((c) => c.url.includes('/token'))).toBe(false);
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
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe('run-token-from-get');
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

  it('create response without a token falls back to the token GET', async () => {
    installFetchMock(
      makeRules({
        createTunnel: () => cfOk({ id: TUNNEL_ID, name: 'pubky-homeserver' }),
      }),
      calls,
    );
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.method === 'GET' && c.url.includes(`/cfd_tunnel/${TUNNEL_ID}/token`))).toBe(true);
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe('run-token-from-get');
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
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  async function post(body: unknown) {
    const { POST } = await import('./zones/route');
    return POST(
      new NextRequest('http://localhost:8080/api/cloudflare-auto-setup/zones', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

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
