import { NextRequest, NextResponse } from 'next/server';
import { RouteError, errorResponse } from '@/lib/server/errors';
import {
  TESTDRIVE_LOG,
  TESTDRIVE_MAX_AGE_MS,
  getTestdriveOrigin,
  TESTDRIVE_STATE,
  clearState,
  isBinaryAvailable,
  isPidAlive,
  killPid,
  parseQuickTunnelUrl,
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

async function currentStatus() {
  const state = await readState(TESTDRIVE_STATE());
  if (!state) return { status: 'stopped' as const };
  const ageMs = Date.now() - Date.parse(state.started_at);
  const alive = isPidAlive(state.pid);
  if (!alive) {
    await clearState(TESTDRIVE_STATE());
    return { status: 'stopped' as const };
  }
  if (ageMs > TESTDRIVE_MAX_AGE_MS) {
    killPid(state.pid);
    await clearState(TESTDRIVE_STATE());
    return { status: 'stopped' as const };
  }
  const url = await parseQuickTunnelUrl();
  return {
    status: url ? ('running' as const) : ('starting' as const),
    url: url ?? undefined,
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

  if (!isBinaryAvailable()) {
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

  try {
    const pid = await spawnDetached(['tunnel', '--no-autoupdate', '--url', getTestdriveOrigin()], TESTDRIVE_LOG());
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
