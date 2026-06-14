// Shared e2e harness: boots the dashboard dev server against a fully fake
// environment (temp Cloudflare config dir, temp homeserver config/log, a fake
// cloudflared binary, a mock Cloudflare API, a mock homeserver admin API) and
// drives it with the system Chrome via playwright-core.
//
// Every spec gets its own temp dirs and its own dev-server instance, so specs
// never share state and can run in any order.
import { spawn } from 'child_process';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import { promises as fs, openSync, closeSync } from 'fs';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';
import { startMockCf, VALID_TOKEN } from './mock-cf-server.mjs';
import { startMockPkarrRelay } from './mock-pkarr-relay.mjs';

export { VALID_TOKEN };

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CHROME = process.env.E2E_CHROME || '/usr/bin/google-chrome';
const DEV_BOOT_TIMEOUT_MS = 120_000;

export const FIXTURE_CERT = path.join(REPO_ROOT, 'src', 'lib', 'server', '__fixtures__', 'origincert-example.pem');
/** Modern login layout (cloudflared >= 2025.2.1): one ARGO TUNNEL TOKEN block
 * whose embedded zoneID/apiToken match the mock CF server's ZONE_ID and
 * VALID_TOKEN, so the dashboard resolves the zone name (example.com) over
 * CF_API_BASE. */
export const FIXTURE_CERT_TOKEN = path.join(REPO_ROOT, 'src', 'lib', 'server', '__fixtures__', 'cert-token-only.pem');

// ---------------------------------------------------------------------------
// tiny assertion + reporting helpers (throw on failure; specs exit non-zero)
// ---------------------------------------------------------------------------
let checkCount = 0;
export function check(cond, label, detail = '') {
  checkCount++;
  const suffix = detail ? ` (${detail})` : '';
  if (!cond) throw new Error(`CHECK FAILED: ${label}${suffix}`);
  console.log(`  ok ${label}${suffix}`);
}
export function checksRun() {
  return checkCount;
}
export function step(label) {
  console.log(`- ${label}`);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// ---------------------------------------------------------------------------
// fake cloudflared: enough behavior for login / create / route dns / delete /
// quick tunnel. Named "cloudflared" so the dashboard's /proc comm identity
// checks accept it.
// ---------------------------------------------------------------------------
const FAKE_CLOUDFLARED = `#!/bin/bash
# Fake cloudflared for the dashboard e2e suite. Not a real tunnel.
if [ "$1" = "--version" ]; then
  echo "cloudflared version 2026.6.0 (e2e fake)"
  exit 0
fi
if [ "$1" = "tunnel" ]; then
  shift
  # global flags before the subcommand (quick tunnel has no subcommand)
  case "$1" in
    login)
      echo "Please open the following URL and log in with your Cloudflare account:" >&2
      echo "https://dash.cloudflare.com/argotunnel?aud=e2e-fake&callback=fake" >&2
      # Behave like the real login: exit once the cert has been delivered
      # (the spec drops it into $HOME/.cloudflared) or relocated by the app.
      for _ in $(seq 1 4500); do
        if [ -f "$HOME/.cloudflared/cert.pem" ] || { [ -n "$TUNNEL_ORIGIN_CERT" ] && [ -f "$TUNNEL_ORIGIN_CERT" ]; }; then
          echo "You have successfully logged in." >&2
          exit 0
        fi
        sleep 0.2
      done
      exit 1
      ;;
    create)
      shift
      creds=""
      while [ $# -gt 0 ]; do
        case "$1" in
          --credentials-file) creds="$2"; shift 2 ;;
          *) shift ;;
        esac
      done
      if [ -z "$creds" ]; then echo "missing --credentials-file" >&2; exit 1; fi
      printf '{"AccountTag":"e2e-account","TunnelSecret":"c2VjcmV0LXNlY3JldA==","TunnelID":"e2e-local-tunnel-id"}' > "$creds"
      echo "Created tunnel pubky-homeserver with id e2e-local-tunnel-id"
      exit 0
      ;;
    route)
      echo "Added CNAME record"
      exit 0
      ;;
    delete)
      exit 0
      ;;
    --no-autoupdate|--url)
      # quick tunnel: print the assigned URL and registration like the real
      # binary (the dashboard parses both from the log), then stay alive.
      echo "INF +--------------------------------------------------------+"
      echo "INF |  https://e2e-fake-preview.trycloudflare.com            |"
      echo "INF +--------------------------------------------------------+"
      echo "INF Registered tunnel connection connIndex=0"
      while true; do sleep 1; done
      ;;
  esac
fi
echo "fake cloudflared: unhandled args: $*" >&2
exit 1
`;

const MOCK_INFO_DEFAULTS = {
  num_users: 3,
  num_disabled_users: 0,
  total_disk_used_mb: 12,
  num_signup_codes: 5,
  num_unused_signup_codes: 2,
  public_key: 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o',
  pkarr_pubky_address: 'pubky://x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o',
  version: '0.9.1',
};

/** Minimal homeserver admin API: /info plus the endpoints the dashboard
 * probes on load. `info` is live-mutable via the returned handle. */
function startMockAdmin(info) {
  const server = http.createServer((req, res) => {
    const send = (status, payload) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    const p = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && p === '/info') return send(200, info);
    if (req.method === 'GET' && p === '/users/disabled') return send(200, { items: [], next_cursor: null });
    send(404, { error: `mock admin: no route for ${req.method} ${p}` });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        info,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

/** Minimal text-serving upstream (mock client / metrics servers) so the API
 * explorer proxies have something to round-trip against. `routes` maps
 * "METHOD /path" to { type, body }. */
function startMockTextServer(routes) {
  const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://localhost').pathname;
    const hit = routes[`${req.method} ${p}`];
    if (!hit) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': hit.type });
    res.end(hit.body);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

const HOMESERVER_CONFIG_TEMPLATE = (icannDomain, withPort) =>
  [
    '[general]',
    'signup_mode = "token_required"',
    '',
    '[drive]',
    `icann_domain = "${icannDomain}"`,
    ...(withPort ? ['public_icann_http_port = 443'] : []),
    'icann_listen_socket = "127.0.0.1:6286"',
    'pubky_listen_socket = "127.0.0.1:6287"',
    '',
    '[admin]',
    'admin_password = "e2e-password"',
    'listen_socket = "127.0.0.1:6288"',
    '',
    '[storage]',
    'storage_quota_mb = 0',
    '',
  ].join('\n');

/**
 * Boots the whole fake environment plus a dev server. Returns an env object:
 *   baseUrl, root, configDir, hsConfigPath, cf (mock CF handle),
 *   admin (mock admin handle), file(...) helpers, stop().
 */
export async function startDashboard({
  infoDomain = 'localhost:6286',
  hsDomain = 'localhost',
  hsPort = false,
  // Default to the Umbrel experience so every existing spec keeps exercising
  // the Cloudflare flows; the standalone spec overrides this to 'standalone'.
  platform = 'umbrel',
} = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hsdash-e2e-'));
  const configDir = path.join(root, 'cloudflare-config');
  const hsDir = path.join(root, 'homeserver-data');
  const binDir = path.join(root, 'bin');
  await fs.mkdir(configDir, { recursive: true });
  await fs.mkdir(hsDir, { recursive: true });
  await fs.mkdir(binDir, { recursive: true });

  const cloudflaredBin = path.join(binDir, 'cloudflared');
  await fs.writeFile(cloudflaredBin, FAKE_CLOUDFLARED, { mode: 0o755 });

  const hsConfigPath = path.join(hsDir, 'config.toml');
  await fs.writeFile(hsConfigPath, HOMESERVER_CONFIG_TEMPLATE(hsDomain, hsPort), 'utf-8');
  const hsLogPath = path.join(hsDir, 'homeserver.log');
  await fs.writeFile(hsLogPath, 'homeserver e2e log\n', 'utf-8');

  const cf = await startMockCf(0, { quiet: true });
  const admin = await startMockAdmin({ ...MOCK_INFO_DEFAULTS, pkarr_icann_domain: infoDomain });
  // Always-on so the Overview's auto pkarr check hits a fast deterministic
  // 404 instead of the real relays (which take ~7s to 404 unknown keys).
  const pkarrRelay = await startMockPkarrRelay();
  const client = await startMockTextServer({
    'GET /': { type: 'text/plain', body: 'pubky homeserver e2e client' },
  });
  const metrics = await startMockTextServer({
    'GET /metrics': { type: 'text/plain; version=0.0.4', body: '# TYPE e2e_up gauge\ne2e_up 1\n' },
  });

  const port = await freePort();
  const nextLog = path.join(root, 'next-dev.log');
  const out = openSync(nextLog, 'a');
  const child = spawn(path.join(REPO_ROOT, 'node_modules', '.bin', 'next'), ['dev', '--webpack', '-p', String(port)], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      PORT: String(port),
      CLOUDFLARE_CONFIG_DIR: configDir,
      CLOUDFLARED_BIN: cloudflaredBin,
      HOMESERVER_CONFIG_PATH: hsConfigPath,
      HOMESERVER_LOG_PATH: hsLogPath,
      ADMIN_BASE_URL: admin.url,
      ADMIN_TOKEN: 'e2e-admin-token',
      CLIENT_BASE_URL: client.url,
      METRICS_BASE_URL: metrics.url,
      CF_API_BASE: cf.url,
      PKARR_RELAYS: pkarrRelay.url,
      PLATFORM: platform,
    },
  });
  closeSync(out);
  child.unref();
  // localhost, not 127.0.0.1: Next 16 blocks dev resources (webpack-hmr and
  // friends) for origins it does not consider its own.
  const baseUrl = `http://localhost:${port}`;

  // Wait for the dev server to answer.
  const deadline = Date.now() + DEV_BOOT_TIMEOUT_MS;
  let up = false;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        up = true;
        break;
      }
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  if (!up) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // already gone
    }
    const log = await fs.readFile(nextLog, 'utf-8').catch(() => '');
    throw new Error(`dev server did not come up on ${baseUrl} within ${DEV_BOOT_TIMEOUT_MS}ms\n${log.slice(-2000)}`);
  }

  const env = {
    baseUrl,
    root,
    configDir,
    hsDir,
    hsConfigPath,
    cf,
    admin,
    pkarrRelay,
    cloudflaredBin,
    nextLog,
    /** Read a file under the Cloudflare config dir ('' on absence). */
    readConfigFile: (name) => fs.readFile(path.join(configDir, name), 'utf-8').catch(() => null),
    /** Simulates the init wrapper finishing an app boot: writes the boot
     * stamp next to config.toml. Pass a Date to backdate it (e.g. "the
     * wrapper last ran before this change"). */
    writeBootStamp: async (when = new Date()) => {
      const stamp = path.join(hsDir, '.wrapper-boot-stamp');
      await fs.writeFile(stamp, String(Math.floor(when.getTime() / 1000)), 'utf-8');
      await fs.utimes(stamp, when, when);
    },
    fileExists: async (name) => {
      try {
        await fs.access(path.join(configDir, name));
        return true;
      } catch {
        return false;
      }
    },
    api: async (route, init) => {
      const res = await fetch(`${baseUrl}${route}`, init);
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    },
    stop: async () => {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // already gone
      }
      await sleep(500);
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // already gone
      }
      // Reap any fake-cloudflared children spawned detached by the routes.
      await new Promise((r) => {
        const pk = spawn('pkill', ['-f', root]);
        pk.on('close', r);
        pk.on('error', r);
      });
      await cf.close();
      await admin.close();
      await pkarrRelay.close();
      await client.close();
      await metrics.close();
      await fs.rm(root, { recursive: true, force: true });
    },
  };
  return env;
}

// ---------------------------------------------------------------------------
// browser
// ---------------------------------------------------------------------------
export async function launchBrowser() {
  return chromium.launch({ headless: true, executablePath: CHROME });
}

/** Loads /dashboard and waits until the page is interactive. networkidle is
 * deliberately avoided: server-side reachability probes can keep the network
 * busy for many seconds. Hydration is detected by retrying the Settings
 * click until the dialog actually opens (a click on an unhydrated button is
 * silently lost). */
export async function gotoDashboard(page, baseUrl) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
}

export async function openSettingsDialog(page) {
  await page.waitForSelector('[aria-label="Settings"]', { timeout: 60_000 });
  for (let i = 0; i < 20; i++) {
    await page.click('[aria-label="Settings"]', { timeout: 10_000 }).catch(() => {});
    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 3_000 });
      return;
    } catch {
      // not hydrated yet; retry
    }
  }
  throw new Error('Settings dialog did not open');
}

/** Loads /dashboard, opens the Settings dialog, switches to the Cloudflare
 * tab. Returns once the tab content is rendered. */
export async function openCloudflareTab(page, baseUrl) {
  await gotoDashboard(page, baseUrl);
  await openSettingsDialog(page);
  const cfTab = page.locator('button:has-text("Cloudflare")').first();
  await cfTab.waitFor({ timeout: 15_000 });
  await cfTab.click();
  await sleep(300);
}

/** Standard spec wrapper: boots env + browser, runs fn, tears down, reports. */
export async function runSpec(name, fn, options = {}) {
  console.log(`SPEC ${name}`);
  const env = await startDashboard(options);
  const browser = await launchBrowser();
  try {
    await fn({ env, browser });
    console.log(`SPEC PASS ${name} (${checksRun()} checks)`);
  } catch (e) {
    console.error(`SPEC FAIL ${name}`);
    console.error(e);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
    await env.stop().catch(() => {});
  }
}
