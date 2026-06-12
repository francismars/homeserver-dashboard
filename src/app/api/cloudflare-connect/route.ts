import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { RouteError, errorResponse } from '@/lib/server/errors';
import { isAllowedPublicHostname } from '@/lib/server/hostname';
import {
  CERT_PATH,
  getConfigDir,
  CONNECT_LOG,
  CONNECT_MAX_AGE_MS,
  CONNECT_STATE,
  CREDENTIALS_PATH,
  LOCAL_CONFIG_PATH,
  claimState,
  clearState,
  getCloudflaredBin,
  isBinaryAvailable,
  isPidAlive,
  killPid,
  parseLoginUrl,
  readState,
  runCloudflared,
  spawnDetached,
  writeState,
} from '@/lib/server/cloudflared-process';
import { getRequestId, logRouteError, logRouteInfo } from '@/lib/server/logger';

const ROUTE_NAME = '/api/cloudflare-connect';
const TUNNEL_NAME = 'pubky-homeserver';
const FALLBACK_TUNNEL_NAME = 'pubky-homeserver-local';
/** Where the cloudflared runtime container sees the shared config dir. */
const getRuntimeDir = () => process.env.CLOUDFLARED_RUNTIME_DIR || '/etc/cloudflared-config';
const INGRESS_SERVICE = 'http://homeserver:6286';

type Step = { key: 'tunnel' | 'dns' | 'config'; status: 'done' | 'failed'; detail?: string };

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * "Connect Cloudflare account": browser-auth via `cloudflared tunnel login`.
 * Zero copy-paste - the user clicks the auth URL, logs in on cloudflare.com,
 * picks their domain, clicks Authorize; Cloudflare delivers cert.pem to the
 * waiting process. The cert then authorizes `tunnel create` and
 * `tunnel route dns` with no API token. The resulting tunnel is locally
 * managed (credentials.json + config.yml in the shared config dir); the
 * runtime cloudflared container runs it via --config. cert.pem is deleted
 * the moment setup completes.
 *
 * GET  -> { status: idle|waiting|authorized|completed, auth_url?, hostname?, supported }
 * POST {action:'start'}                    -> spawn login, return auth_url
 * POST {action:'complete', hostname}      -> create + route dns + write config
 * POST {action:'cancel'}                   -> abort a pending login
 */

async function currentStatus(): Promise<{
  status: 'idle' | 'waiting' | 'authorized' | 'completed';
  auth_url?: string;
  hostname?: string;
}> {
  if ((await fileExists(LOCAL_CONFIG_PATH())) && (await fileExists(CREDENTIALS_PATH()))) {
    let hostname: string | undefined;
    try {
      const domain = (await fs.readFile(path.join(getConfigDir(), 'domain'), 'utf-8')).trim();
      hostname = domain || undefined;
    } catch {
      // domain file absent
    }
    return { status: 'completed', hostname };
  }
  if (await fileExists(CERT_PATH())) {
    // An unused authorization is a zone-admin credential; expire it instead
    // of letting it sit on the bind mount indefinitely.
    const certStat = await fs.stat(CERT_PATH());
    if (Date.now() - certStat.mtimeMs > CONNECT_MAX_AGE_MS) {
      await fs.rm(CERT_PATH(), { force: true });
      return { status: 'idle' };
    }
    return { status: 'authorized' };
  }
  const state = await readState(CONNECT_STATE());
  if (state) {
    const alive = isPidAlive(state.pid);
    const fresh = Date.now() - Date.parse(state.started_at) < CONNECT_MAX_AGE_MS;
    if (alive && fresh) {
      const url = await parseLoginUrl();
      if (url) return { status: 'waiting', auth_url: url };
      return { status: 'waiting' };
    }
    // dead or stale: clean up so the user can start fresh
    if (alive) killPid(state.pid);
    await clearState(CONNECT_STATE());
  }
  return { status: 'idle' };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const status = await currentStatus();
  return NextResponse.json(
    { ...status, supported: await isBinaryAvailable(), requestId },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();

  let body: { action?: unknown; hostname?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse(new RouteError(400, 'bad_request', 'Invalid JSON payload'), requestId);
  }

  if (!(await isBinaryAvailable())) {
    return errorResponse(
      new RouteError(503, 'config_error', 'cloudflared is not available in this environment'),
      requestId,
    );
  }

  // ---- cancel -----------------------------------------------------------
  if (body.action === 'cancel') {
    const state = await readState(CONNECT_STATE());
    if (state) killPid(state.pid);
    await clearState(CONNECT_STATE());
    await fs.rm(CERT_PATH(), { force: true });
    return NextResponse.json({ status: 'idle', requestId }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // ---- start ------------------------------------------------------------
  if (body.action === 'start') {
    const existing = await currentStatus();
    if (existing.status === 'waiting' && existing.auth_url) {
      return NextResponse.json({ ...existing, requestId }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (existing.status === 'authorized' || existing.status === 'completed') {
      return NextResponse.json({ ...existing, requestId }, { headers: { 'Cache-Control': 'no-store' } });
    }
    // Spawn mutex: O_EXCL claim. A concurrent start loses and reports the
    // winner's state on its next poll.
    if (!(await claimState(CONNECT_STATE()))) {
      const winner = await currentStatus();
      return NextResponse.json({ ...winner, requestId }, { headers: { 'Cache-Control': 'no-store' } });
    }
    try {
      const pid = await spawnDetached([getCloudflaredBin(), 'tunnel', 'login'], CONNECT_LOG(), {
        TUNNEL_ORIGIN_CERT: CERT_PATH(),
      });
      await writeState(CONNECT_STATE(), { pid, started_at: new Date().toISOString() });
      // The URL prints to stderr immediately (live-verified); give it a moment.
      let url: string | null = null;
      for (let i = 0; i < 20 && !url; i++) {
        await new Promise((r) => setTimeout(r, 500));
        url = await parseLoginUrl();
      }
      if (!url) {
        killPid(pid);
        await clearState(CONNECT_STATE());
        throw new Error('cloudflared did not produce a login URL');
      }
      logRouteInfo({
        requestId,
        route: ROUTE_NAME,
        method: 'POST',
        statusCode: 200,
        durationMs: Date.now() - startedAt,
        message: 'Connect login started',
        meta: { pid },
      });
      return NextResponse.json(
        { status: 'waiting', auth_url: url, requestId },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (e) {
      await clearState(CONNECT_STATE());
      const error = new RouteError(500, 'internal_error', 'Failed to start the Cloudflare login');
      logRouteError({
        requestId,
        route: ROUTE_NAME,
        method: 'POST',
        statusCode: error.status,
        durationMs: Date.now() - startedAt,
        errorType: error.type,
        message: e instanceof Error ? e.message : String(e),
      });
      return errorResponse(error, requestId);
    }
  }

  // ---- complete ---------------------------------------------------------
  if (body.action !== 'complete') {
    return errorResponse(
      new RouteError(400, 'bad_request', 'action must be "start", "complete" or "cancel"'),
      requestId,
    );
  }
  const hostname = typeof body.hostname === 'string' ? body.hostname.trim().toLowerCase() : '';
  const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  const labelsValid = hostname.split('.').every((l) => LABEL.test(l));
  if (!hostname || !isAllowedPublicHostname(hostname) || !labelsValid) {
    return errorResponse(new RouteError(400, 'bad_request', 'Missing or invalid hostname'), requestId);
  }
  if (!(await fileExists(CERT_PATH()))) {
    return errorResponse(
      new RouteError(409, 'bad_request', 'Not authorized yet. Open the Cloudflare link and click Authorize first.'),
      requestId,
    );
  }

  // Completion lock: two tabs finishing simultaneously would create two
  // tunnels and leave config.yml referencing one while credentials.json
  // holds the other's secret. O_EXCL lockfile; released in finally.
  const completeLock = path.join(getConfigDir(), '.connect-complete.lock');
  if (!(await claimState(completeLock))) {
    return errorResponse(new RouteError(409, 'bad_request', 'Setup is already in progress'), requestId);
  }
  try {
    return await runComplete();
  } finally {
    await clearState(completeLock);
  }

  // Everything below runs under the completion lock.
  async function runComplete(): Promise<NextResponse> {
    const steps: Step[] = [];
    const fail = (error: RouteError, logMessage: string) => {
      logRouteError({
        requestId,
        route: ROUTE_NAME,
        method: 'POST',
        statusCode: error.status,
        durationMs: Date.now() - startedAt,
        errorType: error.type,
        message: logMessage,
      });
      return NextResponse.json(
        { error: error.publicMessage, type: error.type, steps, requestId },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    };
    const certEnv = { TUNNEL_ORIGIN_CERT: CERT_PATH() };

    // 1. tunnel create (idempotent-ish: fall back to a -local name if taken)
    let tunnelName = TUNNEL_NAME;
    let create = await runCloudflared(
      ['tunnel', 'create', '--credentials-file', CREDENTIALS_PATH(), tunnelName],
      certEnv,
    );
    if (!create.ok && /already exists/i.test(create.output)) {
      tunnelName = FALLBACK_TUNNEL_NAME;
      create = await runCloudflared(
        ['tunnel', 'create', '--credentials-file', CREDENTIALS_PATH(), tunnelName],
        certEnv,
      );
    }
    if (!create.ok) {
      steps.push({ key: 'tunnel', status: 'failed' });
      return fail(
        new RouteError(502, 'upstream_error', `Could not create the tunnel: ${lastLine(create.output)}`),
        create.output.slice(-500),
      );
    }
    steps.push({ key: 'tunnel', status: 'done', detail: tunnelName });

    // The credentials file carries the tunnel id; that is our config reference.
    let tunnelId: string;
    try {
      const creds = JSON.parse(await fs.readFile(CREDENTIALS_PATH(), 'utf-8')) as { TunnelID?: string };
      if (!creds.TunnelID) throw new Error('TunnelID missing from credentials file');
      tunnelId = creds.TunnelID;
    } catch (e) {
      steps.push({ key: 'config', status: 'failed' });
      return fail(
        new RouteError(500, 'internal_error', 'Tunnel created but its credentials file is unreadable'),
        e instanceof Error ? e.message : String(e),
      );
    }

    // 2. route dns
    const route = await runCloudflared(['tunnel', 'route', 'dns', tunnelName, hostname], certEnv);
    if (!route.ok) {
      steps.push({ key: 'dns', status: 'failed' });
      // Undo the tunnel we just created so a retry starts clean instead of
      // exhausting names and orphaning tunnel objects in the account.
      await runCloudflared(['tunnel', 'delete', '-f', tunnelName], certEnv);
      await fs.rm(CREDENTIALS_PATH(), { force: true });
      const friendly = /already exists/i.test(route.output)
        ? `A DNS record already exists at ${hostname}. Pick a different subdomain (or use the API-token setup, which can replace records).`
        : /find.*zone|zone for|no zone/i.test(route.output)
          ? `${hostname} is not in the domain you authorized. Use a hostname under the domain you picked on Cloudflare.`
          : `Could not create the DNS record: ${lastLine(route.output)}`;
      return fail(new RouteError(502, 'upstream_error', friendly), route.output.slice(-500));
    }
    steps.push({ key: 'dns', status: 'done' });

    // 3. write runtime config + switch modes + delete the cert
    try {
      const configYml = [
        `tunnel: ${tunnelId}`,
        `credentials-file: ${getRuntimeDir()}/credentials.json`,
        'no-autoupdate: true',
        'ingress:',
        `  - hostname: ${hostname}`,
        `    service: ${INGRESS_SERVICE}`,
        '  - service: http_status:404',
        '',
      ].join('\n');
      await fs.writeFile(LOCAL_CONFIG_PATH(), configYml, 'utf-8');
      // World-readable until the next app start hardens them to 640+group
      // 65532 (entrypoint) - required so the crash-looping cloudflared-local
      // container can pick them up without a restart, exactly like the token
      // file in token mode. The bind mount lives inside the app-data dir.
      await fs.chmod(LOCAL_CONFIG_PATH(), 0o644);
      await fs.chmod(CREDENTIALS_PATH(), 0o644).catch(() => {});
      await fs.writeFile(path.join(getConfigDir(), 'domain'), hostname, 'utf-8');
      // Mode switch: an empty token keeps the token-mode container down so the
      // local-config container (which needs config.yml) takes over.
      await fs.writeFile(path.join(getConfigDir(), 'token'), '', 'utf-8');
      // The cert's job is done; it must not linger (it can create tunnels and
      // edit DNS for the authorized zone).
      await fs.rm(CERT_PATH(), { force: true });
      await clearState(CONNECT_STATE());
      steps.push({ key: 'config', status: 'done' });
    } catch (e) {
      steps.push({ key: 'config', status: 'failed' });
      return fail(
        new RouteError(500, 'internal_error', 'Could not write the tunnel configuration'),
        e instanceof Error ? e.message : String(e),
      );
    }

    logRouteInfo({
      requestId,
      route: ROUTE_NAME,
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      message: 'Connect setup completed',
      meta: { hostnameLength: hostname.length, tunnelName },
    });
    return NextResponse.json(
      {
        ok: true,
        hostname,
        steps,
        message: 'Tunnel configured. Restart the app from Umbrel to connect it and publish your domain.',
        requestId,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } // end runComplete
}

function lastLine(output: string): string {
  const lines = output.trim().split('\n').filter(Boolean);
  return lines[lines.length - 1] ?? 'unknown error';
}
