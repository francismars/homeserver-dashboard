// Pure, client-safe address classification. No node: imports - this module is
// shared between client components (the Overview's address-scope badge) and
// the server-side SSRF guard in src/lib/server/hostname.ts.

/**
 * Where an address can be reached from:
 * - 'loopback': only this machine (127.0.0.0/8, ::1, literal "localhost")
 * - 'private': only the local network (RFC1918, link-local, CGNAT, IPv6 ULA)
 * - 'public': an IP literal outside every non-routable range
 * - 'hostname': a DNS name; scope depends on what it resolves to
 * - 'invalid': not an address (empty, URLs, garbage)
 */
export type AddressScope = 'loopback' | 'private' | 'public' | 'hostname' | 'invalid';

/** Strict dotted-quad parse: exactly four decimal octets, each 0-255. */
function parseIPv4(host: string): number[] | null {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split('.').map(Number);
  return parts.every((n) => n <= 255) ? parts : null;
}

/** Parses an IPv6 literal (no brackets) into its eight 16-bit groups,
 * expanding "::" and an embedded IPv4 tail. Returns null when malformed. */
function parseIPv6(host: string): number[] | null {
  const sections = host.split('::');
  if (sections.length > 2) return null;

  const toGroups = (chunk: string, v4TailAllowed: boolean): number[] | null => {
    if (chunk === '') return [];
    const parts = chunk.split(':');
    const out: number[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.includes('.')) {
        // IPv4-in-IPv6 tail (e.g. ::ffff:10.0.0.1): only valid at the very end
        if (!v4TailAllowed || i !== parts.length - 1) return null;
        const v4 = parseIPv4(part);
        if (!v4) return null;
        out.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
        out.push(parseInt(part, 16));
      }
    }
    return out;
  };

  if (sections.length === 1) {
    const groups = toGroups(sections[0], true);
    return groups && groups.length === 8 ? groups : null;
  }
  const head = toGroups(sections[0], false);
  const tail = toGroups(sections[1], true);
  if (!head || !tail) return null;
  const elided = 8 - head.length - tail.length;
  if (elided < 1) return null; // "::" must stand for at least one zero group
  return [...head, ...(Array(elided).fill(0) as number[]), ...tail];
}

function classifyIPv4(parts: number[]): AddressScope {
  const [a, b] = parts;
  if (a === 127) return 'loopback';
  if (a === 10) return 'private'; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return 'private'; // 172.16.0.0/12
  if (a === 192 && b === 168) return 'private'; // 192.168.0.0/16
  if (a === 169 && b === 254) return 'private'; // link-local 169.254.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return 'private'; // CGNAT 100.64.0.0/10
  return 'public';
}

function classifyIPv6(groups: number[]): AddressScope {
  const leadingZeros = (n: number) => groups.slice(0, n).every((g) => g === 0);
  if (leadingZeros(7) && groups[7] === 1) return 'loopback'; // ::1
  if ((groups[0] & 0xffc0) === 0xfe80) return 'private'; // link-local fe80::/10
  if ((groups[0] & 0xfe00) === 0xfc00) return 'private'; // unique-local fc00::/7
  if (leadingZeros(5) && groups[5] === 0xffff) {
    // IPv4-mapped (::ffff:a.b.c.d): scope is the embedded IPv4's
    return classifyIPv4([groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff]);
  }
  return 'public';
}

/** ":12345" with a port in 0-65535. */
function isPortSuffix(rest: string): boolean {
  if (!rest.startsWith(':')) return false;
  const port = rest.slice(1);
  return /^\d{1,5}$/.test(port) && Number(port) <= 65535;
}

/** Strips an optional port ("host:1234", "[v6]:1234") and brackets. Returns
 * the bare host, or null when the input cannot be a host. Two or more colons
 * without brackets are taken as a bare IPv6 literal. */
function extractHost(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith('[')) {
    const end = s.indexOf(']');
    if (end <= 1) return null;
    const rest = s.slice(end + 1);
    if (rest !== '' && !isPortSuffix(rest)) return null;
    return s.slice(1, end);
  }
  const firstColon = s.indexOf(':');
  if (firstColon !== -1 && !s.includes(':', firstColon + 1)) {
    // exactly one colon: must be host:port (hostnames cannot contain ":")
    if (!isPortSuffix(s.slice(firstColon))) return null;
    return firstColon > 0 ? s.slice(0, firstColon) : null;
  }
  return s;
}

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.?$/;

/**
 * Classifies a published address (host or host:port; IPv4, IPv6 with or
 * without brackets, or a DNS name) by who could plausibly reach it. Purely
 * syntactic: a 'public' verdict means publicly *routable*, not reachable.
 */
export function classifyAddress(address: string): AddressScope {
  const host = extractHost(address);
  if (!host) return 'invalid';
  if (host === 'localhost') return 'loopback';
  const v4 = parseIPv4(host);
  if (v4) return classifyIPv4(v4);
  if (host.includes(':')) {
    const v6 = parseIPv6(host);
    return v6 ? classifyIPv6(v6) : 'invalid';
  }
  // Digits-and-dots that failed the IPv4 parse ("999.1.1.1", "1.2.3.4.5") is
  // a broken IP, not a hostname.
  if (/^[\d.]+$/.test(host)) return 'invalid';
  return host.length <= 253 && HOSTNAME_RE.test(host) ? 'hostname' : 'invalid';
}

// ---------------------------------------------------------------------------
// Fail-closed predicates for the server-side SSRF guard (hostname.ts). These
// deliberately differ from classifyAddress: anything unparseable or merely
// non-routable (0.0.0.0/8, multicast, the unspecified address) counts as
// private, because the guard must reject what it cannot prove public.
// ---------------------------------------------------------------------------

export function isPrivateIPv4(ip: string): boolean {
  const parts = parseIPv4(ip);
  if (!parts) return true; // unparseable: fail closed
  const [a] = parts;
  if (a === 0) return true; // current network
  if (a >= 224) return true; // multicast + reserved
  return classifyIPv4(parts) !== 'public';
}

export function isPrivateIPv6(ip: string): boolean {
  const groups = parseIPv6(ip.toLowerCase());
  if (!groups) return true; // unparseable: fail closed
  if (groups.every((g) => g === 0)) return true; // :: unspecified
  if ((groups[0] & 0xff00) === 0xff00) return true; // multicast ff00::/8
  return classifyIPv6(groups) !== 'public';
}
