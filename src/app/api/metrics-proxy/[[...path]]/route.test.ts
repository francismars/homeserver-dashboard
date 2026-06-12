// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

describe('metrics proxy route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.METRICS_BASE_URL = 'http://homeserver:6289';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('proxies GET /metrics and passes the text payload through', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('# TYPE up gauge\nup 1\n', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; version=0.0.4' },
      }),
    );
    const request = new NextRequest('http://localhost:8080/api/metrics-proxy/metrics');

    const response = await GET(request, { params: Promise.resolve({ path: ['metrics'] }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain; version=0.0.4');
    expect(await response.text()).toContain('up 1');
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://homeserver:6289/metrics');
  });

  it('falls back to the compose-internal default base URL', async () => {
    delete process.env.METRICS_BASE_URL;
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('up 1\n', { status: 200 }));
    const request = new NextRequest('http://localhost:8080/api/metrics-proxy/metrics');

    await GET(request, { params: Promise.resolve({ path: ['metrics'] }) });

    expect(String(fetchMock.mock.calls[0][0])).toBe('http://homeserver:6289/metrics');
  });

  it('maps connection failures to upstream errors', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const request = new NextRequest('http://localhost:8080/api/metrics-proxy/metrics');

    const response = await GET(request, { params: Promise.resolve({ path: ['metrics'] }) });
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.type).toBe('upstream_error');
  });
});
