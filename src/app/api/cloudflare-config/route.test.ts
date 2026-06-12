// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const VALID_TOKEN = 'eyJhbGciOi-test.token_with.various-chars.123456789ABCdef=';
const ANOTHER_VALID_TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('cloudflare-config route', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-config-test-'));
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function loadRoute() {
    const mod = await import('./route');
    return { GET: mod.GET, POST: mod.POST };
  }

  const getRequest = () => new NextRequest('http://localhost:8080/api/cloudflare-config');

  it('GET returns mode off when no files exist', async () => {
    const { GET } = await loadRoute();
    const response = await GET(getRequest());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(payload.domain).toBe(null);
    expect(payload.mode).toBe('off');
    expect(payload.configured).toBe(false);
    expect(payload.supported).toBe(true);
  });

  it('GET reports token mode when both domain and token are present', async () => {
    await fs.writeFile(path.join(tmpDir, 'domain'), 'pubky.example.com');
    await fs.writeFile(path.join(tmpDir, 'token'), VALID_TOKEN);
    const { GET } = await loadRoute();
    const response = await GET(getRequest());
    const payload = await response.json();
    expect(payload.domain).toBe('pubky.example.com');
    expect(payload.mode).toBe('token');
    expect(payload.configured).toBe(true);
  });

  it('GET reports connect mode for a locally-managed setup', async () => {
    await fs.writeFile(path.join(tmpDir, 'config.yml'), 'tunnel: x');
    await fs.writeFile(path.join(tmpDir, 'credentials.json'), '{}');
    await fs.writeFile(path.join(tmpDir, 'domain'), 'pubky.example.com');
    const { GET } = await loadRoute();
    const payload = await (await GET(getRequest())).json();
    expect(payload.mode).toBe('connect');
    expect(payload.domain).toBe('pubky.example.com');
    expect(payload.configured).toBe(true);
  });

  it('GET reports preview mode from the marker, not configured', async () => {
    await fs.writeFile(path.join(tmpDir, 'testdrive.env'), 'TUNNEL_URL=http://homeserver:6286\n');
    const { GET } = await loadRoute();
    const payload = await (await GET(getRequest())).json();
    expect(payload.mode).toBe('preview');
    expect(payload.configured).toBe(false);
  });

  describe('restart_pending', () => {
    let hsDir: string;
    const stampPath = () => path.join(hsDir, '.wrapper-boot-stamp');
    const ageTo = async (p: string, secondsAgo: number) => {
      const t = new Date(Date.now() - secondsAgo * 1000);
      await fs.utimes(p, t, t);
    };

    beforeEach(async () => {
      hsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-config-hs-test-'));
      process.env.HOMESERVER_CONFIG_PATH = path.join(hsDir, 'config.toml');
    });

    afterEach(async () => {
      await fs.rm(hsDir, { recursive: true, force: true });
    });

    it('no boot stamp (old wrapper, dev env): null, so the client falls back to in-session signals', async () => {
      await fs.writeFile(path.join(tmpDir, 'token'), VALID_TOKEN);
      const { GET } = await loadRoute();
      const payload = await (await GET(getRequest())).json();
      expect(payload.restart_pending).toBe(null);
      expect(payload.restart_reason).toBe(null);
    });

    it('stamp newer than all state: false (the wrapper has run since the change)', async () => {
      await fs.writeFile(path.join(tmpDir, 'domain'), 'pubky.example.com');
      await fs.writeFile(path.join(tmpDir, 'token'), VALID_TOKEN);
      await ageTo(path.join(tmpDir, 'domain'), 100);
      await ageTo(path.join(tmpDir, 'token'), 100);
      await ageTo(tmpDir, 100);
      await fs.writeFile(stampPath(), String(Math.floor(Date.now() / 1000)));
      const { GET } = await loadRoute();
      const payload = await (await GET(getRequest())).json();
      expect(payload.restart_pending).toBe(false);
      expect(payload.restart_reason).toBe(null);
    });

    it('setup files newer than the stamp: true with setup_changed', async () => {
      await fs.writeFile(stampPath(), 'stamp');
      await ageTo(stampPath(), 100);
      await fs.writeFile(path.join(tmpDir, 'domain'), 'pubky.example.com');
      await fs.writeFile(path.join(tmpDir, 'token'), VALID_TOKEN);
      const { GET } = await loadRoute();
      const payload = await (await GET(getRequest())).json();
      expect(payload.restart_pending).toBe(true);
      expect(payload.restart_reason).toBe('setup_changed');
    });

    it('config.toml newer than the stamp: true with config_changed', async () => {
      await fs.writeFile(stampPath(), 'stamp');
      await ageTo(stampPath(), 100);
      await ageTo(tmpDir, 200);
      await fs.writeFile(path.join(hsDir, 'config.toml'), 'icann_domain = "x"');
      const { GET } = await loadRoute();
      const payload = await (await GET(getRequest())).json();
      expect(payload.restart_pending).toBe(true);
      expect(payload.restart_reason).toBe('config_changed');
    });

    it('deletion after the boot (teardown) is caught via the config dir mtime', async () => {
      await fs.writeFile(path.join(tmpDir, 'testdrive.env'), 'TUNNEL_URL=x');
      await ageTo(path.join(tmpDir, 'testdrive.env'), 200);
      await ageTo(tmpDir, 200);
      await fs.writeFile(stampPath(), 'stamp');
      await ageTo(stampPath(), 100);
      await fs.rm(path.join(tmpDir, 'testdrive.env'));
      const { GET } = await loadRoute();
      const payload = await (await GET(getRequest())).json();
      expect(payload.restart_pending).toBe(true);
      expect(payload.restart_reason).toBe('setup_changed');
    });
  });

  it('GET never leaks the cloudflare token in the response', async () => {
    await fs.writeFile(path.join(tmpDir, 'token'), 'extremely-secret-token-xyz');
    const { GET } = await loadRoute();
    const response = await GET(getRequest());
    const payload = await response.json();
    expect(JSON.stringify(payload)).not.toContain('extremely-secret-token-xyz');
  });

  it('GET reports unsupported when CONFIG_DIR is missing', async () => {
    process.env.CLOUDFLARE_CONFIG_DIR = path.join(tmpDir, 'does-not-exist');
    const { GET } = await loadRoute();
    const response = await GET(getRequest());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.supported).toBe(false);
  });

  it('GET returns an honest 500 on an unexpected error instead of supported:false', async () => {
    vi.doMock('@/lib/server/cloudflare-mode', () => ({
      detectCloudflareMode: vi.fn().mockRejectedValue(new Error('disk exploded')),
    }));
    const { GET } = await loadRoute();
    const response = await GET(getRequest());
    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.type).toBe('internal_error');
    expect(payload.requestId).toBeTruthy();
    expect(JSON.stringify(payload)).not.toContain('supported');
    vi.doUnmock('@/lib/server/cloudflare-mode');
  });

  it('POST rejects invalid JSON body with 400', async () => {
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: '{not-json',
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.type).toBe('bad_request');
  });

  it('POST rejects disallowed domain (localhost, IP, port) with 400', async () => {
    const { POST } = await loadRoute();
    for (const domain of ['localhost', '127.0.0.1', 'example.com:8080', 'singlelabel']) {
      const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
        method: 'POST',
        body: JSON.stringify({ domain }),
        headers: { 'content-type': 'application/json' },
      });
      const response = await POST(request);
      const payload = await response.json();
      expect(response.status).toBe(400);
      expect(payload.error).toBe('Invalid domain');
    }
  });

  it('POST writes domain and token to disk', async () => {
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: JSON.stringify({ domain: 'pubky.example.com', token: VALID_TOKEN }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await fs.readFile(path.join(tmpDir, 'domain'), 'utf-8')).toBe('pubky.example.com');
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe(VALID_TOKEN);
  });

  it('POST only writes fields that are present in the body', async () => {
    await fs.writeFile(path.join(tmpDir, 'domain'), 'pre-existing.example.com');
    await fs.writeFile(path.join(tmpDir, 'token'), VALID_TOKEN);
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: JSON.stringify({ token: ANOTHER_VALID_TOKEN }),
      headers: { 'content-type': 'application/json' },
    });
    await POST(request);
    expect(await fs.readFile(path.join(tmpDir, 'domain'), 'utf-8')).toBe('pre-existing.example.com');
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe(ANOTHER_VALID_TOKEN);
  });

  it('POST trims whitespace before storing', async () => {
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: JSON.stringify({ domain: '   pubky.example.com   ', token: '   ' + VALID_TOKEN + '   ' }),
      headers: { 'content-type': 'application/json' },
    });
    await POST(request);
    expect(await fs.readFile(path.join(tmpDir, 'domain'), 'utf-8')).toBe('pubky.example.com');
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe(VALID_TOKEN);
  });

  it('POST rejects a domain-only save while a Connect setup exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'config.yml'), 'tunnel: x', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'domain'), 'old.example.com', 'utf-8');
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: JSON.stringify({ domain: 'new.example.com' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toContain('Disconnect first');
    expect(payload.error).toContain('Connect');
    // The tunnel still serves the old hostname; the domain file must not drift.
    expect(await fs.readFile(path.join(tmpDir, 'domain'), 'utf-8')).toBe('old.example.com');
  });

  it('POST allows a domain-only repoint while a manual token exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'token'), VALID_TOKEN, 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'domain'), 'old.example.com', 'utf-8');
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: JSON.stringify({ domain: 'new.example.com' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await fs.readFile(path.join(tmpDir, 'domain'), 'utf-8')).toBe('new.example.com');
  });

  it('POST rejects a domain-only save when no setup exists at all', async () => {
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: JSON.stringify({ domain: 'pubky.example.com' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toContain('token is required');
    await expect(fs.access(path.join(tmpDir, 'domain'))).rejects.toThrow();
  });

  it('POST switching to token mode removes the locally-managed config', async () => {
    await fs.writeFile(path.join(tmpDir, 'config.yml'), 'tunnel: x', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'credentials.json'), '{}', 'utf-8');
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: JSON.stringify({ domain: 'pubky.example.com', token: VALID_TOKEN }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(fs.access(path.join(tmpDir, 'config.yml'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, 'credentials.json'))).rejects.toThrow();
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe(VALID_TOKEN);
  });

  it.each([
    ['too short', 'short'],
    ['contains whitespace', 'a'.repeat(20) + ' ' + 'a'.repeat(20)],
    ['contains illegal chars', 'a'.repeat(20) + '!@#$' + 'a'.repeat(20)],
  ])('POST rejects an implausible token (%s)', async (_label, badToken) => {
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: JSON.stringify({ token: badToken }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid token');
  });
});
