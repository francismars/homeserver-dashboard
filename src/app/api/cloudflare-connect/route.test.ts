import { NextRequest } from 'next/server';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

vi.mock('@/lib/server/cloudflared-process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/cloudflared-process')>();
  return {
    ...actual,
    isBinaryAvailable: vi.fn(() => true),
    isPidAlive: vi.fn(() => true),
    killPid: vi.fn(),
    spawnDetached: vi.fn(async () => 7777),
    runCloudflared: vi.fn(() => ({ ok: true, output: '' })),
    parseLoginUrl: vi.fn(async () => 'https://dash.cloudflare.com/argotunnel?aud=&callback=abc'),
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
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function routes() {
    const lib = await import('@/lib/server/cloudflared-process');
    // Re-prime defaults each test; per-test overrides must never leak.
    for (const fn of [
      lib.isBinaryAvailable,
      lib.isPidAlive,
      lib.killPid,
      lib.spawnDetached,
      lib.runCloudflared,
      lib.parseLoginUrl,
    ]) {
      (fn as Mock).mockReset();
    }
    (lib.isBinaryAvailable as Mock).mockReturnValue(true);
    (lib.isPidAlive as Mock).mockReturnValue(true);
    (lib.spawnDetached as Mock).mockResolvedValue(7777);
    (lib.runCloudflared as Mock).mockReturnValue({ ok: true, output: '' });
    (lib.parseLoginUrl as Mock).mockResolvedValue(AUTH_URL);
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
  const writeCreds = (id = 'tunnel-uuid-1') =>
    fs.writeFile(path.join(tmpDir, 'credentials.json'), JSON.stringify({ TunnelID: id }), 'utf-8');

  it('GET reports idle initially', async () => {
    const { GET } = await routes();
    const data = await (await get(GET)).json();
    expect(data.status).toBe('idle');
    expect(data.supported).toBe(true);
  });

  it('start spawns tunnel login with the cert destination and returns the auth URL', async () => {
    const { lib, POST } = await routes();
    const data = await (await post(POST, { action: 'start' })).json();
    expect(data.status).toBe('waiting');
    expect(data.auth_url).toBe(AUTH_URL);
    expect(lib.spawnDetached as Mock).toHaveBeenCalledWith(
      [expect.stringContaining('cloudflared'), 'tunnel', 'login'],
      expect.stringContaining('.connect.log'),
      expect.objectContaining({ TUNNEL_ORIGIN_CERT: expect.stringContaining('cert.pem') }),
    );
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
      [expect.stringContaining('cloudflared'), 'tunnel', 'login'],
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
    await writeCreds('uuid-42');
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
  });

  it('name collision falls back to pubky-homeserver-local', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    await writeCreds();
    (lib.runCloudflared as Mock)
      .mockReturnValueOnce({ ok: false, output: 'tunnel with name pubky-homeserver already exists' })
      .mockReturnValue({ ok: true, output: '' });
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    expect(res.status).toBe(200);
    const calls = (lib.runCloudflared as Mock).mock.calls;
    expect(calls[1][0]).toContain('pubky-homeserver-local');
    expect(calls[2][0]).toEqual(['tunnel', 'route', 'dns', 'pubky-homeserver-local', 'pubky.example.com']);
  });

  it('route dns "already exists" gives an actionable message and deletes the created tunnel', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    await writeCreds();
    (lib.runCloudflared as Mock)
      .mockReturnValueOnce({ ok: true, output: '' })
      .mockReturnValueOnce({ ok: false, output: 'Failed: record with that host already exists' })
      .mockReturnValue({ ok: true, output: '' });
    const res = await post(POST, { action: 'complete', hostname: 'pubky.example.com' });
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.error).toContain('different subdomain');
    // retry idempotency: the just-created tunnel is deleted again
    const calls = (lib.runCloudflared as Mock).mock.calls;
    expect(calls[2][0]).toEqual(['tunnel', 'delete', '-f', 'pubky-homeserver']);
    await expect(fs.access(path.join(tmpDir, 'credentials.json'))).rejects.toThrow();
  });

  it('an authorization cert older than 15 minutes expires to idle', async () => {
    const { GET } = await routes();
    await writeCert();
    const old = new Date(Date.now() - 16 * 60 * 1000);
    await fs.utimes(path.join(tmpDir, 'cert.pem'), old, old);
    const data = await (await get(GET)).json();
    expect(data.status).toBe('idle');
    await expect(fs.access(path.join(tmpDir, 'cert.pem'))).rejects.toThrow();
  });

  it('route dns wrong-zone error gives an actionable message', async () => {
    const { lib, POST } = await routes();
    await writeCert();
    await writeCreds();
    (lib.runCloudflared as Mock)
      .mockReturnValueOnce({ ok: true, output: '' })
      .mockReturnValueOnce({ ok: false, output: 'failed to find zone for the hostname' })
      .mockReturnValue({ ok: true, output: '' });
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
    expect(lib.killPid as Mock).toHaveBeenCalledWith(999);
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
