import { NextRequest, NextResponse } from 'next/server';
import { constants as fsConstants, promises as fs } from 'fs';
import path from 'path';
import { RouteError, errorResponse } from '@/lib/server/errors';
import { isAllowedPublicHostname } from '@/lib/server/hostname';
import { atomicWrite, fileExists } from '@/lib/server/cloudflared-process';
import { detectCloudflareMode } from '@/lib/server/cloudflare-mode';
import { detectRestartPending } from '@/lib/server/restart-pending';
import { getRequestId, logRouteError, logRouteInfo } from '@/lib/server/logger';

const ROUTE_NAME = '/api/cloudflare-config';
const CONFIG_DIR = process.env.CLOUDFLARE_CONFIG_DIR || '/app/cloudflare-config';
const TOKEN_FILE = path.join(CONFIG_DIR, 'token');
const DOMAIN_FILE = path.join(CONFIG_DIR, 'domain');

// Cloudflare tunnel tokens are opaque strings but they're not arbitrary: they're long
// (>=64 chars in current formats), URL-safe, and never contain whitespace. Reject
// anything obviously malformed to catch paste errors and prevent storing junk.
const TOKEN_PATTERN = /^[A-Za-z0-9_.+/=-]+$/;
const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 2048;

function isPlausibleCloudflareToken(token: string): boolean {
  if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH) return false;
  return TOKEN_PATTERN.test(token);
}

async function isCloudflareConfigSupported(): Promise<boolean> {
  try {
    await fs.access(CONFIG_DIR, fsConstants.R_OK | fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/cloudflare-config
 * Returns the server-derived setup mode plus the current domain (if set),
 * and the durable restart-pending signal (state mtimes vs the wrapper boot
 * stamp; null when no stamp exists and the client must fall back to its
 * in-session signals).
 * Token is never returned. `supported: false` means only one thing: the
 * config dir is not accessible in this environment (the tab is pointless);
 * any other failure is an honest 500 so the client can retry instead of
 * hiding the tab.
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  const supported = await isCloudflareConfigSupported();
  try {
    const { mode, domain } = await detectCloudflareMode();
    const { restart_pending, restart_reason } = await detectRestartPending();
    const response = NextResponse.json(
      {
        domain,
        mode,
        configured: mode === 'connect' || mode === 'token',
        supported,
        restart_pending,
        restart_reason,
        requestId,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    logRouteInfo({
      requestId,
      route: ROUTE_NAME,
      method: 'GET',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      message: 'Cloudflare config read',
      meta: { mode, supported },
    });
    return response;
  } catch (e) {
    const error = new RouteError(500, 'internal_error', 'Could not read the Cloudflare configuration');
    logRouteError({
      requestId,
      route: ROUTE_NAME,
      method: 'GET',
      statusCode: error.status,
      durationMs: Date.now() - startedAt,
      errorType: error.type,
      message: e instanceof Error ? e.message : String(e),
    });
    return errorResponse(error, requestId);
  }
}

/**
 * POST /api/cloudflare-config
 * Body: { token?: string, domain?: string }
 * Writes to mounted volume so homeserver and cloudflared pick up after restart.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  let body: { token?: string; domain?: string };
  try {
    body = await request.json();
  } catch {
    const error = new RouteError(400, 'bad_request', 'Invalid JSON payload');
    logRouteError({
      requestId,
      route: ROUTE_NAME,
      method: 'POST',
      statusCode: error.status,
      durationMs: Date.now() - startedAt,
      errorType: error.type,
      message: error.message,
    });
    return errorResponse(error, requestId);
  }

  const domain = typeof body.domain === 'string' ? body.domain.trim() : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (domain && !isAllowedPublicHostname(domain)) {
    const error = new RouteError(400, 'bad_request', 'Invalid domain');
    logRouteError({
      requestId,
      route: ROUTE_NAME,
      method: 'POST',
      statusCode: error.status,
      durationMs: Date.now() - startedAt,
      errorType: error.type,
      message: error.message,
      meta: { domainLength: domain.length },
    });
    return errorResponse(error, requestId);
  }

  if (token && !isPlausibleCloudflareToken(token)) {
    const error = new RouteError(400, 'bad_request', 'Invalid token');
    logRouteError({
      requestId,
      route: ROUTE_NAME,
      method: 'POST',
      statusCode: error.status,
      durationMs: Date.now() - startedAt,
      errorType: error.type,
      message: error.message,
      meta: { tokenLength: token.length },
    });
    return errorResponse(error, requestId);
  }

  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (e) {
    const error = new RouteError(503, 'upstream_error', 'Config directory unavailable');
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

  // A domain-only save must land in a setup that can actually serve it.
  if (body.domain !== undefined && body.token === undefined) {
    const hasConnectConfig = await fileExists(path.join(CONFIG_DIR, 'config.yml'));
    const hasToken = await fs
      .readFile(TOKEN_FILE, 'utf-8')
      .then((s) => s.trim().length > 0)
      .catch(() => false);
    // While a Connect setup exists, its tunnel keeps serving the hostname
    // baked into config.yml: writing only the domain file would make status
    // report the new domain (and the wrapper publish it) while the tunnel
    // still serves the old one.
    let error: RouteError | null = null;
    if (hasConnectConfig) {
      error = new RouteError(
        400,
        'bad_request',
        'This domain is managed by the Connect Cloudflare setup, so saving it here would not change what the tunnel serves. Disconnect first, or use the Connect flow to change domains.',
      );
    } else if (!hasToken) {
      error = new RouteError(
        400,
        'bad_request',
        'A Cloudflare tunnel token is required for the domain to work. Paste the token along with the domain, or use one of the guided setups.',
      );
    }
    if (error) {
      logRouteError({
        requestId,
        route: ROUTE_NAME,
        method: 'POST',
        statusCode: error.status,
        durationMs: Date.now() - startedAt,
        errorType: error.type,
        message: error.message,
        meta: { hasConnectConfig },
      });
      return errorResponse(error, requestId);
    }
  }

  try {
    if (body.token !== undefined && token) {
      // Switching to token mode: drop the locally-managed config BEFORE the
      // token lands, so a crash in between can never leave both modes
      // validly configured with two tunnels running.
      await fs.rm(path.join(CONFIG_DIR, 'config.yml'), { force: true });
      await fs.rm(path.join(CONFIG_DIR, 'credentials.json'), { force: true });
    }
    if (body.domain !== undefined) {
      await atomicWrite(DOMAIN_FILE, domain);
    }
    if (body.token !== undefined) {
      await atomicWrite(TOKEN_FILE, token);
    }
    logRouteInfo({
      requestId,
      route: ROUTE_NAME,
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      message: 'Cloudflare config saved',
      meta: {
        wroteDomain: body.domain !== undefined,
        wroteToken: body.token !== undefined,
      },
    });
    return NextResponse.json({
      ok: true,
      // Two separate truths: the crash-looping cloudflared picks the token up
      // by itself; only the pkarr publication needs the restart.
      message:
        'Saved. The tunnel picks this up within a minute; restart the app from Umbrel to publish your domain to the Pubky network.',
      requestId,
    });
  } catch (e) {
    const error = new RouteError(500, 'internal_error', 'Failed to write config');
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
