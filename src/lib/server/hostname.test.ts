// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookup = vi.hoisted(() => vi.fn());
vi.mock('dns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dns')>();
  return { ...actual, promises: { ...actual.promises, lookup } };
});

import { isAllowedPublicHostname, resolvesToPublicAddress } from './hostname';

describe('isAllowedPublicHostname', () => {
  it('accepts ordinary public hostnames', () => {
    expect(isAllowedPublicHostname('example.com')).toBe(true);
    expect(isAllowedPublicHostname('pubky.sub.example.com')).toBe(true);
  });

  it('rejects empty and over-length names', () => {
    expect(isAllowedPublicHostname('')).toBe(false);
    expect(isAllowedPublicHostname(`${'a'.repeat(250)}.com`)).toBe(false);
  });

  it('rejects localhost and *.localhost', () => {
    expect(isAllowedPublicHostname('localhost')).toBe(false);
    expect(isAllowedPublicHostname('foo.localhost')).toBe(false);
  });

  it('rejects IPv4 literals', () => {
    expect(isAllowedPublicHostname('192.168.0.1')).toBe(false);
    expect(isAllowedPublicHostname('8.8.8.8')).toBe(false);
  });

  it('rejects anything containing a colon (ports, IPv6 literals)', () => {
    expect(isAllowedPublicHostname('example.com:8080')).toBe(false);
    expect(isAllowedPublicHostname('[::1]')).toBe(false);
  });

  it('rejects single-label names', () => {
    expect(isAllowedPublicHostname('intranet')).toBe(false);
  });
});

describe('resolvesToPublicAddress', () => {
  beforeEach(() => {
    lookup.mockReset();
  });

  it('resolves with all:true and verbatim:true', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await resolvesToPublicAddress('example.com');
    expect(lookup).toHaveBeenCalledWith('example.com', { all: true, verbatim: true });
  });

  it('accepts a hostname whose every address is public', async () => {
    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1::1', family: 6 },
    ]);
    await expect(resolvesToPublicAddress('example.com')).resolves.toBe(true);
  });

  it('rejects when any single address is a private IPv4', async () => {
    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);
    await expect(resolvesToPublicAddress('rebind.example.com')).resolves.toBe(false);
  });

  it('rejects loopback and link-local IPv4', async () => {
    lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    await expect(resolvesToPublicAddress('lo.example.com')).resolves.toBe(false);
    lookup.mockResolvedValue([{ address: '169.254.1.1', family: 4 }]);
    await expect(resolvesToPublicAddress('ll.example.com')).resolves.toBe(false);
  });

  it('rejects private IPv6 (ULA, loopback)', async () => {
    lookup.mockResolvedValue([{ address: 'fd00::1', family: 6 }]);
    await expect(resolvesToPublicAddress('ula.example.com')).resolves.toBe(false);
    lookup.mockResolvedValue([{ address: '::1', family: 6 }]);
    await expect(resolvesToPublicAddress('lo6.example.com')).resolves.toBe(false);
  });

  it('fails closed when DNS returns no records', async () => {
    lookup.mockResolvedValue([]);
    await expect(resolvesToPublicAddress('empty.example.com')).resolves.toBe(false);
  });

  it('fails closed on resolver errors', async () => {
    lookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(resolvesToPublicAddress('missing.example.com')).resolves.toBe(false);
  });
});
