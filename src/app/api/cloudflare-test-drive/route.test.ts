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
    spawnDetached: vi.fn(async () => 4242),
    parseQuickTunnelUrl: vi.fn(async () => null),
  };
});

describe('cloudflare-test-drive route', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-td-test-'));
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function routes() {
    const lib = await import('@/lib/server/cloudflared-process');
    // The mock factory's fns persist across vi.resetModules; re-prime
    // defaults each test so per-test overrides never leak.
    for (const fn of [lib.isBinaryAvailable, lib.isPidAlive, lib.killPid, lib.spawnDetached, lib.parseQuickTunnelUrl]) {
      (fn as Mock).mockReset();
    }
    (lib.isBinaryAvailable as Mock).mockReturnValue(true);
    (lib.isPidAlive as Mock).mockReturnValue(true);
    (lib.spawnDetached as Mock).mockResolvedValue(4242);
    (lib.parseQuickTunnelUrl as Mock).mockResolvedValue(null);
    const mod = await import('./route');
    return { lib, ...mod };
  }
  const get = (GET: (r: NextRequest) => Promise<Response>) =>
    GET(new NextRequest('http://localhost:8080/api/cloudflare-test-drive'));
  const post = (POST: (r: NextRequest) => Promise<Response>, body: unknown) =>
    POST(
      new NextRequest('http://localhost:8080/api/cloudflare-test-drive', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );

  it('GET reports stopped with no state', async () => {
    const { GET } = await routes();
    const data = await (await get(GET)).json();
    expect(data.status).toBe('stopped');
    expect(data.supported).toBe(true);
  });

  it('start spawns the quick tunnel against the configured origin and persists state', async () => {
    const { lib, POST, GET } = await routes();
    const res = await post(POST, { action: 'start' });
    expect((await res.json()).status).toBe('starting');
    expect(lib.spawnDetached as Mock).toHaveBeenCalledWith(
      ['tunnel', '--no-autoupdate', '--url', 'http://homeserver:6286'],
      expect.stringContaining('.testdrive.log'),
    );
    // status flips to running once the URL appears in the log
    (lib.parseQuickTunnelUrl as Mock).mockResolvedValue('https://random-words.trycloudflare.com');
    const data = await (await get(GET)).json();
    expect(data.status).toBe('running');
    expect(data.url).toBe('https://random-words.trycloudflare.com');
    expect(data.expires_at).toBeTruthy();
  });

  it('start is idempotent while a tunnel is alive', async () => {
    const { lib, POST } = await routes();
    await post(POST, { action: 'start' });
    (lib.parseQuickTunnelUrl as Mock).mockResolvedValue('https://x.trycloudflare.com');
    const res2 = await post(POST, { action: 'start' });
    const data = await res2.json();
    expect(data.url).toBe('https://x.trycloudflare.com');
    expect(lib.spawnDetached as Mock).toHaveBeenCalledTimes(1);
  });

  it('expires tunnels older than 30 minutes (lazy kill on read)', async () => {
    const { lib, GET } = await routes();
    await fs.writeFile(
      path.join(tmpDir, '.testdrive.json'),
      JSON.stringify({ pid: 4242, started_at: new Date(Date.now() - 31 * 60 * 1000).toISOString() }),
    );
    const data = await (await get(GET)).json();
    expect(data.status).toBe('stopped');
    expect(lib.killPid as Mock).toHaveBeenCalledWith(4242);
  });

  it('reports stopped and clears state when the pid is dead', async () => {
    const { lib, GET } = await routes();
    (lib.isPidAlive as Mock).mockReturnValue(false);
    await fs.writeFile(
      path.join(tmpDir, '.testdrive.json'),
      JSON.stringify({ pid: 4242, started_at: new Date().toISOString() }),
    );
    const data = await (await get(GET)).json();
    expect(data.status).toBe('stopped');
    await expect(fs.access(path.join(tmpDir, '.testdrive.json'))).rejects.toThrow();
  });

  it('stop kills the process and clears state', async () => {
    const { lib, POST } = await routes();
    await fs.writeFile(
      path.join(tmpDir, '.testdrive.json'),
      JSON.stringify({ pid: 555, started_at: new Date().toISOString() }),
    );
    const data = await (await post(POST, { action: 'stop' })).json();
    expect(data.status).toBe('stopped');
    expect(lib.killPid as Mock).toHaveBeenCalledWith(555);
  });

  it('503 when cloudflared is unavailable', async () => {
    const { lib, POST } = await routes();
    (lib.isBinaryAvailable as Mock).mockReturnValue(false);
    const res = await post(POST, { action: 'start' });
    expect(res.status).toBe(503);
  });
});
