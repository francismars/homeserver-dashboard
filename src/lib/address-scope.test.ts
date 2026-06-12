// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { classifyAddress, isPrivateIPv4, isPrivateIPv6 } from './address-scope';

describe('classifyAddress', () => {
  it.each([
    ['127.0.0.1', 'IPv4 loopback'],
    ['127.0.0.1:6286', 'IPv4 loopback with port'],
    ['127.255.255.255', 'end of 127.0.0.0/8'],
    ['localhost', 'literal localhost'],
    ['localhost:6286', 'literal localhost with port'],
    ['LOCALHOST', 'case-insensitive localhost'],
    ['::1', 'IPv6 loopback'],
    ['[::1]', 'bracketed IPv6 loopback'],
    ['[::1]:8080', 'bracketed IPv6 loopback with port'],
    ['0:0:0:0:0:0:0:1', 'uncompressed IPv6 loopback'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
  ])('loopback: %s (%s)', (address) => {
    expect(classifyAddress(address)).toBe('loopback');
  });

  it.each([
    ['10.0.0.1', '10.0.0.0/8'],
    ['10.21.0.23:6287', '10/8 docker-internal with port'],
    ['172.16.0.1', 'start of 172.16.0.0/12'],
    ['172.31.255.255', 'end of 172.16.0.0/12'],
    ['192.168.1.10:80', '192.168.0.0/16 with port'],
    ['169.254.169.254', 'IPv4 link-local'],
    ['100.64.0.1', 'start of CGNAT 100.64.0.0/10'],
    ['100.127.255.255', 'end of CGNAT 100.64.0.0/10'],
    ['fe80::1', 'IPv6 link-local'],
    ['febf::1', 'end of fe80::/10'],
    ['fc00::1', 'unique-local fc00::/7'],
    ['fd12:3456::1', 'unique-local fd prefix'],
    ['[fd00::1]:443', 'bracketed unique-local with port'],
    ['::ffff:10.0.0.1', 'IPv4-mapped private'],
  ])('private: %s (%s)', (address) => {
    expect(classifyAddress(address)).toBe('private');
  });

  it.each([
    ['1.2.3.4', 'plain public IPv4'],
    ['8.8.8.8:53', 'public IPv4 with port'],
    ['9.255.255.255', 'just below 10/8'],
    ['11.0.0.0', 'just above 10/8'],
    ['172.15.255.255', 'just below 172.16/12'],
    ['172.32.0.1', 'just above 172.16/12'],
    ['192.167.0.1', 'just below 192.168/16'],
    ['100.63.255.255', 'just below CGNAT'],
    ['100.128.0.0', 'just above CGNAT'],
    ['2606:4700::1111', 'public IPv6'],
    ['[2606:4700::1111]:443', 'bracketed public IPv6 with port'],
    ['fec0::1', 'just above fe80::/10'],
    ['::ffff:8.8.8.8', 'IPv4-mapped public'],
  ])('public: %s (%s)', (address) => {
    expect(classifyAddress(address)).toBe('public');
  });

  it.each([
    ['example.com', 'bare domain'],
    ['pubky.example.com:443', 'domain with port'],
    ['sub.do-main.co.uk', 'hyphenated multi-label'],
    ['umbrel.local', 'mDNS-style name'],
    ['singlelabel', 'single label'],
  ])('hostname: %s (%s)', (address) => {
    expect(classifyAddress(address)).toBe('hostname');
  });

  it.each([
    ['', 'empty'],
    ['   ', 'whitespace'],
    ['pubky://x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o', 'pubky URI'],
    ['http://example.com', 'http URL'],
    ['not a host', 'embedded spaces'],
    ['example.com:notaport', 'non-numeric port'],
    ['example.com:', 'empty port'],
    ['1.2.3.4:99999', 'port out of range'],
    ['999.1.1.1', 'octet out of range'],
    ['1.2.3.4.5', 'five octets'],
    ['1.2.3', 'three octets'],
    [':::', 'triple colon'],
    ['fe80:::1', 'double elision'],
    ['1:2:3:4:5:6:7:8:9', 'nine IPv6 groups'],
    ['gggg::1', 'non-hex IPv6 group'],
    ['[::1', 'unclosed bracket'],
    ['-bad.example.com', 'label starting with hyphen'],
  ])('invalid: %s (%s)', (address) => {
    expect(classifyAddress(address)).toBe('invalid');
  });
});

// The server-side SSRF guard predicates: fail closed, so non-routable and
// unparseable inputs all count as private.
describe('isPrivateIPv4', () => {
  it.each([
    '10.0.0.5',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.4.2',
    '192.168.1.1',
    '100.64.0.1',
    '0.0.0.0', // current network
    '224.0.0.1', // multicast
    '255.255.255.255', // broadcast
    'garbage', // unparseable: fail closed
    '1.2.3', // unparseable: fail closed
  ])('private: %s', (ip) => {
    expect(isPrivateIPv4(ip)).toBe(true);
  });

  it.each(['1.2.3.4', '8.8.8.8', '93.184.216.34', '223.255.255.255'])('public: %s', (ip) => {
    expect(isPrivateIPv4(ip)).toBe(false);
  });
});

describe('isPrivateIPv6', () => {
  it.each([
    '::', // unspecified
    '::1', // loopback
    'fe80::1', // link-local
    'fd00::1', // unique-local
    'ff02::1', // multicast
    '::ffff:10.0.0.1', // IPv4-mapped private
    'fe80::1%eth0', // zone index: unparseable, fail closed
    'garbage',
  ])('private: %s', (ip) => {
    expect(isPrivateIPv6(ip)).toBe(true);
  });

  it.each(['2606:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8'])('public: %s', (ip) => {
    expect(isPrivateIPv6(ip)).toBe(false);
  });
});
