/**
 * Cloudflare dashboard deep links, used to point an operator at the exact page
 * where they can fix a setup conflict (a clashing DNS record, a leftover
 * tunnel). Pure string builders — no I/O, no secrets.
 *
 * When the account id is known we link directly (the API-token flow always has
 * it; a modern connect cert carries it). When it is not — a legacy connect cert
 * that only yields a zone name, or neither — we fall back to Cloudflare's
 * documented `?to=/:account/...` redirect, which prompts the account picker and
 * then resolves the rest of the path. `:zone` likewise stands in for an unknown
 * zone name. Both placeholder forms are officially supported.
 */

const DASH = 'https://dash.cloudflare.com';
const ZERO_TRUST = 'https://one.dash.cloudflare.com';

/**
 * The DNS-records management page for a zone. The second path segment is the
 * zone NAME (the domain, e.g. `example.com`), not the zone id.
 */
export function cfDnsRecordsUrl(accountId: string | null | undefined, zoneName: string | null | undefined): string {
  if (accountId && zoneName) return `${DASH}/${accountId}/${zoneName}/dns`;
  const account = accountId || ':account';
  const zone = zoneName || ':zone';
  return `${DASH}/?to=/${account}/${zone}/dns`;
}

/** The Zero Trust → Networks → Tunnels list (account id is in the path). */
export function cfTunnelsUrl(accountId: string | null | undefined): string {
  if (accountId) return `${ZERO_TRUST}/${accountId}/networks/tunnels`;
  return `${ZERO_TRUST}/?to=/:account/networks/tunnels`;
}
