import { promises as dns } from 'dns';

/**
 * Cheap syntactic gate: rejects obvious non-public targets (localhost, IPv4
 * literals, hostnames with a port, single-label names). This runs first;
 * even when it passes, callers that are going to make an outbound request
 * MUST also call `resolvesToPublicAddress` to defend against a public-looking
 * hostname that resolves to a private IP.
 */
export function isAllowedPublicHostname(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (domain.startsWith('localhost') || domain.endsWith('.localhost')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return false;
  if (domain.includes(':')) return false;
  if (!domain.includes('.')) return false;
  return true;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // current network
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true; // unspecified + loopback
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
  if (lower.startsWith('ff')) return true; // multicast
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 - check the embedded address
    const v4 = lower.replace('::ffff:', '');
    return isPrivateIPv4(v4);
  }
  return false;
}

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
