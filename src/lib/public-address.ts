/**
 * Turns a published homeserver address into a browser-openable URL plus a clean
 * display label. The homeserver reports its ICANN domain with the port it
 * publishes (e.g. `sub.trycloudflare.com:443`, `pubky.example.com:443`,
 * `umbrel.local:6286`). Pasting a bare `host:443` into a browser fails - the
 * browser tries it over http on port 443 - so we drop the default TLS/HTTP
 * ports and infer the scheme, giving a link that actually opens.
 */
export function publicAddressLink(address: string | null | undefined): { href: string; label: string } {
  const schemeless = (address ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const colon = schemeless.lastIndexOf(':');
  // Only treat a trailing :NNN as a port when there is exactly one colon, so an
  // IPv6 literal (multiple colons) is left as the host rather than mis-split.
  const hasPort = colon !== -1 && schemeless.indexOf(':') === colon && /^\d+$/.test(schemeless.slice(colon + 1));
  const host = hasPort ? schemeless.slice(0, colon) : schemeless;
  const port = hasPort ? schemeless.slice(colon + 1) : '';
  if (port === '80') return { href: `http://${host}`, label: host };
  // No port or the default https port -> a public https endpoint.
  if (port === '' || port === '443') return { href: `https://${host}`, label: host };
  // Any other explicit port is a local/dev address served over plain http.
  return { href: `http://${host}:${port}`, label: `${host}:${port}` };
}
