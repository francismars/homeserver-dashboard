import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

describe('public-health route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects missing domain with 400', async () => {
    const request = new NextRequest('http://localhost:8080/api/public-health');
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.type).toBe('bad_request');
    expect(payload.error).toBe('Missing domain');
  });

  it.each([
    ['localhost', 'bare localhost'],
    ['umbrel.localhost', 'localhost subdomain'],
    ['10.0.0.1', 'IPv4 literal'],
    ['example.com:8080', 'host with port'],
    ['singlelabel', 'no dot'],
  ])('rejects disallowed hostname %s (%s)', async (domain) => {
    const request = new NextRequest(`http://localhost:8080/api/public-health?domain=${encodeURIComponent(domain)}`);
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.type).toBe('bad_request');
    expect(payload.error).toBe('Domain not allowed');
  });

  it('returns ok:true with upstream status on 2xx', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const request = new NextRequest('http://localhost:8080/api/public-health?domain=pubky.example.com');
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://pubky.example.com');
  });

  it('returns ok:false on upstream 5xx without erroring', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 502 }));
    const request = new NextRequest('http://localhost:8080/api/public-health?domain=pubky.example.com');
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(false);
    expect(payload.status).toBe(502);
  });

  it('lowercases and trims the domain before probing', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const request = new NextRequest('http://localhost:8080/api/public-health?domain=%20PUBKY.Example.COM%20');
    await GET(request);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://pubky.example.com');
  });

  it('maps abort errors to 504 timeout', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new DOMException('Timed out', 'AbortError'));
    const request = new NextRequest('http://localhost:8080/api/public-health?domain=pubky.example.com');
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(504);
    expect(payload.type).toBe('timeout');
  });

  it('maps generic fetch failure to 502 upstream_error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    const request = new NextRequest('http://localhost:8080/api/public-health?domain=pubky.example.com');
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(502);
    expect(payload.type).toBe('upstream_error');
    expect(payload.error).toBe('Public URL probe failed');
    expect(payload).not.toHaveProperty('details');
  });

  it('sends a Pubky-branded User-Agent header', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const request = new NextRequest('http://localhost:8080/api/public-health?domain=pubky.example.com');
    await GET(request);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toEqual(expect.objectContaining({ 'User-Agent': expect.stringContaining('Pubky') }));
  });
});
