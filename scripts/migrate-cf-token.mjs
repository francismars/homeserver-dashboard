#!/usr/bin/env node
/**
 * One-time migration for installs set up BEFORE the token-mode container was
 * removed. Those installs have a `token` + `domain` but no `config.yml`, so
 * the single `cloudflared tunnel --config config.yml run` service would have
 * nothing to run and the tunnel would go down on upgrade. This converts the
 * token into the locally-managed form (credentials.json + config.yml) that
 * every setup path now writes.
 *
 * Self-contained (no app imports): it runs from the dashboard entrypoint as
 * root, before the perm phase, so the new files get the same ownership/modes
 * as the rest. Idempotent and conservative: a no-op when config.yml already
 * exists, the token is empty, the domain is not a real public hostname, or
 * the token cannot be decoded.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEPRECATION — safe to delete this script (and its entrypoint invocation,
 * Dockerfile COPY, and tests) AFTER 2026-12-01. By then every active install
 * will have booted at least once on a release carrying this shim, so the
 * legacy token-only state no longer exists in the wild. Removing it earlier
 * risks a not-yet-upgraded install losing its tunnel on the next update.
 * (First shipped 2026-06; introduced with the token+local container collapse.)
 * ─────────────────────────────────────────────────────────────────────────
 */
import { promises as fs } from 'fs';
import path from 'path';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** base64-std(JSON{a,s,t,e?}) -> credentials.json fields. Throws on malformed. */
export function tokenToCredentials(token) {
  const trimmed = String(token).trim();
  const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
  if (Buffer.from(decoded, 'utf-8').toString('base64') !== trimmed) throw new Error('not canonical base64');
  const o = JSON.parse(decoded);
  if (typeof o !== 'object' || o === null) throw new Error('not an object');
  const { a, s, t, e } = o;
  if (typeof a !== 'string' || !a || typeof s !== 'string' || !s || typeof t !== 'string' || !t) {
    throw new Error('missing a/s/t');
  }
  if (!UUID_RE.test(t)) throw new Error('bad tunnel id');
  const creds = { AccountTag: a, TunnelSecret: s, TunnelID: t };
  if (typeof e === 'string' && e) creds.Endpoint = e;
  return creds;
}

export function buildConfigYml(hostname, tunnelId, runtimeDir, ingressService) {
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

async function writeAtomic(file, contents) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, contents, { mode: 0o644 });
  await fs.rename(tmp, file);
}

export async function migrate(dir, opts = {}) {
  const runtimeDir = opts.runtimeDir ?? '/etc/cloudflared-config';
  const ingressService = opts.ingressService ?? 'http://homeserver:6286';
  const read = (f) =>
    fs
      .readFile(path.join(dir, f), 'utf-8')
      .then((s) => s.trim())
      .catch(() => '');
  const exists = (f) =>
    fs
      .access(path.join(dir, f))
      .then(() => true)
      .catch(() => false);

  if (await exists('config.yml')) return { migrated: false, reason: 'config.yml already present' };
  const token = await read('token');
  if (!token) return { migrated: false, reason: 'no token' };
  const domain = await read('domain');
  const lower = domain.toLowerCase();
  if (!domain || lower.startsWith('localhost') || lower.endsWith('.trycloudflare.com')) {
    return { migrated: false, reason: 'no real domain' };
  }
  let creds;
  try {
    creds = tokenToCredentials(token);
  } catch (e) {
    return { migrated: false, reason: `undecodable token: ${e.message}` };
  }
  await writeAtomic(path.join(dir, 'credentials.json'), JSON.stringify(creds));
  await writeAtomic(path.join(dir, 'config.yml'), buildConfigYml(domain, creds.TunnelID, runtimeDir, ingressService));
  return { migrated: true, tunnelId: creds.TunnelID };
}

// CLI: invoked by the dashboard entrypoint. Never fail the boot on error.
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.env.CLOUDFLARE_CONFIG_DIR || '/app/cloudflare-config';
  migrate(dir)
    .then((r) => {
      if (r.migrated) console.log(`cf-migrate: converted token-mode tunnel ${r.tunnelId} to locally-managed config`);
    })
    .catch((e) => {
      console.error(`cf-migrate: skipped (${e.message})`);
    });
}
