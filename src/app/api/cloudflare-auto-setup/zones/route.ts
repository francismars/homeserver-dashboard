import { NextRequest, NextResponse } from 'next/server';
import { RouteError, errorResponse } from '@/lib/server/errors';
import { CfApiError, listZones } from '@/lib/server/cloudflare-api';
import { getRequestId, logRouteError, logRouteInfo } from '@/lib/server/logger';

const ROUTE_NAME = '/api/cloudflare-auto-setup/zones';

/**
 * POST /api/cloudflare-auto-setup/zones
 * Body: { api_token: string }
 * Returns the domains (zones) the token can manage. Doubles as token
 * validation: this is the first call the automatic-setup UI makes.
 *
 * POST (not GET) so the token travels in the body, never in a URL that
 * could end up in logs. The token is forwarded to Cloudflare and discarded;
 * it is never persisted or logged (only its length appears in log meta).
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();

  let body: { api_token?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse(new RouteError(400, 'bad_request', 'Invalid JSON payload'), requestId);
  }
  const apiToken = typeof body.api_token === 'string' ? body.api_token.trim() : '';
  if (!apiToken || apiToken.length < 20 || apiToken.length > 256 || /\s/.test(apiToken)) {
    return errorResponse(new RouteError(400, 'bad_request', 'Missing or malformed api_token'), requestId);
  }

  try {
    const zones = await listZones(apiToken);
    logRouteInfo({
      requestId,
      route: ROUTE_NAME,
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      message: 'Zones listed',
      meta: { zoneCount: zones.length, tokenLength: apiToken.length },
    });
    return NextResponse.json(
      {
        zones: zones.map((z) => ({
          id: z.id,
          name: z.name,
          status: z.status,
          account_id: z.account.id,
        })),
        requestId,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    const error =
      e instanceof CfApiError && (e.status === 401 || e.status === 403)
        ? new RouteError(
            401,
            'unauthorized',
            'Cloudflare rejected the token. Check that it exists, has not expired, and includes Account > Cloudflare Tunnel > Edit and Zone > DNS > Edit.',
          )
        : e instanceof CfApiError
          ? new RouteError(502, 'upstream_error', `Cloudflare API error: ${e.messages.join('; ') || e.status}`)
          : new RouteError(502, 'upstream_error', 'Could not reach the Cloudflare API');
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
