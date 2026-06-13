import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Force the WASM client's resolveMostRecent() to come back empty so the raw
// relay-fetch CLASSIFICATION path (the reason this module exists beyond an
// HTTPS probe) is exercised deterministically. Keypair/SignedPacket stay real
// so the payloads are genuinely signed and round-trip through
// packetFromRelayPayload + our own ed25519 verification.
vi.mock('@synonymdev/pkarr', async (importActual) => {
  const actual = await importActual<typeof import('@synonymdev/pkarr')>();
  class FakeClient {
    constructor(_relays: string[], _timeoutMs: number) {}
    async resolveMostRecent(): Promise<undefined> {
      return undefined;
    }
  }
  return { ...actual, Client: FakeClient };
});

import { Keypair, SignedPacket } from '@synonymdev/pkarr';
import { computePkarrVerdict, getPkarrRelays, resolvePkarr } from './pkarr-verify';

const RELAY_A = 'https://relay-a.test';
const RELAY_B = 'https://relay-b.test';

/** A genuinely signed homeserver-shaped relay payload (bytes() minus the
 * 40-byte pubkey+last_seen prefix), exactly what a relay serves. */
function realPayload() {
  const kp = new Keypair();
  const b = SignedPacket.builder();
  b.addHttpsRecord('.', 1, '.', 3600, { port: 6287, ipv4hint: '203.0.113.7' });
  b.addARecord('.', '203.0.113.7', 3600);
  const pkt = b.buildAndSign(kp);
  return { pubkey: pkt.publicKeyString, payload: Buffer.from(pkt.bytes().slice(40)) };
}

/** Routes fetch by relay base. handler(relay) returns a Response or throws
 * (a thrown handler simulates a connection refusal / abort). */
function mockFetchByRelay(handler: (relay: string) => Response) {
  vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const relay = url.startsWith(RELAY_A) ? RELAY_A : url.startsWith(RELAY_B) ? RELAY_B : '';
    return handler(relay);
  });
}

const PUBKEY = 'o4dksfbqk85ogzdb5osziw6befigbuxmuxkuxq8434q89uj56uyy';

describe('resolvePkarr classification', () => {
  beforeEach(() => {
    process.env.PKARR_RELAYS = `${RELAY_A},${RELAY_B}`;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PKARR_RELAYS;
  });

  it('all relays 404: not_found', async () => {
    mockFetchByRelay(() => new Response('not found', { status: 404 }));
    expect((await resolvePkarr(PUBKEY)).status).toBe('not_found');
  });

  it('one relay 404, the other times out (rejects): still not_found', async () => {
    mockFetchByRelay((relay) => {
      if (relay === RELAY_A) return new Response('nope', { status: 404 });
      throw new DOMException('aborted', 'TimeoutError');
    });
    expect((await resolvePkarr(PUBKEY)).status).toBe('not_found');
  });

  it('all relays unreachable (reject): unavailable, never not_found', async () => {
    mockFetchByRelay(() => {
      throw new Error('ECONNREFUSED');
    });
    expect((await resolvePkarr(PUBKEY)).status).toBe('unavailable');
  });

  it('a non-404 error status with no 404 anywhere: unavailable', async () => {
    mockFetchByRelay(() => new Response('upstream error', { status: 502 }));
    expect((await resolvePkarr(PUBKEY)).status).toBe('unavailable');
  });

  it('a relay 200 with a real signed payload: found, valid, verifies end-to-end', async () => {
    const { pubkey, payload } = realPayload();
    mockFetchByRelay((relay) =>
      relay === RELAY_A ? new Response(payload, { status: 200 }) : new Response('x', { status: 404 }),
    );
    const out = await resolvePkarr(pubkey);
    expect(out.status).toBe('found');
    if (out.status !== 'found') throw new Error('unreachable');
    // The whole packetFacts -> verifyRelayPayload -> verdict path, integrated:
    expect(out.facts.valid).toBe(true);
    const verdict = computePkarrVerdict(out.facts, { address: '203.0.113.7:6287', domain: null });
    expect(verdict.verdict).toBe('verified');
  });

  it('a relay 200 whose payload is signed by a DIFFERENT key: found but invalid', async () => {
    // Serve the payload under the WRONG pubkey: our own ed25519 check must
    // reject it (the package isValid() would not). End-to-end invalid path.
    const { payload } = realPayload();
    mockFetchByRelay((relay) =>
      relay === RELAY_A ? new Response(payload, { status: 200 }) : new Response('x', { status: 404 }),
    );
    const out = await resolvePkarr(PUBKEY); // not the payload's signer
    expect(out.status).toBe('found');
    if (out.status !== 'found') throw new Error('unreachable');
    expect(out.facts.valid).toBe(false);
    expect(computePkarrVerdict(out.facts, { address: null, domain: null }).verdict).toBe('invalid');
  });

  it('a relay 200 with a garbage body is skipped; another relay 404 still classifies not_found', async () => {
    mockFetchByRelay((relay) =>
      relay === RELAY_A
        ? new Response(Buffer.from('this is not a pkarr packet'), { status: 200 })
        : new Response('x', { status: 404 }),
    );
    expect((await resolvePkarr(PUBKEY)).status).toBe('not_found');
  });

  it('an oversized 200 body is rejected as not-a-record; a 404 elsewhere wins not_found', async () => {
    const huge = Buffer.alloc(5000, 1);
    mockFetchByRelay((relay) =>
      relay === RELAY_A ? new Response(huge, { status: 200 }) : new Response('x', { status: 404 }),
    );
    expect((await resolvePkarr(PUBKEY)).status).toBe('not_found');
  });

  it('the classification fetch does not follow redirects', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('x', { status: 404 }));
    await resolvePkarr(PUBKEY);
    expect(spy).toHaveBeenCalled();
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe('error');
  });
});

describe('getPkarrRelays', () => {
  afterEach(() => delete process.env.PKARR_RELAYS);

  it('accepts only http(s) entries and trims trailing slashes', () => {
    process.env.PKARR_RELAYS = 'https://a.test/, http://b.test , file:///etc/passwd , not-a-url';
    expect(getPkarrRelays()).toEqual(['https://a.test', 'http://b.test']);
  });

  it('falls back to the defaults when the override has no valid entry', () => {
    process.env.PKARR_RELAYS = 'file:///x, garbage';
    const relays = getPkarrRelays();
    expect(relays.length).toBeGreaterThan(0);
    expect(relays.every((r) => r.startsWith('https://'))).toBe(true);
  });
});
