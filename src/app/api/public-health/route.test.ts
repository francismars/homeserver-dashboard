// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as dns } from 'dns';
import { GET } from './route';

describe('public-health route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Default: hostname resolves to a public IP. Individual tests override.
    // The `as never` cast is needed because dns.lookup has multiple overloads
    // and vi.spyOn picks the single-address one; we use the all:true overload
    // which returns an array.
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
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

  it.each([
    ['10.0.0.5', '10.0.0.0/8'],
    ['127.0.0.1', 'loopback'],
    ['169.254.169.254', 'link-local (AWS metadata)'],
    ['172.16.4.2', '172.16.0.0/12'],
    ['192.168.1.1', '192.168.0.0/16'],
    ['100.64.0.1', 'CGNAT'],
  ])('rejects domains that DNS-resolve to a private IPv4 (%s - %s)', async (privateIp) => {
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: privateIp, family: 4 }] as never);
    const fetchMock = vi.spyOn(global, 'fetch');
    const request = new NextRequest('http://localhost:8080/api/public-health?domain=internal.example.com');
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toBe('Domain does not resolve to a public address');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a public-looking hostname that resolves to a loopback IPv6', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '::1', family: 6 }] as never);
    const fetchMock = vi.spyOn(global, 'fetch');
    const request = new NextRequest('http://localhost:8080/api/public-health?domain=internal.example.com');
    const response = await GET(request);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when DNS resolution fails entirely', async () => {
    vi.spyOn(dns, 'lookup').mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
    const fetchMock = vi.spyOn(global, 'fetch');
    const request = new NextRequest('http://localhost:8080/api/public-health?domain=nxdomain.example.com');
    const response = await GET(request);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
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
