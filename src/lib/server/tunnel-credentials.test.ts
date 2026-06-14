import { describe, expect, it } from 'vitest';
import { buildTunnelConfigYml, isDecodableTunnelToken, tokenToCredentials } from './tunnel-credentials';

/** Builds a real cloudflared-format token: base64-std of {a,s,t,e?}. */
function makeToken(fields: { a?: string; s?: string; t?: string; e?: string }): string {
  return Buffer.from(JSON.stringify(fields), 'utf-8').toString('base64');
}

const ACCT = '235292e0f503ba66fd8764fbf3c17adb';
const SECRET = Buffer.alloc(32, 7).toString('base64'); // std-base64 of 32 bytes
const TID = '2043373f-18dd-4616-b30e-7f9d0e9d8bc6';

describe('tokenToCredentials', () => {
  it('decodes a standard token to the capitalized credentials.json fields, verbatim secret', () => {
    const creds = tokenToCredentials(makeToken({ a: ACCT, s: SECRET, t: TID }));
    expect(creds).toEqual({ AccountTag: ACCT, TunnelSecret: SECRET, TunnelID: TID });
    // The secret is copied byte-for-byte (no re-encoding).
    expect(creds.TunnelSecret).toBe(SECRET);
  });

  it('round-trips: encode credentials back to a token JSON and decode again', () => {
    const token = makeToken({ a: ACCT, s: SECRET, t: TID });
    const creds = tokenToCredentials(token);
    const reencoded = makeToken({ a: creds.AccountTag, s: creds.TunnelSecret, t: creds.TunnelID });
    expect(reencoded).toBe(token);
  });

  it('carries the optional Endpoint (e) for FedRAMP/regional tokens', () => {
    const creds = tokenToCredentials(makeToken({ a: ACCT, s: SECRET, t: TID, e: 'fed.example' }));
    expect(creds.Endpoint).toBe('fed.example');
  });

  it('omits Endpoint when absent or empty', () => {
    expect(tokenToCredentials(makeToken({ a: ACCT, s: SECRET, t: TID })).Endpoint).toBeUndefined();
    expect(tokenToCredentials(makeToken({ a: ACCT, s: SECRET, t: TID, e: '' })).Endpoint).toBeUndefined();
  });

  it('tolerates surrounding whitespace from a paste', () => {
    const token = makeToken({ a: ACCT, s: SECRET, t: TID });
    expect(tokenToCredentials(`  ${token}\n`).TunnelID).toBe(TID);
  });

  it.each([
    ['not base64!!!', 'non-base64 junk'],
    ['', 'empty string'],
    [Buffer.from('not json', 'utf-8').toString('base64'), 'base64 of non-JSON'],
    [Buffer.from('[]', 'utf-8').toString('base64'), 'base64 of a non-object'],
    [makeToken({ a: ACCT, s: SECRET }), 'missing tunnel id'],
    [makeToken({ a: ACCT, t: TID }), 'missing secret'],
    [makeToken({ s: SECRET, t: TID }), 'missing account'],
    [makeToken({ a: ACCT, s: SECRET, t: 'not-a-uuid' }), 'malformed tunnel id'],
    [makeToken({ a: '', s: SECRET, t: TID }), 'empty account'],
  ])('throws on a malformed token: %s', (bad) => {
    expect(() => tokenToCredentials(bad as string)).toThrow();
    expect(isDecodableTunnelToken(bad as string)).toBe(false);
  });

  it('isDecodableTunnelToken accepts a real token', () => {
    expect(isDecodableTunnelToken(makeToken({ a: ACCT, s: SECRET, t: TID }))).toBe(true);
  });
});

describe('buildTunnelConfigYml', () => {
  it('emits the Connect-flow config.yml format (tunnel id, credentials-file, ingress, 404 fallback)', () => {
    const yml = buildTunnelConfigYml('pubky.example.com', TID, '/etc/cloudflared-config', 'http://homeserver:6286');
    expect(yml).toBe(
      [
        `tunnel: ${TID}`,
        'credentials-file: /etc/cloudflared-config/credentials.json',
        'no-autoupdate: true',
        'ingress:',
        '  - hostname: pubky.example.com',
        '    service: http://homeserver:6286',
        '  - service: http_status:404',
        '',
      ].join('\n'),
    );
  });
});
