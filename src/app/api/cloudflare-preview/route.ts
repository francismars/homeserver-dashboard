import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { RouteError, errorResponse } from '@/lib/server/errors';
import {
  AlreadyRunningError,
  CREDENTIALS_PATH,
  LOCAL_CONFIG_PATH,
  PREVIEW_ENV,
  SETUP_FLOW_LOCK,
  SETUP_FLOW_LOCK_MAX_AGE_MS,
  TESTDRIVE_LOG,
  TESTDRIVE_STATE,
  clearState,
  getCloudflaredBin,
  getConfigDir,
  getTestdriveOrigin,
  isBinaryAvailable,
  isPidAlive,
  killPid,
  parsePreviewPublishedUrl,
  parseQuickTunnelUrl,
  quickTunnelConnected,
  quickTunnelFailed,
  readState,
  spawnDetached,
  withFlowLock,
  writeState,
} from '@/lib/server/cloudflared-process';
import { getRequestId, logRouteError, logRouteInfo } from '@/lib/server/logger';

const ROUTE_NAME = '/api/cloudflare-preview';

/**
 * Preview mode: a temporary public address (random *.trycloudflare.com,
 * no Cloudflare account, no domain) that is PUBLISHED to the Pubky network.
 *
 * Two cooperating tunnels:
 * - "instant": a child process spawned on enable, so the user has a working
 *   URL within seconds. NOT published (the homeserver already started with
 *   its old domain); dies with the container.
 * - "published": after the app restarts, the cloudflared-preview compose
 *   service (gated on the testdrive.env marker via env_file) starts before
 *   the config wrapper, which publishes its fresh URL as icann_domain.
 *   Every restart yields and publishes a new URL.
 *
 * Enable is refused while a permanent setup exists (real domain or
 * locally-managed tunnel) - preview must never shadow a real address.
 *
 * GET  -> { enabled, instant: {status,url?,error?}, published_url?, supported }
 * POST {action:'enable'}  -> marker + instant tunnel
 * POST {action:'disable'} -> kill instant tunnel + remove marker
 */

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function hasPermanentSetup(): Promise<boolean> {
  // Locally-managed tunnel (Connect flow)
  if ((await fileExists(LOCAL_CONFIG_PATH())) && (await fileExists(CREDENTIALS_PATH()))) return true;
  // Token-mode tunnel with a real domain (manual or API-token flow)
  try {
    const domain = (await fs.readFile(path.join(getConfigDir(), 'domain'), 'utf-8')).trim().toLowerCase();
    const token = (await fs.readFile(path.join(getConfigDir(), 'token'), 'utf-8')).trim();
    if (domain && !domain.startsWith('localhost') && !domain.endsWith('.trycloudflare.com') && token) return true;
  } catch {
    // files absent -> no permanent setup
  }
  return false;
}

async function instantStatus(): Promise<{ status: 'stopped' | 'starting' | 'running'; url?: string; error?: string }> {
  const state = await readState(TESTDRIVE_STATE());
  if (!state) return { status: 'stopped' };
  if (!isPidAlive(state.pid, state.starttime)) {
    const failed = await quickTunnelFailed();
    await clearState(TESTDRIVE_STATE());
    return failed
      ? { status: 'stopped', error: 'Cloudflare did not hand out a temporary URL. Try again in a minute.' }
      : { status: 'stopped' };
  }
  const url = await parseQuickTunnelUrl();
  const ready = Boolean(url) && (await quickTunnelConnected());
  return { status: ready ? 'running' : 'starting', url: ready ? (url ?? undefined) : undefined };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const enabled = await fileExists(PREVIEW_ENV());
  const instant = await instantStatus();
  const publishedUrl = enabled ? await parsePreviewPublishedUrl() : null;
  return NextResponse.json(
    {
      enabled,
      instant,
      published_url: publishedUrl ?? undefined,
      supported: await isBinaryAvailable(),
      requestId,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse(new RouteError(400, 'bad_request', 'Invalid JSON payload'), requestId);
  }

  if (body.action === 'disable') {
    const state = await readState(TESTDRIVE_STATE());
    if (state) killPid(state.pid, state.starttime);
    await clearState(TESTDRIVE_STATE());
    await fs.rm(PREVIEW_ENV(), { force: true });
    logRouteInfo({
      requestId,
      route: ROUTE_NAME,
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      message: 'Preview disabled',
    });
    return NextResponse.json(
      { enabled: false, instant: { status: 'stopped' }, requestId },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (body.action !== 'enable') {
    return errorResponse(new RouteError(400, 'bad_request', 'action must be "enable" or "disable"'), requestId);
  }

  if (!(await isBinaryAvailable())) {
    return errorResponse(
      new RouteError(503, 'config_error', 'cloudflared is not available in this environment'),
      requestId,
    );
  }
  try {
    // The setup lock keeps the permanent-setup check and the marker write
    // atomic against connect complete / auto-setup: a setup completing in
    // between must not end up shadowed by preview.
    return await withFlowLock(SETUP_FLOW_LOCK, SETUP_FLOW_LOCK_MAX_AGE_MS, async () => {
      if (await hasPermanentSetup()) {
        return errorResponse(
          new RouteError(
            409,
            'bad_request',
            'A permanent Cloudflare setup already exists. Preview mode is for trying things out before setting up a real domain.',
          ),
          requestId,
        );
      }

      try {
        // The marker gates the cloudflared-preview compose service (env_file)
        // and tells the config wrapper to publish the URL on the next start.
        // The preview dir must be writable by the cloudflared-preview container
        // (UID 65532) BEFORE it starts - cloudflared silently skips an
        // uncreatable logfile instead of crashing (live finding), so a crash-loop
        // cannot self-heal this. World-writable is acceptable: single-user
        // device, the dir only ever holds the tunnel's own log (the URL in it is
        // public by nature). chmod explicitly (mkdir mode is umask-clipped).
        await fs.mkdir(path.join(getConfigDir(), 'preview'), { recursive: true });
        await fs.chmod(path.join(getConfigDir(), 'preview'), 0o777);
        await fs.writeFile(PREVIEW_ENV(), `TUNNEL_URL=${getTestdriveOrigin()}\n`, 'utf-8');

        // Instant tunnel so the user gets a working URL right away (uncapped;
        // it dies with the container and the compose service takes over after
        // the restart that actually publishes the address).
        const existing = await instantStatus();
        if (existing.status === 'stopped') {
          const child = await spawnDetached(
            [getCloudflaredBin(), 'tunnel', '--no-autoupdate', '--url', getTestdriveOrigin()],
            TESTDRIVE_LOG(),
          );
          await writeState(TESTDRIVE_STATE(), { ...child, started_at: new Date().toISOString() });
        }
        logRouteInfo({
          requestId,
          route: ROUTE_NAME,
          method: 'POST',
          statusCode: 200,
          durationMs: Date.now() - startedAt,
          message: 'Preview enabled',
        });
        return NextResponse.json(
          { enabled: true, instant: await instantStatus(), requestId },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      } catch (e) {
        await clearState(TESTDRIVE_STATE());
        const error = new RouteError(500, 'internal_error', 'Failed to enable preview mode');
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
    });
  } catch (e) {
    if (e instanceof AlreadyRunningError) {
      return errorResponse(new RouteError(409, 'bad_request', 'Setup is already in progress'), requestId);
    }
    throw e;
  }
}
