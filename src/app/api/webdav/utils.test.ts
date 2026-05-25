import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxyWebDavRequest } from './utils';

describe('webdav proxy utils', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ADMIN_BASE_URL = 'http://homeserver:6286';
    process.env.ADMIN_TOKEN = 'secret-token';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns sanitized config error when env is missing', async () => {
    delete process.env.ADMIN_BASE_URL;
    delete process.env.ADMIN_TOKEN;

    const request = new NextRequest('http://localhost:8080/api/webdav');
    const response = await proxyWebDavRequest(request, Promise.resolve({ path: [] }), 'GET');
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('WebDAV proxy is not configured');
    expect(payload).not.toHaveProperty('details');
  });

  it('rejects unsupported method override', async () => {
    const request = new NextRequest('http://localhost:8080/api/webdav/test', {
      method: 'POST',
      headers: {
        'X-HTTP-Method-Override': 'TRACE',
      },
    });

    const response = await proxyWebDavRequest(request, Promise.resolve({ path: ['test'] }), 'POST');
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.type).toBe('bad_request');
  });

  it.each([
    [['..'], 'parent segment'],
    [['user', '..', '..', 'etc'], 'mid-path parent'],
    [['.'], 'current-dir segment'],
    [['foo\0bar'], 'null byte'],
    [['foo/bar'], 'embedded slash'],
    [['foo\\bar'], 'embedded backslash'],
  ])('rejects path with %s (%s)', async (path) => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const request = new NextRequest('http://localhost:8080/api/webdav/' + path.join('/'));
    const response = await proxyWebDavRequest(request, Promise.resolve({ path }), 'GET');
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.type).toBe('bad_request');
    expect(payload.error).toBe('Invalid path segment');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies PROPFIND responses successfully', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('<multistatus />', {
        status: 207,
        headers: { 'Content-Type': 'application/xml' },
      }),
    );

    const request = new NextRequest('http://localhost:8080/api/webdav/user/pub', {
      method: 'POST',
      headers: {
        'X-HTTP-Method-Override': 'PROPFIND',
        Depth: '1',
      },
    });

    const response = await proxyWebDavRequest(request, Promise.resolve({ path: ['user', 'pub'] }), 'POST');
    const body = await response.text();

    expect(response.status).toBe(207);
    expect(body).toContain('multistatus');
    expect(response.headers.get('X-Request-Id')).toBeTruthy();
  });
});
