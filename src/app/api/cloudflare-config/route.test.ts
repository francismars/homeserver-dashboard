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

  it('GET returns unconfigured when no files exist', async () => {
    const { GET } = await loadRoute();
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.domain).toBe(null);
    expect(payload.configured).toBe(false);
    expect(payload.supported).toBe(true);
  });

  it('GET reports configured when both domain and token are present', async () => {
    await fs.writeFile(path.join(tmpDir, 'domain'), 'pubky.example.com');
    await fs.writeFile(path.join(tmpDir, 'token'), VALID_TOKEN);
    const { GET } = await loadRoute();
    const response = await GET();
    const payload = await response.json();
    expect(payload.domain).toBe('pubky.example.com');
    expect(payload.configured).toBe(true);
  });

  it('GET never leaks the cloudflare token in the response', async () => {
    await fs.writeFile(path.join(tmpDir, 'token'), 'extremely-secret-token-xyz');
    const { GET } = await loadRoute();
    const response = await GET();
    const payload = await response.json();
    expect(JSON.stringify(payload)).not.toContain('extremely-secret-token-xyz');
  });

  it('GET reports unsupported when CONFIG_DIR is missing', async () => {
    process.env.CLOUDFLARE_CONFIG_DIR = path.join(tmpDir, 'does-not-exist');
    const { GET } = await loadRoute();
    const response = await GET();
    const payload = await response.json();
    expect(payload.supported).toBe(false);
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
