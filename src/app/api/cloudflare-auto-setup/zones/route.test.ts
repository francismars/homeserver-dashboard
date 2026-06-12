import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN = 'cf-test-token-abcdefghijklmnop';

function cfResponse(status: number, json: unknown) {
  return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('cloudflare-auto-setup zones route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function post(body: unknown) {
    const { POST } = await import('./route');
    return POST(
      new NextRequest('http://localhost:8080/api/cloudflare-auto-setup/zones', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

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
});
