import { promises as dns } from 'dns';
import { isPrivateIPv4, isPrivateIPv6 } from '@/lib/address-scope';

/**
 * Cheap syntactic gate: rejects obvious non-public targets (localhost, IPv4
 * literals, hostnames with a port, single-label names). This runs first;
 * even when it passes, callers that are going to make an outbound request
 * MUST also call `resolvesToPublicAddress` to defend against a public-looking
 * hostname that resolves to a private IP.
 */
export function isAllowedPublicHostname(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (domain === 'localhost' || domain.endsWith('.localhost')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return false;
  if (domain.includes(':')) return false;
  if (!domain.includes('.')) return false;
  return true;
}

// The fail-closed private-range predicates live in the client-safe module
// src/lib/address-scope.ts (shared with the Overview's address-scope badge);
// only the DNS resolution below is node-specific.

/**
 * Defense against DNS-based SSRF: resolve `hostname` to its A/AAAA records
 * and require ALL returned addresses to be public. Fails closed if there
 * are no records, on any resolver error, or if any address is private.
 *
 * Pair with `isAllowedPublicHostname`: the syntactic check rejects names
 * that obviously target the local box; this one catches a public-looking
 * name that resolves to an internal IP.
 *
 * Note: this does not defend against DNS rebinding (the IP changing
 * between this resolution and a later fetch). Mitigating that requires
 * pinning the connection to a specific IP, which is heavier; acceptable
 * for the dashboard's threat model (operator probing their own homeserver).
 */
export async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  try {
    // Use dns.lookup (getaddrinfo) instead of dns.resolve4/6 (c-ares). c-ares
    // can fail silently inside containers where /etc/resolv.conf points at
    // Docker's embedded resolver (127.0.0.11); getaddrinfo handles it
    // reliably. verbatim:true preserves the resolver's address order so we
    // do not depend on Node's heuristic v6-vs-v4 sorting. all:true returns
    // every address so we can still reject if any single one is private.
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    if (results.length === 0) return false;
    return results.every(({ address, family }) => (family === 6 ? !isPrivateIPv6(address) : !isPrivateIPv4(address)));
  } catch {
    return false;
  }
}
