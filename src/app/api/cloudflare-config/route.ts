import { NextRequest, NextResponse } from 'next/server';
import { constants as fsConstants, promises as fs } from 'fs';
import path from 'path';
import { RouteError, errorResponse } from '@/lib/server/errors';
import { isAllowedPublicHostname } from '@/lib/server/hostname';
import { getRequestId, logRouteError, logRouteInfo } from '@/lib/server/logger';

const ROUTE_NAME = '/api/cloudflare-config';
const CONFIG_DIR = process.env.CLOUDFLARE_CONFIG_DIR || '/app/cloudflare-config';
const TOKEN_FILE = path.join(CONFIG_DIR, 'token');
const DOMAIN_FILE = path.join(CONFIG_DIR, 'domain');

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
 * Returns current Cloudflare domain (if set). Token is never returned.
 */
export async function GET() {
  const startedAt = Date.now();
  const supported = await isCloudflareConfigSupported();
  try {
    const domain = await fs.readFile(DOMAIN_FILE, 'utf-8').then((s) => s.trim()).catch(() => null);
    const hasToken = await fs
      .readFile(TOKEN_FILE, 'utf-8')
      .then((s) => s.trim().length > 0)
      .catch(() => false);
    const response = NextResponse.json({
      domain: domain || null,
      configured: !!(domain && hasToken),
      supported,
    });
    logRouteInfo({
      requestId: crypto.randomUUID(),
      route: ROUTE_NAME,
      method: 'GET',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      message: 'Cloudflare config read',
      meta: { configured: !!(domain && hasToken), supported },
    });
    return response;
  } catch {
    logRouteError({
      requestId: crypto.randomUUID(),
      route: ROUTE_NAME,
      method: 'GET',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      errorType: 'internal_error',
      message: 'Cloudflare config read fallback',
    });
    return NextResponse.json({ domain: null, configured: false, supported: false });
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

  try {
    if (body.domain !== undefined) {
      await fs.writeFile(DOMAIN_FILE, domain, 'utf-8');
    }
    if (body.token !== undefined) {
      await fs.writeFile(TOKEN_FILE, token, 'utf-8');
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
      message: 'Saved. Restart the app from Umbrel for the tunnel to connect.',
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
