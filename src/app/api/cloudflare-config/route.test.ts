// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { GET, POST } from './route';

// Real cloudflared-format tokens (base64 of {a,s,t}); the route now decodes
// them into credentials.json, so test tokens must be decodable.
const VALID_TID = '2043373f-18dd-4616-b30e-7f9d0e9d8bc6';
const mkToken = (tid: string, seed: number) =>
  Buffer.from(JSON.stringify({ a: 'acct', s: Buffer.alloc(32, seed).toString('base64'), t: tid }), 'utf-8').toString(
    'base64',
  );
const VALID_TOKEN = mkToken(VALID_TID, 2);
const ANOTHER_VALID_TID = '11111111-1111-4111-8111-111111111111';
const ANOTHER_VALID_TOKEN = mkToken(ANOTHER_VALID_TID, 3);

describe('cloudflare-config route', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-config-test-'));
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
    process.env.PLATFORM = 'umbrel'; // these flows are Umbrel-only; keep happy-paths on umbrel
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // The route reads CLOUDFLARE_CONFIG_DIR lazily (per request), so tests just
  // set the env var; no module-registry tricks needed.
  function loadRoute() {
    return { GET, POST };
  }

  const getRequest = () => new NextRequest('http://localhost:8080/api/cloudflare-config');

  it('POST refuses on standalone with 404 not_supported', async () => {
    process.env.PLATFORM = 'standalone';
    const { POST } = await loadRoute();
    const res = await POST(
      new NextRequest('http://localhost:8080/api/cloudflare-config', {
        method: 'POST',
        body: JSON.stringify({ domain: 'pubky.example.com', token: VALID_TOKEN }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).type).toBe('not_supported');
  });
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

    it('deletion after the boot (preview teardown) is caught via the teardown stamp', async () => {
      await fs.writeFile(path.join(tmpDir, 'testdrive.env'), 'TUNNEL_URL=x');
      await ageTo(path.join(tmpDir, 'testdrive.env'), 200);
      await fs.writeFile(stampPath(), 'stamp');
      await ageTo(stampPath(), 100);
      // What teardownPreview leaves behind: marker gone, stamp touched.
      await fs.rm(path.join(tmpDir, 'testdrive.env'));
      await fs.writeFile(path.join(tmpDir, '.preview-teardown-stamp'), new Date().toISOString());
      const { GET } = await loadRoute();
      const payload = await (await GET(getRequest())).json();
      expect(payload.restart_pending).toBe(true);
      expect(payload.restart_reason).toBe('preview_changed');
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
    // detectCloudflareMode swallows fs errors by design, so the only way to
    // reach the route's unexpected-error branch is a module mock. That needs
    // a fresh module registry and a dynamic import; every other test uses
    // the static import.
    vi.resetModules();
    vi.doMock('@/lib/server/cloudflare-mode', () => ({
      detectCloudflareMode: vi.fn().mockRejectedValue(new Error('disk exploded')),
    }));
    const { GET } = await import('./route');
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
    // The token is kept as the setup-method marker...
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe(VALID_TOKEN);
    // ...and the locally-managed files the single cloudflared --config service
    // runs are materialized from it.
    const creds = JSON.parse(await fs.readFile(path.join(tmpDir, 'credentials.json'), 'utf-8'));
    expect(creds.TunnelID).toBe(VALID_TID);
    expect(await fs.readFile(path.join(tmpDir, 'config.yml'), 'utf-8')).toContain(`tunnel: ${VALID_TID}`);
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

  it('POST a token paste overwrites any prior locally-managed config with the new tunnel', async () => {
    await fs.writeFile(path.join(tmpDir, 'config.yml'), 'tunnel: old', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'credentials.json'), '{"TunnelID":"old"}', 'utf-8');
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: JSON.stringify({ domain: 'pubky.example.com', token: VALID_TOKEN }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    // The single runtime mode now: the files are rewritten from the new token,
    // not deleted.
    expect(JSON.parse(await fs.readFile(path.join(tmpDir, 'credentials.json'), 'utf-8')).TunnelID).toBe(VALID_TID);
    expect(await fs.readFile(path.join(tmpDir, 'config.yml'), 'utf-8')).toContain('hostname: pubky.example.com');
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe(VALID_TOKEN);
  });

  it('POST rejects a token with no hostname to serve', async () => {
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: JSON.stringify({ token: VALID_TOKEN }), // no domain, none on disk
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toContain('domain');
    await expect(fs.access(path.join(tmpDir, 'config.yml'))).rejects.toThrow();
  });

  it.each([
    ['too short', 'short'],
    ['contains whitespace', 'a'.repeat(20) + ' ' + 'a'.repeat(20)],
    ['contains illegal chars', 'a'.repeat(20) + '!@#$' + 'a'.repeat(20)],
    // Plausible shape (long, base64-ish) but not a decodable tunnel token:
    ['plausible but undecodable', 'a'.repeat(120)],
  ])('POST rejects an invalid token (%s)', async (_label, badToken) => {
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost:8080/api/cloudflare-config', {
      method: 'POST',
      body: JSON.stringify({ domain: 'pubky.example.com', token: badToken }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toContain('Cloudflare tunnel token');
    // Nothing persisted on a rejected token.
    await expect(fs.access(path.join(tmpDir, 'config.yml'))).rejects.toThrow();
  });
});
