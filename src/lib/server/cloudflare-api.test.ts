// @vitest-environment node
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CfApiError,
  type CfZone,
  createDnsRecord,
  createTunnel,
  deleteDnsRecord,
  findTunnelByName,
  getTunnelToken,
  getZone,
  listDnsRecordsAtName,
  listZones,
  putTunnelIngress,
  updateDnsRecord,
} from './cloudflare-api';

const API_BASE = 'https://api.cloudflare.com/client/v4';
const TOKEN = 'cf-test-token-abcdefghijklmnop';

const cfResponse = (status: number, json: unknown) =>
  new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (result: unknown) => cfResponse(200, { success: true, errors: [], result });
const zone = (n: number): CfZone => ({
  id: `zone-${n}`,
  name: `z${n}.example`,
  status: 'active',
  account: { id: 'acc-1' },
});

describe('cloudflare-api client', () => {
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, 'fetch') as unknown as Mock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the token as a Bearer header, never in the URL', async () => {
    fetchMock.mockResolvedValue(ok([]));
    await listZones(TOKEN);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain(TOKEN);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  describe('listZones', () => {
    it('returns a single short page with one request', async () => {
      fetchMock.mockResolvedValue(ok([zone(1), zone(2)]));
      const zones = await listZones(TOKEN);
      expect(zones.map((z) => z.id)).toEqual(['zone-1', 'zone-2']);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_BASE}/zones?per_page=50&page=1`);
    });

    it('follows pagination until a short page', async () => {
      const fullPage = Array.from({ length: 50 }, (_, i) => zone(i));
      fetchMock.mockResolvedValueOnce(ok(fullPage)).mockResolvedValueOnce(ok([zone(50)]));
      const zones = await listZones(TOKEN);
      expect(zones).toHaveLength(51);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1][0])).toBe(`${API_BASE}/zones?per_page=50&page=2`);
    });

    it('stops at the 20-page runaway ceiling', async () => {
      const fullPage = Array.from({ length: 50 }, (_, i) => zone(i));
      // Fresh Response per call: a body can only be consumed once.
      fetchMock.mockImplementation(async () => ok(fullPage));
      const zones = await listZones(TOKEN);
      expect(zones).toHaveLength(1000);
      expect(fetchMock).toHaveBeenCalledTimes(20);
    });
  });

  describe('error mapping', () => {
    it('surfaces Cloudflare error codes and messages on auth failure', async () => {
      fetchMock.mockResolvedValue(
        cfResponse(403, { success: false, errors: [{ code: 9109, message: 'Invalid access token' }], result: null }),
      );
      const error = await listZones(TOKEN).catch((e) => e);
      expect(error).toBeInstanceOf(CfApiError);
      expect(error.status).toBe(403);
      expect(error.codes).toEqual([9109]);
      expect(error.messages).toEqual(['Invalid access token']);
      expect(error.message).not.toContain(TOKEN);
    });

    it('preserves a 429 status for rate limiting', async () => {
      fetchMock.mockResolvedValue(
        cfResponse(429, { success: false, errors: [{ code: 971, message: 'rate limited' }], result: null }),
      );
      const error = await listZones(TOKEN).catch((e) => e);
      expect(error).toBeInstanceOf(CfApiError);
      expect(error.status).toBe(429);
    });

    it('maps a non-JSON response body to a CfApiError', async () => {
      fetchMock.mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 }));
      const error = await listZones(TOKEN).catch((e) => e);
      expect(error).toBeInstanceOf(CfApiError);
      expect(error.status).toBe(502);
      expect(error.messages[0]).toContain('non-JSON');
    });

    it('treats an explicit success:false as failure even on HTTP 200', async () => {
      fetchMock.mockResolvedValue(
        cfResponse(200, { success: false, errors: [{ code: 81053, message: 'record already exists' }], result: null }),
      );
      const error = await createDnsRecord(TOKEN, 'zone-1', 'pubky.example.com', 'tun-1').catch((e) => e);
      expect(error).toBeInstanceOf(CfApiError);
      expect(error.codes).toEqual([81053]);
    });

    it('tolerates a missing errors array', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 500 }));
      const error = await listZones(TOKEN).catch((e) => e);
      expect(error).toBeInstanceOf(CfApiError);
      expect(error.codes).toEqual([]);
      expect(error.messages).toEqual([]);
    });

    it('accepts a bare 2xx result envelope without success/errors fields', async () => {
      // DNS-record DELETE answers {"result": {...}} with no success field.
      fetchMock.mockResolvedValue(cfResponse(200, { result: { id: 'rec-1' } }));
      await expect(deleteDnsRecord(TOKEN, 'zone-1', 'rec-1')).resolves.toEqual({ id: 'rec-1' });
    });
  });

  describe('zone and tunnel calls', () => {
    it('getZone fetches the zone by URL-encoded id', async () => {
      fetchMock.mockResolvedValue(ok(zone(1)));
      await getZone(TOKEN, 'zone/../1');
      expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_BASE}/zones/zone%2F..%2F1`);
    });

    it('createTunnel posts a remote-config tunnel and returns its token', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'tun-1', name: 'pubky-homeserver', token: 'tunnel-token' }));
      const tunnel = await createTunnel(TOKEN, 'acc-1', 'pubky-homeserver');
      expect(tunnel).toEqual({ id: 'tun-1', name: 'pubky-homeserver', token: 'tunnel-token' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${API_BASE}/accounts/acc-1/cfd_tunnel`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ name: 'pubky-homeserver', config_src: 'cloudflare' });
    });

    it('findTunnelByName adopts only an exact, non-deleted name match', async () => {
      fetchMock.mockResolvedValue(
        ok([
          { id: 'tun-other', name: 'pubky-homeserver-local' },
          { id: 'tun-1', name: 'pubky-homeserver' },
        ]),
      );
      const tunnel = await findTunnelByName(TOKEN, 'acc-1', 'pubky-homeserver');
      expect(tunnel?.id).toBe('tun-1');
      expect(String(fetchMock.mock.calls[0][0])).toBe(
        `${API_BASE}/accounts/acc-1/cfd_tunnel?name=pubky-homeserver&is_deleted=false`,
      );
    });

    it('findTunnelByName returns null when nothing matches exactly', async () => {
      fetchMock.mockResolvedValue(ok([{ id: 'tun-other', name: 'pubky-homeserver-local' }]));
      await expect(findTunnelByName(TOKEN, 'acc-1', 'pubky-homeserver')).resolves.toBeNull();
    });

    it('getTunnelToken fetches the token for an existing tunnel', async () => {
      fetchMock.mockResolvedValue(ok('adopted-token'));
      await expect(getTunnelToken(TOKEN, 'acc-1', 'tun-1')).resolves.toBe('adopted-token');
      expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_BASE}/accounts/acc-1/cfd_tunnel/tun-1/token`);
    });

    it('putTunnelIngress publishes the hostname with a 404 fallback rule', async () => {
      fetchMock.mockResolvedValue(ok({}));
      await putTunnelIngress(TOKEN, 'acc-1', 'tun-1', 'pubky.example.com');
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${API_BASE}/accounts/acc-1/cfd_tunnel/tun-1/configurations`);
      expect(init.method).toBe('PUT');
      const body = JSON.parse(init.body as string);
      expect(body.config.ingress).toHaveLength(2);
      expect(body.config.ingress[0].hostname).toBe('pubky.example.com');
      expect(body.config.ingress[1]).toEqual({ service: 'http_status:404' });
    });
  });

  describe('dns record calls', () => {
    it('listDnsRecordsAtName queries via the exact-match name filter with no type filter', async () => {
      fetchMock.mockResolvedValue(ok([]));
      await listDnsRecordsAtName(TOKEN, 'zone-1', 'pubky.example.com');
      expect(String(fetchMock.mock.calls[0][0])).toBe(
        `${API_BASE}/zones/zone-1/dns_records?name.exact=pubky.example.com`,
      );
    });

    it('createDnsRecord creates a proxied CNAME at the tunnel address', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'rec-1' }));
      await createDnsRecord(TOKEN, 'zone-1', 'pubky.example.com', 'tun-1');
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${API_BASE}/zones/zone-1/dns_records`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        type: 'CNAME',
        proxied: true,
        name: 'pubky.example.com',
        content: 'tun-1.cfargotunnel.com',
      });
    });

    it('updateDnsRecord rewrites an existing record in place', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'rec-1' }));
      await updateDnsRecord(TOKEN, 'zone-1', 'rec-1', 'pubky.example.com', 'tun-2');
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${API_BASE}/zones/zone-1/dns_records/rec-1`);
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string).content).toBe('tun-2.cfargotunnel.com');
    });

    it('deleteDnsRecord issues a DELETE for the record', async () => {
      fetchMock.mockResolvedValue(cfResponse(200, { result: { id: 'rec-1' } }));
      await deleteDnsRecord(TOKEN, 'zone-1', 'rec-1');
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${API_BASE}/zones/zone-1/dns_records/rec-1`);
      expect(init.method).toBe('DELETE');
    });
  });
});
