// @vitest-environment node
import { NextRequest } from 'next/server';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../lib/server/__fixtures__');

vi.mock('@/lib/server/cloudflared-process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/cloudflared-process')>();
  return {
    ...actual,
    isBinaryAvailable: vi.fn(() => true),
    isPidAlive: vi.fn(() => true),
    killPid: vi.fn(async () => true),
    spawnDetached: vi.fn(async () => ({ pid: 7777 })),
    runCloudflared: vi.fn(() => ({ ok: true, output: '' })),
    parseLoginUrl: vi.fn(async () => 'https://dash.cloudflare.com/argotunnel?aud=&callback=abc'),
    atomicWrite: vi.fn(),
  };
});

const AUTH_URL = 'https://dash.cloudflare.com/argotunnel?aud=&callback=abc';

describe('cloudflare-connect route', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-connect-test-'));
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
    process.env.CLOUDFLARED_RUNTIME_DIR = '/etc/cloudflared-config';
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.useRealTimers();
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function routes() {
    const lib = await import('@/lib/server/cloudflared-process');
    const actual = await vi.importActual<typeof import('@/lib/server/cloudflared-process')>(
      '@/lib/server/cloudflared-process',
    );
    // Re-prime defaults each test; per-test overrides must never leak.
    for (const fn of [
      lib.isBinaryAvailable,
      lib.isPidAlive,
      lib.killPid,
      lib.spawnDetached,
      lib.runCloudflared,
      lib.parseLoginUrl,
      lib.atomicWrite,
    ]) {
      (fn as Mock).mockReset();
    }
    (lib.isBinaryAvailable as Mock).mockReturnValue(true);
    (lib.isPidAlive as Mock).mockReturnValue(true);
    (lib.killPid as Mock).mockResolvedValue(true);
    (lib.spawnDetached as Mock).mockResolvedValue({ pid: 7777 });
    (lib.runCloudflared as Mock).mockReturnValue({ ok: true, output: '' });
    (lib.parseLoginUrl as Mock).mockResolvedValue(AUTH_URL);
    // Pass-through mock: real writes, observable call order.
    (lib.atomicWrite as Mock).mockImplementation(actual.atomicWrite);
    const mod = await import('./route');
    return { lib, ...mod };
  }
  const get = (GET: (r: NextRequest) => Promise<Response>) =>
    GET(new NextRequest('http://localhost:8080/api/cloudflare-connect'));
  const post = (POST: (r: NextRequest) => Promise<Response>, body: unknown) =>
    POST(
      new NextRequest('http://localhost:8080/api/cloudflare-connect', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );

  const writeCert = () => fs.writeFile(path.join(tmpDir, 'cert.pem'), 'CERT', 'utf-8');
  /** Realistic cert: key + certificate (SAN example.com, *.example.com) + token block. */
  const writeRealCert = async () =>
    fs.writeFile(
      path.join(tmpDir, 'cert.pem'),
      await fs.readFile(path.join(FIXTURES, 'origincert-example.pem'), 'utf-8'),
      'utf-8',
    );
  const writeCreds = (id = 'tunnel-uuid-1') =>
    fs.writeFile(path.join(tmpDir, 'credentials.json'), JSON.stringify({ TunnelID: id }), 'utf-8');

  /** Mimics the real binary: a successful `tunnel create` writes the
   * credentials file. Replies are consumed in call order; the last repeats. */
  const primeCloudflared = (
    runCloudflared: Mock,
    replies: Array<{ ok: boolean; output?: string }>,
    tunnelId = 'uuid-42',
  ) => {
    let i = 0;
    runCloudflared.mockImplementation(async (args: string[]) => {
      const reply = replies[Math.min(i, replies.length - 1)];
      i += 1;
      if (args[1] === 'create' && reply.ok) await writeCreds(tunnelId);
      return { ok: reply.ok, output: reply.output ?? '' };
    });
  };

  it('GET reports idle initially', async () => {
    const { GET } = await routes();
    const data = await (await get(GET)).json();
    expect(data.status).toBe('idle');
    expect(data.supported).toBe(true);
  });

  it('start spawns tunnel login under a 15-minute timeout wrapper and returns the auth URL', async () => {
    const { lib, POST } = await routes();
    const data = await (await post(POST, { action: 'start' })).json();
    expect(data.status).toBe('waiting');
    expect(data.auth_url).toBe(AUTH_URL);
    expect(lib.spawnDetached as Mock).toHaveBeenCalledWith(
      ['timeout', '900', expect.stringContaining('cloudflared'), 'tunnel', 'login'],
      expect.stringContaining('.connect.log'),
      expect.objectContaining({ TUNNEL_ORIGIN_CERT: expect.stringContaining('cert.pem') }),
    );
  });

  // Fake only setTimeout so the route's real fs I/O still completes on the
  // live event loop while its 500ms polling sleeps run on fake time.
  const usePollFakeTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  /** Drains real I/O (setImmediate stays real) and hops 500ms of fake time
   * whenever the route is parked on its polling sleep, until `p` settles. */
  const flushPolling = async <T>(p: Promise<T>): Promise<T> => {
    let settled = false;
    const guarded = p.finally(() => {
      settled = true;
    });
    for (let i = 0; i < 10_000 && !settled; i++) {
      await new Promise<void>((r) => setImmediate(r));
      if (!settled && vi.getTimerCount() > 0) await vi.advanceTimersByTimeAsync(500);
    }
    return guarded;
  };

  it('start returns without sleeping when the URL is available on the first parse', async () => {
    // With setTimeout faked and never advanced, a sleep-before-parse
    // regression hangs this test instead of silently costing 500ms per start.
    usePollFakeTimers();
    const { lib, POST } = await routes();
    const data = await (await post(POST, { action: 'start' })).json();
    expect(data.status).toBe('waiting');
    expect(data.auth_url).toBe(AUTH_URL);
    expect(lib.parseLoginUrl as Mock).toHaveBeenCalledTimes(1);
  });

  it('start sleeps 500ms between parse retries until the URL appears', async () => {
    usePollFakeTimers();
    const { lib, POST } = await routes();
    (lib.parseLoginUrl as Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(AUTH_URL);
    const data = await (await flushPolling(post(POST, { action: 'start' }))).json();
    expect(data.status).toBe('waiting');
    expect(data.auth_url).toBe(AUTH_URL);
    expect(lib.parseLoginUrl as Mock).toHaveBeenCalledTimes(2);
  });

  it('start gives up after the poll budget, kills the login and returns 500', async () => {
    usePollFakeTimers();
    const { lib, POST } = await routes();
    (lib.parseLoginUrl as Mock).mockResolvedValue(null);
    const res = await flushPolling(post(POST, { action: 'start' }));
    expect(res.status).toBe(500);
    // 1 immediate parse + 20 post-sleep retries
    expect(lib.parseLoginUrl as Mock).toHaveBeenCalledTimes(21);
    expect(lib.killPid as Mock).toHaveBeenCalledWith(7777, undefined);
    await expect(fs.access(path.join(tmpDir, '.connect.json'))).rejects.toThrow();
  });

  it('relocates a cert delivered under $HOME/.cloudflared to the canonical path', async () => {
    const { GET } = await routes();
    await fs.mkdir(path.join(tmpDir, '.cloudflared'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, '.cloudflared', 'cert.pem'), 'CERT', 'utf-8');
    const data = await (await get(GET)).json();
    expect(data.status).toBe('authorized');
    const stat = await fs.stat(path.join(tmpDir, 'cert.pem'));
    expect(stat.mode & 0o777).toBe(0o600);
    await expect(fs.access(path.join(tmpDir, '.cloudflared'))).rejects.toThrow();
  });

  it('start aims the login child HOME at the config dir', async () => {
    const { lib, POST } = await routes();
    await post(POST, { action: 'start' });
    expect(lib.spawnDetached as Mock).toHaveBeenCalledWith(
      ['timeout', '900', expect.stringContaining('cloudflared'), 'tunnel', 'login'],
      expect.stringContaining('.connect.log'),
      expect.objectContaining({ HOME: tmpDir }),
    );
  });

  it('GET reports authorized once cert.pem lands', async () => {
    const { GET } = await routes();
    await writeCert();
    const data = await (await get(GET)).json();
    expect(data.status).toBe('authorized');
  });

  it('start while authorized does not spawn again', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    const data = await (await post(POST, { action: 'start' })).json();
    expect(data.status).toBe('authorized');
    expect(lib.spawnDetached as Mock).not.toHaveBeenCalled();
  });

  it('complete without a cert returns 409', async () => {
    const { POST } = await routes();
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    expect(res.status).toBe(409);
  });

  it('complete happy path: create + route dns + config files + mode switch + cert deleted', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    primeCloudflared(lib.runCloudflared as Mock, [{ ok: true }]);
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.hostname).toBe('pubky.example.com');

    const calls = (lib.runCloudflared as Mock).mock.calls;
    expect(calls[0][0]).toEqual([
      'tunnel',
      'create',
      '--credentials-file',
      path.join(tmpDir, 'credentials.json'),
      'pubky-homeserver',
    ]);
    expect(calls[0][1]).toEqual({ TUNNEL_ORIGIN_CERT: path.join(tmpDir, 'cert.pem') });
    expect(calls[1][0]).toEqual(['tunnel', 'route', 'dns', 'pubky-homeserver', 'pubky.example.com']);

    const configYml = await fs.readFile(path.join(tmpDir, 'config.yml'), 'utf-8');
    expect(configYml).toContain('tunnel: uuid-42');
    expect(configYml).toContain('credentials-file: /etc/cloudflared-config/credentials.json');
    expect(configYml).toContain('hostname: pubky.example.com');
    expect(configYml).toContain('service: http://homeserver:6286');
    expect(configYml).toContain('http_status:404');

    expect((await fs.readFile(path.join(tmpDir, 'domain'), 'utf-8')).trim()).toBe('pubky.example.com');
    // Mode switch: token truncated so the token-mode container stays down
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe('');
    // The cert must not survive completion
    await expect(fs.access(path.join(tmpDir, 'cert.pem'))).rejects.toThrow();

    // Crash-safe write order: token truncated, then domain, then config.yml
    // last (completion detection keys on config.yml+credentials.json, so a
    // crash mid-sequence can never report completed with a stale domain).
    const writes = (lib.atomicWrite as Mock).mock.calls.map((c) => path.basename(c[0] as string));
    expect(writes).toEqual(['token', 'domain', 'config.yml']);
  });

  it('complete reuses surviving credentials instead of creating a second tunnel', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    await writeCreds('uuid-prev');
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    const calls = (lib.runCloudflared as Mock).mock.calls;
    // No `tunnel create`: the previous attempt's tunnel id is reused for route dns.
    expect(calls.map((c) => c[0][1])).not.toContain('create');
    expect(calls[0][0]).toEqual(['tunnel', 'route', 'dns', 'uuid-prev', 'pubky.example.com']);
    expect(await fs.readFile(path.join(tmpDir, 'config.yml'), 'utf-8')).toContain('tunnel: uuid-prev');
  });

  it('name collision falls back to pubky-homeserver-local', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    primeCloudflared(lib.runCloudflared as Mock, [
      { ok: false, output: 'tunnel with name pubky-homeserver already exists' },
      { ok: true },
    ]);
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    expect(res.status).toBe(200);
    const calls = (lib.runCloudflared as Mock).mock.calls;
    expect(calls[1][0]).toContain('pubky-homeserver-local');
    expect(calls[2][0]).toEqual(['tunnel', 'route', 'dns', 'pubky-homeserver-local', 'pubky.example.com']);
  });

  it('route dns "already exists" gives an actionable message and deletes the created tunnel', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    primeCloudflared(lib.runCloudflared as Mock, [
      { ok: true },
      { ok: false, output: 'Failed: record with that host already exists' },
      { ok: true },
    ]);
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.error).toContain('different subdomain');
    // retry idempotency: the just-created tunnel is deleted again
    const calls = (lib.runCloudflared as Mock).mock.calls;
    expect(calls[2][0]).toEqual(['tunnel', 'delete', '-f', 'pubky-homeserver']);
    await expect(fs.access(path.join(tmpDir, 'credentials.json'))).rejects.toThrow();
  });

  it('route dns failure keeps credentials when the tunnel delete itself fails', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    primeCloudflared(lib.runCloudflared as Mock, [
      { ok: true },
      { ok: false, output: 'Failed: record with that host already exists' },
      { ok: false, output: 'error deleting tunnel: connection refused' },
    ]);
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    expect(res.status).toBe(502);
    // The tunnel still exists at Cloudflare; the credentials must survive so
    // the next attempt reuses it instead of burning the fallback name.
    await expect(fs.access(path.join(tmpDir, 'credentials.json'))).resolves.toBeUndefined();
  });

  it('complete tears down preview mode: marker and handshake gone, instant child killed', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    primeCloudflared(lib.runCloudflared as Mock, [{ ok: true }]);
    await fs.writeFile(path.join(tmpDir, 'testdrive.env'), 'TUNNEL_URL=x', 'utf-8');
    await fs.mkdir(path.join(tmpDir, 'preview'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'preview', 'published'), 'https://x.trycloudflare.com', 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, '.testdrive.json'),
      JSON.stringify({ pid: 555, started_at: new Date().toISOString(), starttime: 7 }),
      'utf-8',
    );
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    expect(res.status).toBe(200);
    expect(lib.killPid as Mock).toHaveBeenCalledWith(555, 7);
    await expect(fs.access(path.join(tmpDir, 'testdrive.env'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, 'preview', 'published'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, '.testdrive.json'))).rejects.toThrow();
  });

  it('an authorization cert older than 15 minutes expires to idle with the expired hint', async () => {
    const { GET } = await routes();
    await writeCert();
    const old = new Date(Date.now() - 16 * 60 * 1000);
    await fs.utimes(path.join(tmpDir, 'cert.pem'), old, old);
    const data = await (await get(GET)).json();
    expect(data.status).toBe('idle');
    expect(data.expired).toBe(true);
    await expect(fs.access(path.join(tmpDir, 'cert.pem'))).rejects.toThrow();
  });

  it('an over-age waiting login is killed and reported as expired', async () => {
    const { lib, GET } = await routes();
    await fs.writeFile(
      path.join(tmpDir, '.connect.json'),
      JSON.stringify({ pid: 999, started_at: new Date(Date.now() - 16 * 60 * 1000).toISOString() }),
    );
    const data = await (await get(GET)).json();
    expect(data.status).toBe('idle');
    expect(data.expired).toBe(true);
    expect(lib.killPid as Mock).toHaveBeenCalledWith(999, undefined);
    await expect(fs.access(path.join(tmpDir, '.connect.json'))).rejects.toThrow();
  });

  it('cancel removes the scratch .cloudflared dir so a late delivery cannot resurrect the authorization', async () => {
    const { POST } = await routes();
    await fs.mkdir(path.join(tmpDir, '.cloudflared'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, '.cloudflared', 'cert.pem'), 'CERT', 'utf-8');
    const data = await (await post(POST, { action: 'cancel' })).json();
    expect(data.status).toBe('idle');
    await expect(fs.access(path.join(tmpDir, '.cloudflared'))).rejects.toThrow();
  });

  it('GET authorized includes the domain parsed from the cert SAN', async () => {
    const { GET } = await routes();
    await writeRealCert();
    const data = await (await get(GET)).json();
    expect(data.status).toBe('authorized');
    expect(data.authorized_domain).toBe('example.com');
  });

  it('GET authorized reports authorized_domain null for an unparseable cert', async () => {
    const { GET } = await routes();
    await writeCert();
    const data = await (await get(GET)).json();
    expect(data.status).toBe('authorized');
    expect(data.authorized_domain).toBeNull();
  });

  it('complete rejects an out-of-zone hostname with a clear 400 when the cert parses', async () => {
    const { lib, POST } = await routes();
    await writeRealCert();
    const res = await post(POST, { action: 'complete', hostname: 'pubky.other.net' });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('example.com');
    expect(lib.runCloudflared as Mock).not.toHaveBeenCalled();
  });

  it('complete accepts an in-zone hostname when the cert parses', async () => {
    const { lib, POST } = await routes();
    await writeRealCert();
    primeCloudflared(lib.runCloudflared as Mock, [{ ok: true }]);
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('route dns wrong-zone error gives an actionable message', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    primeCloudflared(lib.runCloudflared as Mock, [
      { ok: true },
      { ok: false, output: 'failed to find zone for the hostname' },
      { ok: true },
    ]);
    const res = await post(POST, { action: 'complete', hostname: 'pubky.other.net' });
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.error).toContain('domain you authorized');
  });

  it('cancel kills the login process and removes the cert', async () => {
    const { lib, POST } = await routes();
    await fs.writeFile(
      path.join(tmpDir, '.connect.json'),
      JSON.stringify({ pid: 999, started_at: new Date().toISOString() }),
    );
    await writeCert();
    const data = await (await post(POST, { action: 'cancel' })).json();
    expect(data.status).toBe('idle');
    expect(lib.killPid as Mock).toHaveBeenCalledWith(999, undefined);
    await expect(fs.access(path.join(tmpDir, 'cert.pem'))).rejects.toThrow();
  });

  it('GET reports completed with the hostname when config + credentials exist', async () => {
    const { GET } = await routes();
    await writeCreds();
    await fs.writeFile(path.join(tmpDir, 'config.yml'), 'tunnel: x', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'domain'), 'pubky.example.com', 'utf-8');
    const data = await (await get(GET)).json();
    expect(data.status).toBe('completed');
    expect(data.hostname).toBe('pubky.example.com');
  });

  it('rejects an invalid hostname', async () => {
    const { POST } = await routes();
    await writeCert();
    const res = await post(POST, { action: 'complete', hostname: 'bad host!' });
    expect(res.status).toBe(400);
  });

  it('complete returns 409 while the setup lock is held by a live flow', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    await fs.writeFile(
      path.join(tmpDir, '.flow-setup.lock'),
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }),
    );
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toContain('already in progress');
    expect(lib.runCloudflared as Mock).not.toHaveBeenCalled();
  });

  it('a lock orphaned by a crashed completion (dead pid) is stolen, not a permanent 409', async () => {
    const { POST } = await routes();
    await writeCert();
    await writeCreds('uuid-42');
    await fs.writeFile(
      path.join(tmpDir, '.flow-setup.lock'),
      JSON.stringify({ pid: 999999999, started_at: new Date().toISOString() }),
    );
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    expect(res.status).toBe(200);
    await expect(fs.access(path.join(tmpDir, '.flow-setup.lock'))).rejects.toThrow();
  });

  it('stale login (dead pid) resets to idle so the user can retry', async () => {
    const { lib, GET } = await routes();
    (lib.isPidAlive as Mock).mockReturnValue(false);
    await fs.writeFile(
      path.join(tmpDir, '.connect.json'),
      JSON.stringify({ pid: 999, started_at: new Date().toISOString() }),
    );
    const data = await (await get(GET)).json();
    expect(data.status).toBe('idle');
  });
});
