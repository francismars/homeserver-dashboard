// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const TOKEN = 'cf-test-token-abcdefghijklmnop';

function cfResponse(status: number, json: unknown) {
  return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('cloudflare-auto-setup zones route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.PLATFORM = 'umbrel'; // zones is part of the Umbrel-only auto-setup flow
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PLATFORM;
  });

  async function post(body: unknown) {
    return POST(
      new NextRequest('http://localhost:8080/api/cloudflare-auto-setup/zones', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  it('refuses on standalone with 404 not_supported (never proxies the token)', async () => {
    process.env.PLATFORM = 'standalone';
    const fetchSpy = vi.spyOn(global, 'fetch');
    const res = await post({ api_token: 'a'.repeat(40) });
    expect(res.status).toBe(404);
    expect((await res.json()).type).toBe('not_supported');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns the zones the token can see', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      cfResponse(200, {
        success: true,
        errors: [],
        result: [{ id: 'a'.repeat(32), name: 'example.com', status: 'active', account: { id: 'acc-1' } }],
      }),
    );
    const res = await post({ api_token: TOKEN });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.zones).toEqual([{ id: 'a'.repeat(32), name: 'example.com', status: 'active', account_id: 'acc-1' }]);
  });

  it('maps a Cloudflare 429 to a friendly rate-limit message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      cfResponse(429, { success: false, errors: [{ code: 971, message: 'rate limited' }], result: null }),
    );
    const res = await post({ api_token: TOKEN });
    const data = await res.json();
    expect(res.status).toBe(429);
    expect(data.error).toBe('Cloudflare is rate limiting requests. Wait a minute and try again.');
  });

  it('still maps auth failures to the token guidance', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      cfResponse(403, { success: false, errors: [{ code: 9109, message: 'forbidden' }], result: null }),
    );
    const res = await post({ api_token: TOKEN });
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toContain('Cloudflare rejected the token');
  });

  it('maps a 400 with Cloudflare code 6003 (malformed header) to the token guidance', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      cfResponse(400, { success: false, errors: [{ code: 6003, message: 'Invalid request headers' }], result: null }),
    );
    const res = await post({ api_token: TOKEN });
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toContain('Cloudflare rejected the token');
  });

  it('maps other Cloudflare API errors to a 502 with their message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      cfResponse(500, { success: false, errors: [{ code: 1000, message: 'internal error' }], result: null }),
    );
    const res = await post({ api_token: TOKEN });
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.error).toBe('Cloudflare API error: internal error');
  });

  it('maps a network failure to a 502 unreachable message', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const res = await post({ api_token: TOKEN });
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.error).toBe('Could not reach the Cloudflare API');
  });

  it('rejects an invalid JSON payload with 400', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const res = await POST(
      new NextRequest('http://localhost:8080/api/cloudflare-auto-setup/zones', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', {}],
    ['non-string', { api_token: 42 }],
    ['too short', { api_token: 'short' }],
    ['too long', { api_token: 'x'.repeat(300) }],
    ['whitespace inside', { api_token: 'aaaaaaaaaa bbbbbbbbbbbb' }],
  ])('rejects a %s api_token with 400 before calling Cloudflare', async (_label, body) => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const res = await post(body);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Missing or malformed api_token');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
