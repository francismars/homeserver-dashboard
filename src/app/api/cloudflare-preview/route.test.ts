import { NextRequest } from 'next/server';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

vi.mock('@/lib/server/cloudflared-process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/cloudflared-process')>();
  return {
    ...actual,
    isBinaryAvailable: vi.fn(),
    isPidAlive: vi.fn(),
    killPid: vi.fn(),
    spawnDetached: vi.fn(),
    parseQuickTunnelUrl: vi.fn(),
    quickTunnelConnected: vi.fn(),
    writeState: vi.fn(),
  };
});

describe('cloudflare-preview route', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-preview-test-'));
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function routes() {
    const lib = await import('@/lib/server/cloudflared-process');
    const actual = await vi.importActual<typeof import('@/lib/server/cloudflared-process')>(
      '@/lib/server/cloudflared-process',
    );
    for (const fn of [
      lib.isBinaryAvailable,
      lib.isPidAlive,
      lib.killPid,
      lib.spawnDetached,
      lib.parseQuickTunnelUrl,
      lib.quickTunnelConnected,
      lib.writeState,
    ]) {
      (fn as Mock).mockReset();
    }
    (lib.isBinaryAvailable as Mock).mockResolvedValue(true);
    (lib.isPidAlive as Mock).mockReturnValue(true);
    (lib.killPid as Mock).mockResolvedValue(true);
    (lib.spawnDetached as Mock).mockResolvedValue({ pid: 4242 });
    (lib.parseQuickTunnelUrl as Mock).mockResolvedValue(null);
    (lib.quickTunnelConnected as Mock).mockResolvedValue(true);
    (lib.writeState as Mock).mockImplementation(actual.writeState);
    const mod = await import('./route');
    return { lib, ...mod };
  }
  const get = (GET: (r: NextRequest) => Promise<Response>) =>
    GET(new NextRequest('http://localhost:8080/api/cloudflare-preview'));
  const post = (POST: (r: NextRequest) => Promise<Response>, body: unknown) =>
    POST(
      new NextRequest('http://localhost:8080/api/cloudflare-preview', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );

  it('GET: disabled initially', async () => {
    const { GET } = await routes();
    const data = await (await get(GET)).json();
    expect(data.enabled).toBe(false);
    expect(data.instant.status).toBe('stopped');
  });

  it('enable writes the marker env file and spawns the uncapped instant tunnel', async () => {
    const { lib, POST } = await routes();
    const res = await post(POST, { action: 'enable' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.enabled).toBe(true);
    // The marker gates the compose service and the wrapper publish
    const env = await fs.readFile(path.join(tmpDir, 'testdrive.env'), 'utf-8');
    expect(env).toBe('TUNNEL_URL=http://homeserver:6286\n');
    // preview dir pre-created for the compose service logfile
    await expect(fs.access(path.join(tmpDir, 'preview'))).resolves.toBeUndefined();
    // instant tunnel: NO timeout wrapper (uncapped, dies with the container)
    const spawnArgs = (lib.spawnDetached as Mock).mock.calls[0][0];
    expect(spawnArgs[0]).toContain('cloudflared');
    expect(spawnArgs).not.toContain('timeout');
    expect(spawnArgs).toContain('--url');
  });

  it('enable is refused while a permanent token-mode setup exists', async () => {
    const { lib, POST } = await routes();
    await fs.writeFile(path.join(tmpDir, 'domain'), 'real.example.com', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'token'), 'eyJ-some-token', 'utf-8');
    const res = await post(POST, { action: 'enable' });
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toContain('permanent');
    expect(lib.spawnDetached as Mock).not.toHaveBeenCalled();
    await expect(fs.access(path.join(tmpDir, 'testdrive.env'))).rejects.toThrow();
  });

  it('enable is refused while a locally-managed (Connect) setup exists', async () => {
    const { POST } = await routes();
    await fs.writeFile(path.join(tmpDir, 'config.yml'), 'tunnel: x', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'credentials.json'), '{}', 'utf-8');
    const res = await post(POST, { action: 'enable' });
    expect(res.status).toBe(409);
  });

  it('enable is allowed when the previous domain is a stale trycloudflare one', async () => {
    const { POST } = await routes();
    await fs.writeFile(path.join(tmpDir, 'domain'), 'old-preview.trycloudflare.com', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'token'), '', 'utf-8');
    const res = await post(POST, { action: 'enable' });
    expect(res.status).toBe(200);
  });

  it('GET surfaces the published URL from the compose-service logfile when enabled', async () => {
    const { GET, POST } = await routes();
    await post(POST, { action: 'enable' });
    await fs.mkdir(path.join(tmpDir, 'preview'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'preview', 'quick.log'),
      [
        'INF Requesting https://api.trycloudflare.com/tunnel',
        'INF |  https://older-restart.trycloudflare.com |',
        'INF |  https://current-one.trycloudflare.com |',
      ].join('\n'),
      'utf-8',
    );
    const data = await (await get(GET)).json();
    expect(data.published_url).toBe('https://current-one.trycloudflare.com');
  });

  it('disable kills the instant tunnel and removes the marker', async () => {
    const { lib, POST, GET } = await routes();
    await post(POST, { action: 'enable' });
    const res = await post(POST, { action: 'disable' });
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.message).toBe('Preview disabled.');
    expect(lib.killPid as Mock).toHaveBeenCalledWith(4242, undefined);
    await expect(fs.access(path.join(tmpDir, 'testdrive.env'))).rejects.toThrow();
    const data = await (await get(GET)).json();
    expect(data.enabled).toBe(false);
  });

  it('disable is honest when the instant tunnel refuses to die', async () => {
    const { lib, POST } = await routes();
    await post(POST, { action: 'enable' });
    (lib.killPid as Mock).mockResolvedValue(false);
    const res = await post(POST, { action: 'disable' });
    const body = await res.json();
    // Marker and state are still cleared (nothing restarts the child), but
    // the response must not pretend the URL is dead.
    expect(body.enabled).toBe(false);
    expect(body.message).toContain('did not exit');
    await expect(fs.access(path.join(tmpDir, 'testdrive.env'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, '.testdrive.json'))).rejects.toThrow();
  });

  it('a failed enable kills the spawned child and removes the marker', async () => {
    const { lib, POST, GET } = await routes();
    (lib.spawnDetached as Mock).mockResolvedValue({ pid: 4242, starttime: 77 });
    (lib.writeState as Mock).mockRejectedValue(new Error('disk full'));
    const res = await post(POST, { action: 'enable' });
    expect(res.status).toBe(500);
    expect(lib.killPid as Mock).toHaveBeenCalledWith(4242, 77);
    await expect(fs.access(path.join(tmpDir, 'testdrive.env'))).rejects.toThrow();
    const data = await (await get(GET)).json();
    expect(data.enabled).toBe(false);
    expect(data.instant.status).toBe('stopped');
  });

  it('GET prefers the wrapper handshake file over the quick.log for the published URL', async () => {
    const { GET, POST } = await routes();
    await post(POST, { action: 'enable' });
    await fs.mkdir(path.join(tmpDir, 'preview'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'preview', 'quick.log'),
      'INF |  https://previous-boot.trycloudflare.com |\n',
      'utf-8',
    );
    await fs.writeFile(path.join(tmpDir, 'preview', 'published'), 'https://published.trycloudflare.com\n', 'utf-8');
    const data = await (await get(GET)).json();
    expect(data.published_url).toBe('https://published.trycloudflare.com');
  });

  it('instant tunnel URL shows only after edge registration', async () => {
    const { lib, GET, POST } = await routes();
    await post(POST, { action: 'enable' });
    (lib.parseQuickTunnelUrl as Mock).mockResolvedValue('https://fresh.trycloudflare.com');
    (lib.quickTunnelConnected as Mock).mockResolvedValue(false);
    let data = await (await get(GET)).json();
    expect(data.instant.status).toBe('starting');
    expect(data.instant.url).toBeUndefined();
    (lib.quickTunnelConnected as Mock).mockResolvedValue(true);
    data = await (await get(GET)).json();
    expect(data.instant.status).toBe('running');
    expect(data.instant.url).toBe('https://fresh.trycloudflare.com');
  });

  it('enable returns 409 while the setup lock is held by a live flow', async () => {
    const { lib, POST } = await routes();
    await fs.writeFile(
      path.join(tmpDir, '.flow-setup.lock'),
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }),
    );
    const res = await post(POST, { action: 'enable' });
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toContain('already in progress');
    expect(lib.spawnDetached as Mock).not.toHaveBeenCalled();
    await expect(fs.access(path.join(tmpDir, 'testdrive.env'))).rejects.toThrow();
  });

  it('503 when cloudflared unavailable', async () => {
    const { lib, POST } = await routes();
    (lib.isBinaryAvailable as Mock).mockResolvedValue(false);
    const res = await post(POST, { action: 'enable' });
    expect(res.status).toBe(503);
  });
});
