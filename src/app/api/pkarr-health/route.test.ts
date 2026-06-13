// @vitest-environment node
import { NextRequest } from 'next/server';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { Keypair, SignedPacket } from '@synonymdev/pkarr';

vi.mock('@/lib/server/pkarr-verify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/pkarr-verify')>();
  return { ...actual, resolvePkarr: vi.fn() };
});

import { resolvePkarr } from '@/lib/server/pkarr-verify';
import { GET } from './route';

const PUBKEY = 'o4dksfbqk85ogzdb5osziw6befigbuxmuxkuxq8434q89uj56uyy';

function request(params: Record<string, string>) {
  const url = new URL('http://localhost:8080/api/pkarr-health');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function liveFacts() {
  const kp = new Keypair();
  const b = SignedPacket.builder();
  b.addHttpsRecord('.', 1, '.', 3600, { port: 6287, ipv4hint: '203.0.113.7' });
  b.addHttpsRecord('.', 10, 'pubky.example.com', 3600, {});
  b.addARecord('.', '203.0.113.7', 3600);
  const pkt = b.buildAndSign(kp);
  return {
    pubkey: pkt.publicKeyString,
    valid: true,
    timestampUs: pkt.timestampMs,
    records: pkt.records,
  };
}

describe('pkarr-health route', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (resolvePkarr as Mock).mockReset();
  });

  it('400 on a missing or malformed pubkey', async () => {
    for (const bad of [{}, { pubkey: 'not-a-key' }, { pubkey: 'l'.repeat(52) }, { pubkey: PUBKEY.slice(1) }]) {
      const res = await GET(request(bad as Record<string, string>));
      expect(res.status).toBe(400);
    }
    expect(resolvePkarr as Mock).not.toHaveBeenCalled();
  });

  it('verified verdict with matching expectations', async () => {
    (resolvePkarr as Mock).mockResolvedValue({ status: 'found', facts: liveFacts() });
    const res = await GET(
      request({ pubkey: PUBKEY, expected_address: '203.0.113.7:6287', expected_domain: 'pubky.example.com:443' }),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(data.verdict).toBe('verified');
    expect(data.gates).toEqual({ address: 'match', domain: 'match' });
    expect(data.published.address).toBe('203.0.113.7:6287');
    expect(data.records.length).toBe(3);
    expect(typeof data.packet_age_ms).toBe('number');
  });

  it('mismatch verdict names the failing gate', async () => {
    (resolvePkarr as Mock).mockResolvedValue({ status: 'found', facts: liveFacts() });
    const res = await GET(request({ pubkey: PUBKEY, expected_domain: 'other.example.org' }));
    const data = await res.json();
    expect(data.verdict).toBe('mismatch');
    expect(data.gates.domain).toBe('mismatch');
    expect(data.gates.address).toBe('not_compared');
  });

  it('not_found and unavailable are 200s with a verdict and no records', async () => {
    for (const status of ['not_found', 'unavailable'] as const) {
      (resolvePkarr as Mock).mockResolvedValue({ status });
      const res = await GET(request({ pubkey: PUBKEY }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.verdict).toBe(status);
      expect(data.records).toEqual([]);
    }
  });

  it('oversized expectation params are rejected with 400', async () => {
    const res = await GET(request({ pubkey: PUBKEY, expected_domain: 'a'.repeat(300) }));
    expect(res.status).toBe(400);
  });

  it('a resolver crash surfaces as a 500 RouteError, not an unhandled throw', async () => {
    (resolvePkarr as Mock).mockRejectedValue(new Error('wasm exploded'));
    const res = await GET(request({ pubkey: PUBKEY }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.type).toBe('internal_error');
  });
});
