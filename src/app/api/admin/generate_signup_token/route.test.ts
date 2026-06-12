// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

describe('generate_signup_token route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.ADMIN_BASE_URL = 'http://homeserver:6286';
    process.env.ADMIN_TOKEN = 'secret-token';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns config_error when env is missing', async () => {
    delete process.env.ADMIN_BASE_URL;
    delete process.env.ADMIN_TOKEN;
    const request = new NextRequest('http://localhost:8080/api/admin/generate_signup_token');
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.type).toBe('config_error');
    expect(payload).not.toHaveProperty('attemptedUrl');
  });

  it('forwards X-Admin-Password header to upstream and returns the token', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('the-token', { status: 200 }));
    const request = new NextRequest('http://localhost:8080/api/admin/generate_signup_token');
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.token).toBe('the-token');
    const [urlArg, initArg] = fetchMock.mock.calls[0];
    expect(String(urlArg)).toBe('http://homeserver:6286/generate_signup_token');
    expect((initArg as RequestInit).headers).toEqual(expect.objectContaining({ 'X-Admin-Password': 'secret-token' }));
  });

  it('never leaks the admin token in the response payload', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('the-token', { status: 200 }));
    const request = new NextRequest('http://localhost:8080/api/admin/generate_signup_token');
    const response = await GET(request);
    const payload = await response.json();
    expect(JSON.stringify(payload)).not.toContain('secret-token');
  });

  it('passes through non-2xx upstream status as upstream_error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('forbidden', { status: 403 }));
    const request = new NextRequest('http://localhost:8080/api/admin/generate_signup_token');
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(payload.type).toBe('upstream_error');
  });

  it('maps abort errors to 504 timeout', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new DOMException('Timed out', 'AbortError'));
    const request = new NextRequest('http://localhost:8080/api/admin/generate_signup_token');
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(504);
    expect(payload.type).toBe('timeout');
  });

  it('maps connection errors to 502 upstream_error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const request = new NextRequest('http://localhost:8080/api/admin/generate_signup_token');
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(502);
    expect(payload.type).toBe('upstream_error');
  });
});
