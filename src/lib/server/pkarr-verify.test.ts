import { describe, expect, it } from 'vitest';
import { Keypair, SignedPacket } from '@synonymdev/pkarr';
import {
  computePkarrVerdict,
  packetFromRelayPayload,
  splitHostPort,
  summarizeRecords,
  verifyRelayPayload,
  z32DecodePubkey,
  type PkarrPacketFacts,
} from './pkarr-verify';

/** Builds a REAL signed packet (the package's own builder + keypair) shaped
 * like what the pubky homeserver publishes, then extracts the facts the
 * verdict function consumes. */
function packetFacts(opts: { ip?: string; port?: number; domain?: string; valid?: boolean }): PkarrPacketFacts {
  const kp = new Keypair();
  const b = SignedPacket.builder();
  if (opts.ip && opts.port) b.addHttpsRecord('.', 1, '.', 3600, { port: opts.port, ipv4hint: opts.ip });
  if (opts.domain) b.addHttpsRecord('.', 10, opts.domain, 3600, {});
  if (opts.ip) b.addARecord('.', opts.ip, 3600);
  const pkt = b.buildAndSign(kp);
  return {
    pubkey: pkt.publicKeyString,
    valid: opts.valid ?? pkt.isValid(),
    timestampUs: pkt.timestampMs, // package bug: microseconds despite the name
    records: pkt.records,
  };
}

const HS = { ip: '203.0.113.7', port: 6287, domain: 'pubky.example.com' };

describe('computePkarrVerdict', () => {
  it('verified when address and domain both match', () => {
    const r = computePkarrVerdict(packetFacts(HS), {
      address: '203.0.113.7:6287',
      domain: 'pubky.example.com',
    });
    expect(r.verdict).toBe('verified');
    expect(r.gates).toEqual({ address: 'match', domain: 'match' });
    expect(r.published.address).toBe('203.0.113.7:6287');
    expect(r.published.domain).toBe('pubky.example.com');
    expect(r.timestamp_ms).toBeGreaterThan(Date.now() - 60_000);
    expect(r.timestamp_ms).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('mismatch when the published IP differs', () => {
    const r = computePkarrVerdict(packetFacts(HS), { address: '198.51.100.9:6287', domain: 'pubky.example.com' });
    expect(r.verdict).toBe('mismatch');
    expect(r.gates.address).toBe('mismatch');
    expect(r.gates.domain).toBe('match');
  });

  it('mismatch when the published port differs', () => {
    const r = computePkarrVerdict(packetFacts(HS), { address: '203.0.113.7:443', domain: 'pubky.example.com' });
    expect(r.verdict).toBe('mismatch');
    expect(r.gates.address).toBe('mismatch');
  });

  it('mismatch when the published domain differs', () => {
    const r = computePkarrVerdict(packetFacts(HS), { address: '203.0.113.7:6287', domain: 'other.example.org' });
    expect(r.verdict).toBe('mismatch');
    expect(r.gates.domain).toBe('mismatch');
  });

  it('mismatch when a domain is expected but none is published', () => {
    const r = computePkarrVerdict(packetFacts({ ip: HS.ip, port: HS.port }), {
      address: '203.0.113.7:6287',
      domain: 'pubky.example.com',
    });
    expect(r.verdict).toBe('mismatch');
    expect(r.gates.domain).toBe('mismatch');
    expect(r.published.domain).toBe(null);
  });

  it('verified with both gates not_compared when no expectations exist', () => {
    const r = computePkarrVerdict(packetFacts(HS), { address: null, domain: null });
    expect(r.verdict).toBe('verified');
    expect(r.gates).toEqual({ address: 'not_compared', domain: 'not_compared' });
  });

  it('domain comparison ignores the expected port and trailing dots and case', () => {
    const r = computePkarrVerdict(packetFacts(HS), { address: null, domain: 'PUBKY.example.com:443' });
    expect(r.gates.domain).toBe('match');
    expect(r.verdict).toBe('verified');
  });

  it('matches via the A record when there is no HTTPS port/ipv4hint record', () => {
    // A-record-only packet: host comparable, port not -> hosts decide.
    const facts = packetFacts({ ip: HS.ip });
    const r = computePkarrVerdict(facts, { address: '203.0.113.7:6287', domain: null });
    expect(r.gates.address).toBe('match');
    expect(r.published.address).toBe('203.0.113.7');
  });

  it('mismatch when an address is expected but the packet has no address records', () => {
    const r = computePkarrVerdict(packetFacts({ domain: HS.domain }), { address: '203.0.113.7:6287', domain: null });
    expect(r.gates.address).toBe('mismatch');
    expect(r.verdict).toBe('mismatch');
  });

  it('unbracketed IPv6 expected address (the /info format) parses on the last colon', () => {
    // /info formats IPv6 as "::1:6287" (no brackets). The packet has no
    // ipv6 records here, so this must classify as mismatch, not crash or
    // mis-split the host.
    const r = computePkarrVerdict(packetFacts(HS), { address: '2001:db8::7:6287', domain: null });
    expect(r.gates.address).toBe('mismatch');
    expect(r.expected.address).toBe('2001:db8::7:6287');
  });

  it('invalid signature wins over everything', () => {
    const r = computePkarrVerdict(packetFacts({ ...HS, valid: false }), {
      address: '203.0.113.7:6287',
      domain: 'pubky.example.com',
    });
    expect(r.verdict).toBe('invalid');
  });

  it('age is informational only: an ancient timestamp stays verified', () => {
    const facts = packetFacts(HS);
    facts.timestampUs = (Date.now() - 30 * 24 * 3600 * 1000) * 1000; // 30 days, in us
    const r = computePkarrVerdict(facts, { address: '203.0.113.7:6287', domain: 'pubky.example.com' });
    expect(r.verdict).toBe('verified');
    expect(r.packet_age_ms).toBeGreaterThan(29 * 24 * 3600 * 1000);
  });
});

describe('splitHostPort', () => {
  it('splits IPv4:port', () => {
    expect(splitHostPort('203.0.113.7:6287')).toEqual({ host: '203.0.113.7', port: 6287 });
  });
  it('treats a bare IPv6 as host-only (no port misread)', () => {
    expect(splitHostPort('2001:db8::7')).toEqual({ host: '2001:db8::7', port: null });
  });
  it('treats an ambiguous unbracketed IPv6 ("::1:6287" is a valid address itself) as host-only', () => {
    expect(splitHostPort('::1:6287')).toEqual({ host: '::1:6287', port: null });
  });
  it('canonicalizes IPv6 hosts for comparison', () => {
    expect(splitHostPort('0:0:0:0:0:0:0:1:6287')).toEqual({ host: '::1', port: 6287 });
  });
  it('handles bracketed IPv6 with port', () => {
    expect(splitHostPort('[2001:db8::7]:6287')).toEqual({ host: '2001:db8::7', port: 6287 });
  });
  it('splits domain:port and lowercases', () => {
    expect(splitHostPort('PUBKY.Example.com:443')).toEqual({ host: 'pubky.example.com', port: 443 });
  });
});

describe('IPv6 ambiguity (unbracketed /info format)', () => {
  it('an expected "::1:6287" matches a packet publishing ipv6hint ::1 with port 6287', () => {
    const kp = new Keypair();
    const b = SignedPacket.builder();
    b.addHttpsRecord('.', 1, '.', 3600, { port: 6287, ipv6hint: '::1' });
    const pkt = b.buildAndSign(kp);
    const facts: PkarrPacketFacts = {
      pubkey: pkt.publicKeyString,
      valid: pkt.isValid(),
      timestampUs: pkt.timestampMs,
      records: pkt.records,
    };
    const r = computePkarrVerdict(facts, { address: '::1:6287', domain: null });
    expect(r.gates.address).toBe('match');
  });
});

describe('z32DecodePubkey / packetFromRelayPayload', () => {
  it('z32 decode matches the keypair bytes', () => {
    const kp = new Keypair();
    expect(Buffer.from(z32DecodePubkey(kp.public_key_string()))).toEqual(Buffer.from(kp.public_key_bytes()));
  });

  it('rebuilds a valid packet from a relay payload (bytes() minus the 40-byte prefix)', () => {
    const kp = new Keypair();
    const b = SignedPacket.builder();
    b.addHttpsRecord('.', 1, '.', 3600, { port: 6287, ipv4hint: '203.0.113.7' });
    b.addARecord('.', '203.0.113.7', 3600);
    const pkt = b.buildAndSign(kp);
    const relayPayload = pkt.bytes().slice(40);
    const rebuilt = packetFromRelayPayload(pkt.publicKeyString, relayPayload);
    // NOTE: rebuilt.publicKeyString hits a WASM panic upstream (fromBytes
    // packets only) - resolvePkarr never reads it; pubkey is passed through.
    expect(rebuilt.isValid()).toBe(true);
    expect(rebuilt.recordCount).toBe(2);
    expect(rebuilt.records.length).toBe(2);
  });

  it('OUR ed25519 check accepts the right pubkey and rejects a wrong one (isValid cannot be trusted)', () => {
    const kp = new Keypair();
    const other = new Keypair();
    const b = SignedPacket.builder();
    b.addARecord('.', '203.0.113.7', 3600);
    const pkt = b.buildAndSign(kp);
    const relayPayload = pkt.bytes().slice(40);
    expect(verifyRelayPayload(z32DecodePubkey(kp.public_key_string()), relayPayload)).toBe(true);
    expect(verifyRelayPayload(z32DecodePubkey(other.public_key_string()), relayPayload)).toBe(false);
    // Tampered content under the right key must fail too.
    const tampered = relayPayload.slice();
    tampered[tampered.length - 1] ^= 0xff;
    expect(verifyRelayPayload(z32DecodePubkey(kp.public_key_string()), tampered)).toBe(false);
    // Documents WHY we verify ourselves: the package validates a packet
    // rebuilt under the WRONG pubkey (from_bytes trusts its input).
    expect(packetFromRelayPayload(other.public_key_string(), relayPayload).isValid()).toBe(true);
  });
});

describe('summarizeRecords', () => {
  it('humanizes names (pubkey -> @) and renders HTTPS params and A addresses', () => {
    const facts = packetFacts(HS);
    const rows = summarizeRecords(facts.records, facts.pubkey);
    expect(rows).toHaveLength(3);
    const https1 = rows.find((r) => r.type === 'HTTPS' && r.value.includes('port=6287'));
    expect(https1).toBeDefined();
    expect(https1!.name).toBe('@');
    expect(https1!.ttl).toBe(3600);
    expect(https1!.value).toContain('ipv4hint=203.0.113.7');
    const httpsDomain = rows.find((r) => r.type === 'HTTPS' && r.value.includes('pubky.example.com'));
    expect(httpsDomain).toBeDefined();
    const a = rows.find((r) => r.type === 'A');
    expect(a!.value).toBe('203.0.113.7');
  });
});
