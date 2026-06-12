import { NextRequest, NextResponse } from 'next/server';
import { RouteError, errorResponse } from '@/lib/server/errors';
import {
  TESTDRIVE_LOG,
  TESTDRIVE_MAX_AGE_MS,
  getCloudflaredBin,
  getTestdriveOrigin,
  TESTDRIVE_STATE,
  claimState,
  clearState,
  isBinaryAvailable,
  isPidAlive,
  killPid,
  parseQuickTunnelUrl,
  quickTunnelConnected,
  quickTunnelFailed,
  readState,
  spawnDetached,
  writeState,
} from '@/lib/server/cloudflared-process';
import { getRequestId, logRouteError, logRouteInfo } from '@/lib/server/logger';

const ROUTE_NAME = '/api/cloudflare-test-drive';

/**
 * "Test drive": a temporary public URL via a Cloudflare Quick Tunnel
 * (trycloudflare.com). No account, no domain, no credentials. Strictly a
 * connectivity preview: the URL is random, changes on every start, capped at
 * 200 in-flight requests, and carries no SLA, so it is never written into
 * the homeserver's published record (icann_domain) or any config.
 *
 * GET   -> { status: 'stopped' | 'starting' | 'running', url?, started_at?, expires_at?, supported }
 * POST  {action:'start'} -> spawns the quick tunnel (idempotent if running)
 * POST  {action:'stop'}  -> kills it
 *
 * Tunnels are auto-stopped after 30 minutes (enforced lazily on reads).
 */

async function currentStatus(): Promise<{
  status: 'stopped' | 'starting' | 'running';
  url?: string;
  started_at?: string;
  expires_at?: string;
  error?: string;
}> {
  const state = await readState(TESTDRIVE_STATE());
  if (!state) return { status: 'stopped' };
  const ageMs = Date.now() - Date.parse(state.started_at);
  const alive = isPidAlive(state.pid);
  if (!alive) {
    const failed = await quickTunnelFailed();
    await clearState(TESTDRIVE_STATE());
    return failed
      ? { status: 'stopped', error: 'Cloudflare did not hand out a temporary URL. Try again in a minute.' }
      : { status: 'stopped' };
  }
  if (ageMs > TESTDRIVE_MAX_AGE_MS) {
    killPid(state.pid);
    await clearState(TESTDRIVE_STATE());
    return { status: 'stopped' };
  }
  const url = await parseQuickTunnelUrl();
  const connected = await quickTunnelConnected();
  // Show the URL only once the edge connection registered; before that a
  // click would hit a Cloudflare 530.
  const ready = Boolean(url) && connected;
  return {
    status: ready ? 'running' : 'starting',
    url: ready ? (url ?? undefined) : undefined,
    started_at: state.started_at,
    expires_at: new Date(Date.parse(state.started_at) + TESTDRIVE_MAX_AGE_MS).toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const status = await currentStatus();
  return NextResponse.json(
    { ...status, supported: isBinaryAvailable(), requestId },
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

  if (body.action === 'stop') {
    const state = await readState(TESTDRIVE_STATE());
    if (state) killPid(state.pid);
    await clearState(TESTDRIVE_STATE());
    logRouteInfo({
      requestId,
      route: ROUTE_NAME,
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      message: 'Test drive stopped',
    });
    return NextResponse.json({ status: 'stopped', requestId }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (body.action !== 'start') {
    return errorResponse(new RouteError(400, 'bad_request', 'action must be "start" or "stop"'), requestId);
  }

  if (!(await isBinaryAvailable())) {
    return errorResponse(
      new RouteError(503, 'config_error', 'cloudflared is not available in this environment'),
      requestId,
    );
  }

  // Idempotent: reuse a live tunnel instead of stacking processes.
  const existing = await currentStatus();
  if (existing.status !== 'stopped') {
    return NextResponse.json({ ...existing, requestId }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Spawn mutex: O_EXCL claim on the state file. A concurrent start loses
  // the claim and just reports the winner's status.
  if (!(await claimState(TESTDRIVE_STATE()))) {
    const winner = await currentStatus();
    return NextResponse.json({ ...winner, requestId }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    // `timeout 1800` enforces the 30-minute cap in the kernel, so the tunnel
    // dies on schedule even if nobody ever polls again (dialog closed).
    const pid = await spawnDetached(
      ['timeout', '1800', getCloudflaredBin(), 'tunnel', '--no-autoupdate', '--url', getTestdriveOrigin()],
      TESTDRIVE_LOG(),
    );
    await writeState(TESTDRIVE_STATE(), { pid, started_at: new Date().toISOString() });
    logRouteInfo({
      requestId,
      route: ROUTE_NAME,
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      message: 'Test drive started',
      meta: { pid },
    });
    return NextResponse.json(
      { status: 'starting', started_at: new Date().toISOString(), requestId },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    await clearState(TESTDRIVE_STATE());
    const error = new RouteError(500, 'internal_error', 'Failed to start the test tunnel');
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
