/**
 * Converts a cloudflared *tunnel token* into the locally-managed
 * `credentials.json` + `config.yml` form, so every persistent Cloudflare
 * setup (API-token auto-setup, manual paste, Connect) runs through a single
 * `cloudflared tunnel --config config.yml run` service instead of needing a
 * separate token-mode container.
 *
 * A tunnel token is `base64.StdEncoding(JSON)` of `{a,s,t,e?}` where
 * a=AccountTag, s=TunnelSecret (std-base64), t=TunnelID (uuid), e=Endpoint
 * (optional, FedRAMP/regional). credentials.json is the same material under
 * cloudflared's capitalized, untagged field names. Verified against the
 * cloudflared 2026.5.2 source (TunnelToken.Credentials() is a verbatim field
 * copy) and confirmed at runtime: a decoded token drives the byte-identical
 * edge connection as `--token`.
 */
export interface TunnelCredentials {
  AccountTag: string;
  /** std-base64, copied verbatim from the token (both forms store []byte the same way). */
  TunnelSecret: string;
  TunnelID: string;
  /** Only present for FedRAMP/regional tokens; omitted otherwise. */
  Endpoint?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Decodes a tunnel token into credentials.json fields. Throws (with a
 * user-facing-safe message, no secret material) when the token is not a
 * base64-encoded JSON carrying the a/s/t fields - so a mistyped/partial
 * paste is rejected up front instead of silently crash-looping the tunnel.
 */
export function tokenToCredentials(token: string): TunnelCredentials {
  const trimmed = token.trim();
  let decoded: string;
  try {
    decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    // Buffer.from is lenient (ignores junk); re-encode and compare to reject
    // input that is not actually valid base64 of this exact payload.
    if (Buffer.from(decoded, 'utf-8').toString('base64') !== trimmed) {
      throw new Error('not canonical base64');
    }
  } catch {
    throw new Error('Tunnel token is not valid base64.');
  }
  let json: unknown;
  try {
    json = JSON.parse(decoded);
  } catch {
    throw new Error('Tunnel token does not contain valid JSON.');
  }
  if (typeof json !== 'object' || json === null) {
    throw new Error('Tunnel token payload is not an object.');
  }
  const o = json as Record<string, unknown>;
  const { a, s, t, e } = o;
  if (typeof a !== 'string' || !a || typeof s !== 'string' || !s || typeof t !== 'string' || !t) {
    throw new Error('Tunnel token is missing the account, secret, or tunnel-id field.');
  }
  if (!UUID_RE.test(t)) {
    throw new Error('Tunnel token has a malformed tunnel id.');
  }
  const creds: TunnelCredentials = { AccountTag: a, TunnelSecret: s, TunnelID: t };
  if (typeof e === 'string' && e) creds.Endpoint = e;
  return creds;
}

/** True when the string decodes as a tunnel token (cheap pre-validation). */
export function isDecodableTunnelToken(token: string): boolean {
  try {
    tokenToCredentials(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * The runtime `config.yml` for a locally-managed tunnel that serves
 * `hostname` from the homeserver origin. Byte-for-byte the format the Connect
 * flow already writes, so all setup paths converge on one representation.
 * `runtimeDir` is where the cloudflared container sees the config dir; the
 * credentials-file path is resolved against it.
 */
export function buildTunnelConfigYml(
  hostname: string,
  tunnelId: string,
  runtimeDir: string,
  ingressService: string,
): string {
  return [
    `tunnel: ${tunnelId}`,
    `credentials-file: ${runtimeDir}/credentials.json`,
    'no-autoupdate: true',
    'ingress:',
    `  - hostname: ${hostname}`,
    `    service: ${ingressService}`,
    '  - service: http_status:404',
    '',
  ].join('\n');
}
