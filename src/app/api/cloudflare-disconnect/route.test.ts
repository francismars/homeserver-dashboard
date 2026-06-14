// @vitest-environment node
import { NextRequest } from 'next/server';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

vi.mock('@/lib/server/cloudflared-process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/cloudflared-process')>();
  return { ...actual, killPid: vi.fn() };
});

describe('cloudflare-disconnect route', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;
  let configPath: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-disc-test-'));
    configPath = path.join(tmpDir, 'config.toml');
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
    process.env.PLATFORM = 'umbrel'; // these flows are Umbrel-only; keep happy-paths on umbrel
    process.env.HOMESERVER_CONFIG_PATH = configPath;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function post() {
    const lib = await import('@/lib/server/cloudflared-process');
    (lib.killPid as Mock).mockReset();
    const { POST } = await import('./route');
    const res = await POST(new NextRequest('http://localhost:8080/api/cloudflare-disconnect', { method: 'POST' }));
    return { res, lib };
  }

  it('refuses on standalone with 404 not_supported', async () => {
    process.env.PLATFORM = 'standalone';
    const { res } = await post();
    expect(res.status).toBe(404);
    expect((await res.json()).type).toBe('not_supported');
  });
  it('tears down all modes: files removed, token/domain truncated, icann reset', async () => {
    // a fully-populated mixed state
    for (const [f, content] of [
      ['cert.pem', 'CERT'],
      ['config.yml', 'tunnel: x'],
      ['credentials.json', '{}'],
      ['testdrive.env', 'TUNNEL_URL=x'],
      ['token', 'eyJ-token'],
      ['domain', 'pubky2.example.com'],
    ] as const) {
      await fs.writeFile(path.join(tmpDir, f), content, 'utf-8');
    }
    await fs.mkdir(path.join(tmpDir, 'preview'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'preview', 'published'), 'https://x.trycloudflare.com', 'utf-8');
    // Scratch login-delivery dir: a cert here would resurrect the authorization.
    await fs.mkdir(path.join(tmpDir, '.cloudflared'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, '.cloudflared', 'cert.pem'), 'CERT', 'utf-8');
    await fs.writeFile(
      configPath,
      ['[pkdns]', 'icann_domain = "pubky2.example.com"', 'public_icann_http_port = 443', 'other = 1'].join('\n'),
      'utf-8',
    );
    await fs.chmod(configPath, 0o660);

    const { res } = await post();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.message).toContain('still exist in your Cloudflare account');

    for (const f of ['cert.pem', 'config.yml', 'credentials.json', 'testdrive.env', 'preview/published']) {
      await expect(fs.access(path.join(tmpDir, f))).rejects.toThrow();
    }
    await expect(fs.access(path.join(tmpDir, '.cloudflared'))).rejects.toThrow();
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe('');
    expect(await fs.readFile(path.join(tmpDir, 'domain'), 'utf-8')).toBe('');

    const config = await fs.readFile(configPath, 'utf-8');
    expect(config).toContain('icann_domain = "localhost"');
    expect(config).not.toContain('public_icann_http_port');
    expect(config).toContain('other = 1');
    // Mode is preserved across the rewrite (config.toml holds admin_password).
    expect((await fs.stat(configPath)).mode & 0o777).toBe(0o660);
  });

  it('kills pending login and instant-tunnel processes', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.connect.json'),
      JSON.stringify({ pid: 111, started_at: new Date().toISOString() }),
    );
    await fs.writeFile(
      path.join(tmpDir, '.testdrive.json'),
      JSON.stringify({ pid: 222, started_at: new Date().toISOString() }),
    );
    const { res, lib } = await post();
    expect(res.status).toBe(200);
    expect(lib.killPid as Mock).toHaveBeenCalledWith(111, undefined);
    expect(lib.killPid as Mock).toHaveBeenCalledWith(222, undefined);
  });

  it('clears orphaned flow locks so a crashed setup cannot wedge future flows', async () => {
    await fs.writeFile(path.join(tmpDir, '.flow-setup.lock'), '{}', 'utf-8');
    await fs.writeFile(path.join(tmpDir, '.flow-connect-start.lock'), '{}', 'utf-8');
    await fs.writeFile(path.join(tmpDir, '.connect-complete.lock'), '', 'utf-8');
    const { res } = await post();
    expect(res.status).toBe(200);
    await expect(fs.access(path.join(tmpDir, '.flow-setup.lock'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, '.flow-connect-start.lock'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, '.connect-complete.lock'))).rejects.toThrow();
  });

  it('refuses with 409 while a live setup flow holds the lock, leaving artifacts intact', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.flow-setup.lock'),
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }),
      'utf-8',
    );
    await fs.writeFile(path.join(tmpDir, 'token'), 'eyJ-token', 'utf-8');
    const { res } = await post();
    expect(res.status).toBe(409);
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe('eyJ-token');
    await expect(fs.access(path.join(tmpDir, '.flow-setup.lock'))).resolves.toBeUndefined();
  });

  it('succeeds with published_domain skipped when the homeserver config is absent', async () => {
    const { res } = await post();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.steps.find((s: { key: string }) => s.key === 'published_domain').status).toBe('skipped');
  });
});
