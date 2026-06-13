// Mock pkarr relay for the e2e suite: implements the read side of the relay
// protocol (GET /<z32-pubkey> -> sig+timestamp+dns payload, 404 when
// unknown). The harness points the dashboard at it via PKARR_RELAYS so no
// spec ever talks to the real relays (or waits out their ~7s DHT lookup for
// nonexistent keys).
import http from 'http';
import { Keypair, SignedPacket } from '@synonymdev/pkarr';

/** Builds a real signed homeserver-shaped packet with a fresh keypair.
 * Returns { pubkey, payload } where payload is the relay wire format
 * (packet.bytes() minus its 40-byte pubkey+last_seen prefix). */
export function buildHomeserverRecord({ ip = '203.0.113.7', port = 6287, domain = 'pubky.example.com' } = {}) {
  const keypair = new Keypair();
  const builder = SignedPacket.builder();
  if (ip && port) builder.addHttpsRecord('.', 1, '.', 3600, { port, ipv4hint: ip });
  if (domain) builder.addHttpsRecord('.', 10, domain, 3600, {});
  if (ip) builder.addARecord('.', ip, 3600);
  const packet = builder.buildAndSign(keypair);
  return { pubkey: packet.publicKeyString, payload: Buffer.from(packet.bytes().slice(40)) };
}

/**
 * Starts the mock relay. Returns { url, setRecord(pubkey, payload),
 * clearRecords(), requests (array of pubkeys asked for), close() }.
 */
export function startMockPkarrRelay() {
  const records = new Map();
  const requests = [];
  const server = http.createServer((req, res) => {
    const pubkey = req.url.slice(1);
    requests.push(pubkey);
    const payload = records.get(pubkey);
    if (req.method === 'GET' && payload) {
      res.writeHead(200, { 'Content-Type': 'application/pkarr.org/relays#payload' });
      return res.end(payload);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        setRecord: (pubkey, payload) => records.set(pubkey, payload),
        clearRecords: () => records.clear(),
        requests,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
