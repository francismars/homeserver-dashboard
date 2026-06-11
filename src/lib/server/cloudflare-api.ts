/**
 * Minimal Cloudflare v4 API client for the automatic tunnel setup flow.
 *
 * Verified against Cloudflare's "Create a tunnel (API)" guide:
 * https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel-api/
 *
 * Security invariants (do not weaken):
 * - The API token is passed per-call and NEVER persisted, logged, or echoed
 *   into error messages. CfApiError carries only status + Cloudflare's own
 *   error codes/messages.
 * - CF_API_BASE is overridable for tests/e2e only; defaults to the real API.
 */

const CF_API_BASE = process.env.CF_API_BASE || 'https://api.cloudflare.com/client/v4';
const CALL_TIMEOUT_MS = 15_000;

/** The fixed tunnel name the app owns. Re-runs adopt it (idempotency). */
export const TUNNEL_NAME = 'pubky-homeserver';
/** Where the tunnel forwards traffic inside the Umbrel network. */
export const INGRESS_SERVICE = 'http://homeserver:6286';

export class CfApiError extends Error {
  status: number;
  /** Cloudflare error codes, e.g. 81053 for "record already exists". */
  codes: number[];
  messages: string[];

  constructor(status: number, codes: number[], messages: string[]) {
    super(`Cloudflare API error (HTTP ${status}): ${messages.join('; ') || 'unknown'}`);
    this.status = status;
    this.codes = codes;
    this.messages = messages;
  }
}

interface CfEnvelope<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

async function cfFetch<T>(apiToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CF_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });

  let envelope: CfEnvelope<T>;
  try {
    envelope = (await response.json()) as CfEnvelope<T>;
  } catch {
    throw new CfApiError(response.status, [], [`Unexpected non-JSON response from Cloudflare`]);
  }

  if (!response.ok || !envelope.success) {
    const errors = Array.isArray(envelope.errors) ? envelope.errors : [];
    throw new CfApiError(
      response.status,
      errors.map((e) => e.code),
      errors.map((e) => e.message),
    );
  }
  return envelope.result;
}

export interface CfZone {
  id: string;
  name: string;
  status: string;
  account: { id: string; name?: string };
}

/**
 * Lists zones the token can see. Doubles as token validation: an invalid or
 * expired token fails here with 401/403 before we touch anything else.
 */
export function listZones(apiToken: string): Promise<CfZone[]> {
  return cfFetch<CfZone[]>(apiToken, '/zones?per_page=50');
}

export function getZone(apiToken: string, zoneId: string): Promise<CfZone> {
  return cfFetch<CfZone>(apiToken, `/zones/${encodeURIComponent(zoneId)}`);
}

export interface CfTunnel {
  id: string;
  name: string;
  /** Present on create responses; absent from list responses. */
  token?: string;
}

export async function findTunnelByName(apiToken: string, accountId: string, name: string): Promise<CfTunnel | null> {
  const tunnels = await cfFetch<CfTunnel[]>(
    apiToken,
    `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`,
  );
  return tunnels.find((t) => t.name === name) ?? null;
}

export function createTunnel(apiToken: string, accountId: string, name: string): Promise<CfTunnel> {
  return cfFetch<CfTunnel>(apiToken, `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel`, {
    method: 'POST',
    body: JSON.stringify({ name, config_src: 'cloudflare' }),
  });
}

export function getTunnelToken(apiToken: string, accountId: string, tunnelId: string): Promise<string> {
  return cfFetch<string>(
    apiToken,
    `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel/${encodeURIComponent(tunnelId)}/token`,
  );
}

export function putTunnelIngress(
  apiToken: string,
  accountId: string,
  tunnelId: string,
  hostname: string,
): Promise<unknown> {
  return cfFetch(
    apiToken,
    `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel/${encodeURIComponent(tunnelId)}/configurations`,
    {
      method: 'PUT',
      body: JSON.stringify({
        config: {
          ingress: [{ hostname, service: INGRESS_SERVICE }, { service: 'http_status:404' }],
        },
      }),
    },
  );
}

export interface CfDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
}

/** All records at this exact name, any type - A/AAAA conflicts matter too. */
export function listDnsRecordsAtName(apiToken: string, zoneId: string, hostname: string): Promise<CfDnsRecord[]> {
  return cfFetch<CfDnsRecord[]>(
    apiToken,
    `/zones/${encodeURIComponent(zoneId)}/dns_records?name=${encodeURIComponent(hostname)}`,
  );
}

export function createDnsRecord(
  apiToken: string,
  zoneId: string,
  hostname: string,
  tunnelId: string,
): Promise<CfDnsRecord> {
  return cfFetch<CfDnsRecord>(apiToken, `/zones/${encodeURIComponent(zoneId)}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'CNAME',
      proxied: true,
      name: hostname,
      content: `${tunnelId}.cfargotunnel.com`,
    }),
  });
}

export function updateDnsRecord(
  apiToken: string,
  zoneId: string,
  recordId: string,
  hostname: string,
  tunnelId: string,
): Promise<CfDnsRecord> {
  return cfFetch<CfDnsRecord>(
    apiToken,
    `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        type: 'CNAME',
        proxied: true,
        name: hostname,
        content: `${tunnelId}.cfargotunnel.com`,
      }),
    },
  );
}

export function deleteDnsRecord(apiToken: string, zoneId: string, recordId: string): Promise<unknown> {
  return cfFetch(apiToken, `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
  });
}
