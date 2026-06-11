import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { RouteError } from '@/lib/server/errors';
import { isAllowedPublicHostname } from '@/lib/server/hostname';
import {
  CfApiError,
  TUNNEL_NAME,
  createDnsRecord,
  createTunnel,
  deleteDnsRecord,
  findTunnelByName,
  getTunnelToken,
  getZone,
  listDnsRecordsAtName,
  putTunnelIngress,
  updateDnsRecord,
} from '@/lib/server/cloudflare-api';
import { getRequestId, logRouteError, logRouteInfo } from '@/lib/server/logger';

const ROUTE_NAME = '/api/cloudflare-auto-setup';
const CONFIG_DIR = process.env.CLOUDFLARE_CONFIG_DIR || '/app/cloudflare-config';

/** Single DNS label: letters/digits/hyphens, no leading/trailing hyphen. */
const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

type StepKey = 'tunnel' | 'ingress' | 'dns' | 'credentials';
type StepStatus = 'done' | 'failed' | 'skipped';
type Step = { key: StepKey; status: StepStatus; detail?: string };

/**
 * POST /api/cloudflare-auto-setup
 * Body: { api_token: string, zone_id: string, subdomain?: string, overwrite_dns?: boolean }
 *
 * Orchestrates the full tunnel setup against the Cloudflare API:
 *   1. resolve + validate the zone (server-side; client zone names are not trusted)
 *   2. adopt-or-create the tunnel named "pubky-homeserver" (idempotent re-runs)
 *   3. PUT the ingress config (hostname -> http://homeserver:6286)
 *   4. create the proxied CNAME (409 + dns_conflict payload if a record exists,
 *      unless overwrite_dns is set)
 *   5. fetch the tunnel run token and write the same token/domain files the
 *      manual flow writes
 *
 * The API token is used for the duration of this request and discarded.
 * It is never persisted, logged, or echoed in responses.
 *
 * The response includes a `steps` array so the UI can show exactly how far
 * setup got, both on success and on failure.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  const steps: Step[] = [];

  const fail = (error: RouteError, logMessage?: string, extra?: Record<string, unknown>) => {
    logRouteError({
      requestId,
      route: ROUTE_NAME,
      method: 'POST',
      statusCode: error.status,
      durationMs: Date.now() - startedAt,
      errorType: error.type,
      message: logMessage ?? error.message,
    });
    return NextResponse.json(
      { error: error.publicMessage, type: error.type, steps, requestId, ...extra },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  };

  let body: { api_token?: unknown; zone_id?: unknown; subdomain?: unknown; overwrite_dns?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(new RouteError(400, 'bad_request', 'Invalid JSON payload'));
  }

  const apiToken = typeof body.api_token === 'string' ? body.api_token.trim() : '';
  const zoneId = typeof body.zone_id === 'string' ? body.zone_id.trim() : '';
  const subdomain = typeof body.subdomain === 'string' ? body.subdomain.trim().toLowerCase() : '';
  const overwriteDns = body.overwrite_dns === true;

  if (!apiToken || apiToken.length < 20 || apiToken.length > 256 || /\s/.test(apiToken)) {
    return fail(new RouteError(400, 'bad_request', 'Missing or malformed api_token'));
  }
  if (!zoneId || !/^[a-f0-9]{32}$/.test(zoneId)) {
    return fail(new RouteError(400, 'bad_request', 'Missing or malformed zone_id'));
  }
  if (subdomain && !SUBDOMAIN_PATTERN.test(subdomain)) {
    return fail(new RouteError(400, 'bad_request', 'Subdomain must be a single DNS label (letters, digits, hyphens)'));
  }

  // --- 1. Resolve the zone server-side -------------------------------------
  let zoneName: string;
  let accountId: string;
  try {
    const zone = await getZone(apiToken, zoneId);
    if (zone.status !== 'active') {
      return fail(
        new RouteError(
          400,
          'bad_request',
          `Domain ${zone.name} is on Cloudflare but not active yet. Point its nameservers at Cloudflare first.`,
        ),
      );
    }
    zoneName = zone.name;
    accountId = zone.account.id;
  } catch (e) {
    return fail(mapCfError(e, 'zone'), e instanceof Error ? e.message : String(e));
  }

  const hostname = subdomain ? `${subdomain}.${zoneName}` : zoneName;
  if (!isAllowedPublicHostname(hostname)) {
    return fail(new RouteError(400, 'bad_request', `Resulting hostname is not valid: ${hostname}`));
  }

  // --- 2. Adopt-or-create the tunnel ---------------------------------------
  let tunnelId: string;
  let runToken: string | undefined;
  try {
    const existing = await findTunnelByName(apiToken, accountId, TUNNEL_NAME);
    if (existing) {
      tunnelId = existing.id;
      steps.push({ key: 'tunnel', status: 'done', detail: 'Reusing existing tunnel' });
    } else {
      const created = await createTunnel(apiToken, accountId, TUNNEL_NAME);
      tunnelId = created.id;
      runToken = created.token;
      steps.push({ key: 'tunnel', status: 'done', detail: 'Tunnel created' });
    }
  } catch (e) {
    steps.push({ key: 'tunnel', status: 'failed' });
    return fail(mapCfError(e, 'tunnel'), e instanceof Error ? e.message : String(e));
  }

  // --- 3. Ingress ------------------------------------------------------------
  try {
    await putTunnelIngress(apiToken, accountId, tunnelId, hostname);
    steps.push({ key: 'ingress', status: 'done' });
  } catch (e) {
    steps.push({ key: 'ingress', status: 'failed' });
    return fail(mapCfError(e, 'tunnel'), e instanceof Error ? e.message : String(e));
  }

  // --- 4. DNS ----------------------------------------------------------------
  const target = `${tunnelId}.cfargotunnel.com`;
  try {
    const existingRecords = await listDnsRecordsAtName(apiToken, zoneId, hostname);
    const alreadyOurs = existingRecords.find((r) => r.type === 'CNAME' && r.content === target);
    const conflicting = existingRecords.filter((r) => !(r.type === 'CNAME' && r.content === target));

    if (alreadyOurs && conflicting.length === 0) {
      steps.push({ key: 'dns', status: 'done', detail: 'DNS record already in place' });
    } else if (conflicting.length > 0 && !overwriteDns) {
      steps.push({ key: 'dns', status: 'failed', detail: 'Existing DNS record at this hostname' });
      logRouteInfo({
        requestId,
        route: ROUTE_NAME,
        method: 'POST',
        statusCode: 409,
        durationMs: Date.now() - startedAt,
        message: 'DNS conflict requires user confirmation',
        meta: { recordTypes: conflicting.map((r) => r.type) },
      });
      return NextResponse.json(
        {
          error: `A DNS record already exists at ${hostname}`,
          type: 'dns_conflict',
          existing_records: conflicting.map((r) => ({ type: r.type, content: r.content })),
          steps,
          requestId,
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    } else if (conflicting.length > 0) {
      // Overwrite confirmed: CNAMEs are updated in place, other types are
      // replaced (delete + create) since a CNAME cannot coexist with them.
      for (const record of conflicting) {
        if (record.type === 'CNAME') {
          await updateDnsRecord(apiToken, zoneId, record.id, hostname, tunnelId);
        } else {
          await deleteDnsRecord(apiToken, zoneId, record.id);
        }
      }
      if (!alreadyOurs && !conflicting.some((r) => r.type === 'CNAME')) {
        await createDnsRecord(apiToken, zoneId, hostname, tunnelId);
      }
      steps.push({ key: 'dns', status: 'done', detail: 'Existing record replaced' });
    } else {
      await createDnsRecord(apiToken, zoneId, hostname, tunnelId);
      steps.push({ key: 'dns', status: 'done' });
    }
  } catch (e) {
    steps.push({ key: 'dns', status: 'failed' });
    return fail(mapCfError(e, 'dns'), e instanceof Error ? e.message : String(e));
  }

  // --- 5. Run token + files ----------------------------------------------------
  try {
    if (!runToken) {
      runToken = await getTunnelToken(apiToken, accountId, tunnelId);
    }
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    // Same files the manual flow writes; the entrypoint re-asserts ownership
    // and modes at the next app start. cloudflared's restart-on-failure loop
    // picks the token up within seconds, so the tunnel connects without an
    // app restart; the restart is only needed to publish icann_domain.
    await fs.writeFile(path.join(CONFIG_DIR, 'token'), runToken, 'utf-8');
    await fs.writeFile(path.join(CONFIG_DIR, 'domain'), hostname, 'utf-8');
    steps.push({ key: 'credentials', status: 'done' });
  } catch (e) {
    steps.push({ key: 'credentials', status: 'failed' });
    const error =
      e instanceof CfApiError
        ? mapCfError(e, 'tunnel')
        : new RouteError(500, 'internal_error', 'Could not save the tunnel credentials');
    return fail(error, e instanceof Error ? e.message : String(e));
  }

  logRouteInfo({
    requestId,
    route: ROUTE_NAME,
    method: 'POST',
    statusCode: 200,
    durationMs: Date.now() - startedAt,
    message: 'Automatic Cloudflare setup completed',
    meta: { hostnameLength: hostname.length, adopted: steps[0]?.detail === 'Reusing existing tunnel' },
  });
  return NextResponse.json(
    {
      ok: true,
      hostname,
      steps,
      message: 'Tunnel configured. Restart the app from Umbrel to publish your domain to the Pubky network.',
      requestId,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Translates CfApiError into operator-actionable messages. The `area`
 * identifies which permission would have been exercised, so a 403 can name
 * the exact missing grant instead of a generic "forbidden".
 */
function mapCfError(e: unknown, area: 'zone' | 'tunnel' | 'dns'): RouteError {
  if (!(e instanceof CfApiError)) {
    return new RouteError(502, 'upstream_error', 'Could not reach the Cloudflare API');
  }
  if (e.status === 401) {
    return new RouteError(401, 'unauthorized', 'Cloudflare rejected the token (invalid or expired).');
  }
  if (e.status === 403) {
    const missing =
      area === 'dns'
        ? 'Zone > DNS > Edit'
        : area === 'tunnel'
          ? 'Account > Cloudflare Tunnel > Edit'
          : 'Zone > Zone > Read';
    return new RouteError(
      403,
      'forbidden',
      `The token is missing a permission: ${missing}. Recreate it with the pre-filled link and try again.`,
    );
  }
  if (e.status === 404 && area === 'zone') {
    return new RouteError(400, 'bad_request', 'Domain not found for this token. Reload the domain list.');
  }
  return new RouteError(502, 'upstream_error', `Cloudflare API error: ${e.messages.join('; ') || `HTTP ${e.status}`}`);
}
