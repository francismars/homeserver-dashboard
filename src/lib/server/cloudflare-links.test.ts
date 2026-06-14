import { describe, expect, it } from 'vitest';
import { cfDnsRecordsUrl, cfTunnelsUrl } from './cloudflare-links';

describe('cfDnsRecordsUrl', () => {
  it('links directly when the account id and zone name are known', () => {
    expect(cfDnsRecordsUrl('a'.repeat(32), 'example.com')).toBe(
      `https://dash.cloudflare.com/${'a'.repeat(32)}/example.com/dns`,
    );
  });

  it('uses the :account redirect when only the zone name is known (legacy connect cert)', () => {
    expect(cfDnsRecordsUrl(null, 'example.com')).toBe('https://dash.cloudflare.com/?to=/:account/example.com/dns');
  });

  it('uses both placeholders when neither is known', () => {
    expect(cfDnsRecordsUrl(null, null)).toBe('https://dash.cloudflare.com/?to=/:account/:zone/dns');
    expect(cfDnsRecordsUrl(undefined, undefined)).toBe('https://dash.cloudflare.com/?to=/:account/:zone/dns');
  });

  it('falls back to the redirect when the account id is missing even though the zone is known', () => {
    expect(cfDnsRecordsUrl('', 'example.com')).toBe('https://dash.cloudflare.com/?to=/:account/example.com/dns');
  });
});

describe('cfTunnelsUrl', () => {
  it('links directly to the Zero Trust tunnels page when the account id is known', () => {
    expect(cfTunnelsUrl('b'.repeat(32))).toBe(`https://one.dash.cloudflare.com/${'b'.repeat(32)}/networks/tunnels`);
  });

  it('uses the :account redirect when the account id is unknown', () => {
    expect(cfTunnelsUrl(null)).toBe('https://one.dash.cloudflare.com/?to=/:account/networks/tunnels');
    expect(cfTunnelsUrl(undefined)).toBe('https://one.dash.cloudflare.com/?to=/:account/networks/tunnels');
  });
});
