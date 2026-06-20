import { describe, expect, it } from 'vitest';
import { publicAddressLink } from './public-address';

describe('publicAddressLink', () => {
  it('drops :443 and links over https (the reported bug)', () => {
    expect(publicAddressLink('reggae-stands-effort-deer.trycloudflare.com:443')).toEqual({
      href: 'https://reggae-stands-effort-deer.trycloudflare.com',
      label: 'reggae-stands-effort-deer.trycloudflare.com',
    });
    expect(publicAddressLink('pubky.example.com:443')).toEqual({
      href: 'https://pubky.example.com',
      label: 'pubky.example.com',
    });
  });

  it('treats a bare host (no port) as https', () => {
    expect(publicAddressLink('pubky.example.com')).toEqual({
      href: 'https://pubky.example.com',
      label: 'pubky.example.com',
    });
  });

  it('keeps a non-default port and serves it over http (local/dev address)', () => {
    expect(publicAddressLink('umbrel.local:6286')).toEqual({
      href: 'http://umbrel.local:6286',
      label: 'umbrel.local:6286',
    });
  });

  it('drops :80 and links over http', () => {
    expect(publicAddressLink('example.com:80')).toEqual({ href: 'http://example.com', label: 'example.com' });
  });

  it('tolerates a value that already carries a scheme or trailing slash', () => {
    expect(publicAddressLink('https://pubky.example.com:443/')).toEqual({
      href: 'https://pubky.example.com',
      label: 'pubky.example.com',
    });
  });

  it('does not mis-split an IPv6 literal into a port', () => {
    expect(publicAddressLink('2001:db8::1')).toEqual({ href: 'https://2001:db8::1', label: '2001:db8::1' });
  });
});
