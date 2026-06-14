// Faithful-enough mock of the Cloudflare v4 API for e2e-testing the
// dashboard's automatic tunnel setup (CF_API_BASE points the dashboard here).
//
// Importable (startMockCf) for the e2e harness, or runnable standalone:
//   node scripts/e2e/lib/mock-cf-server.mjs   # listens on :9911
import http from 'http';

export const ZONE_ID = 'a'.repeat(32);
export const ZONE2_ID = 'b'.repeat(32);
export const ACCOUNT_ID = 'mock-account';
export const TUNNEL_ID = 'mock-tunnel-uuid';
export const VALID_TOKEN = 'mock-cf-api-token-valid-12345678';
/** A real cloudflared-format run token (base64 of {a,s,t}); the dashboard now
 * decodes it into credentials.json, so the mock must serve a decodable one.
 * The embedded TunnelID is a valid UUID (distinct from the API path's
 * TUNNEL_ID, which is just the account-scoped tunnel handle). */
export const RUN_TOKEN_TID = '2043373f-18dd-4616-b30e-7f9d0e9d8bc6';
const RUN_TOKEN = Buffer.from(
  JSON.stringify({ a: 'mock-acct', s: Buffer.alloc(32, 5).toString('base64'), t: RUN_TOKEN_TID }),
  'utf-8',
).toString('base64');

const ok = (result) => JSON.stringify({ success: true, errors: [], result });
const err = (code, message) => JSON.stringify({ success: false, errors: [{ code, message }], result: null });

/**
 * Starts the mock on the given port (0 = ephemeral). Returns
 * { url, port, state, close() }. `state` is live: specs can inspect
 * dnsRecords / tunnelExists after driving the UI.
 */
export function startMockCf(port = 0, { quiet = false } = {}) {
  const state = {
    tunnelExists: false,
    dnsRecords: [
      // pre-existing record to exercise the conflict flow at taken.example.com
      { id: 'rec-taken', type: 'A', name: 'taken.example.com', content: '203.0.113.7' },
    ],
  };

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const send = (status, payload) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(payload);
        if (!quiet) console.log(`[mock-cf] ${req.method} ${req.url} -> ${status}`);
      };
      const auth = req.headers.authorization || '';
      if (auth !== `Bearer ${VALID_TOKEN}`) {
        return send(403, err(10000, 'Authentication error'));
      }
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname;

      if (req.method === 'GET' && p === '/zones') {
        return send(
          200,
          ok([
            { id: ZONE_ID, name: 'example.com', status: 'active', account: { id: ACCOUNT_ID } },
            { id: ZONE2_ID, name: 'pending-domain.net', status: 'pending', account: { id: ACCOUNT_ID } },
          ]),
        );
      }
      if (req.method === 'GET' && p === `/zones/${ZONE_ID}`) {
        return send(200, ok({ id: ZONE_ID, name: 'example.com', status: 'active', account: { id: ACCOUNT_ID } }));
      }
      if (req.method === 'GET' && p === `/accounts/${ACCOUNT_ID}/cfd_tunnel`) {
        return send(
          200,
          ok(
            state.tunnelExists
              ? [{ id: TUNNEL_ID, name: 'pubky-homeserver', remote_config: true, config_src: 'cloudflare' }]
              : [],
          ),
        );
      }
      if (req.method === 'POST' && p === `/accounts/${ACCOUNT_ID}/cfd_tunnel`) {
        state.tunnelExists = true;
        // Live responses carry the run token inline on create; serving it here
        // makes e2e exercise production's primary path (the GET .../token
        // endpoint below stays for the adopt path).
        return send(
          200,
          ok({
            id: TUNNEL_ID,
            name: 'pubky-homeserver',
            remote_config: true,
            config_src: 'cloudflare',
            token: RUN_TOKEN,
          }),
        );
      }
      if (req.method === 'GET' && p === `/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/token`) {
        return send(200, ok(RUN_TOKEN));
      }
      if (req.method === 'PUT' && p === `/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations`) {
        return send(200, ok({}));
      }
      if (req.method === 'GET' && p === `/zones/${ZONE_ID}/dns_records`) {
        // The dashboard uses the documented exact-match filter (name.exact);
        // accept the legacy bare form too.
        const name = url.searchParams.get('name.exact') ?? url.searchParams.get('name');
        return send(200, ok(state.dnsRecords.filter((r) => r.name === name)));
      }
      if (req.method === 'POST' && p === `/zones/${ZONE_ID}/dns_records`) {
        const rec = JSON.parse(body);
        state.dnsRecords.push({ id: `rec-${state.dnsRecords.length}`, ...rec });
        return send(200, ok(rec));
      }
      if (req.method === 'DELETE' && p.startsWith(`/zones/${ZONE_ID}/dns_records/`)) {
        const id = p.split('/').pop();
        const i = state.dnsRecords.findIndex((r) => r.id === id);
        if (i >= 0) state.dnsRecords.splice(i, 1);
        // mirror the real API: bare result, no success/errors fields
        return send(200, JSON.stringify({ result: { id } }));
      }
      if (req.method === 'PUT' && p.startsWith(`/zones/${ZONE_ID}/dns_records/`)) {
        return send(200, ok({ id: p.split('/').pop() }));
      }
      send(404, err(7000, `No route for ${req.method} ${p}`));
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const actualPort = server.address().port;
      resolve({
        url: `http://127.0.0.1:${actualPort}`,
        port: actualPort,
        state,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

// Standalone mode for manual poking.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { port } = await startMockCf(9911);
  console.log(`mock CF API on :${port} (valid token: ${VALID_TOKEN})`);
}
