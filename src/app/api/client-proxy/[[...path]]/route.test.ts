// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

describe('client proxy route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CLIENT_BASE_URL = 'http://homeserver:6286';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('proxies GET to the client base URL and forwards query params', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const request = new NextRequest('http://localhost:8080/api/client-proxy/events/?limit=10');

    const response = await GET(request, { params: Promise.resolve({ path: ['events', ''] }) });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('[]');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://homeserver:6286/events/?limit=10');
  });

  it('reaches the upstream root when no path segments are given', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const request = new NextRequest('http://localhost:8080/api/client-proxy');

    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://homeserver:6286/');
  });

  it('falls back to the compose-internal default base URL', async () => {
    delete process.env.CLIENT_BASE_URL;
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const request = new NextRequest('http://localhost:8080/api/client-proxy/signup');

    await GET(request, { params: Promise.resolve({ path: ['signup'] }) });

    expect(String(fetchMock.mock.calls[0][0])).toBe('http://homeserver:6286/signup');
  });

  it('forwards POST bodies as raw bytes', async () => {
    const bytes = new Uint8Array([0x01, 0x00, 0xfe]);
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
    const request = new NextRequest('http://localhost:8080/api/client-proxy/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
    });

    const response = await POST(request, { params: Promise.resolve({ path: ['signup'] }) });

    expect(response.status).toBe(201);
    const [, init] = fetchMock.mock.calls[0];
    expect(Array.from(new Uint8Array(init?.body as Buffer))).toEqual(Array.from(bytes));
  });

  it('maps abort failures to timeout errors without retrying', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockRejectedValue(new DOMException('Timed out', 'AbortError'));
    const request = new NextRequest('http://localhost:8080/api/client-proxy/events/');

    const response = await GET(request, { params: Promise.resolve({ path: ['events', ''] }) });
    const payload = await response.json();

    expect(response.status).toBe(504);
    expect(payload.type).toBe('timeout');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
