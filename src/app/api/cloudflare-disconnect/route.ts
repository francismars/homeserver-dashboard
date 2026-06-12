import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { RouteError, errorResponse } from '@/lib/server/errors';
import {
  CERT_PATH,
  CONNECT_STATE,
  CREDENTIALS_PATH,
  LOCAL_CONFIG_PATH,
  PREVIEW_ENV,
  TESTDRIVE_STATE,
  clearState,
  getConfigDir,
  killPid,
  readState,
} from '@/lib/server/cloudflared-process';
import { getRequestId, logRouteError, logRouteInfo } from '@/lib/server/logger';

const ROUTE_NAME = '/api/cloudflare-disconnect';
const HOMESERVER_CONFIG = () => process.env.HOMESERVER_CONFIG_PATH || '/app/homeserver-data/config.toml';

/**
 * POST /api/cloudflare-disconnect
 * Tears down whatever Cloudflare setup exists locally - any mode - so the
 * user can start over (e.g. with a different Cloudflare account):
 *   - kills pending login / preview child processes
 *   - removes cert.pem, config.yml, credentials.json, the preview marker
 *   - truncates the tunnel token and domain files (the cloudflared
 *     containers crash-loop back to idle after the next restart)
 *   - resets icann_domain in the homeserver config to localhost so the
 *     published record stops pointing at the abandoned domain
 *
 * What it cannot do: delete the tunnel object and DNS record at Cloudflare.
 * Those need credentials we deliberately do not keep (the API token is
 * discarded after setup; the login cert is deleted). The response says so,
 * because reusing the same hostname later requires removing the old DNS
 * record in the Cloudflare dashboard first.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  const steps: Array<{ key: string; status: 'done' | 'skipped' }> = [];

  try {
    // Stop any child processes (pending browser-auth login, instant preview tunnel)
    for (const stateFile of [CONNECT_STATE(), TESTDRIVE_STATE()]) {
      const state = await readState(stateFile);
      if (state) killPid(state.pid);
      await clearState(stateFile);
    }
    steps.push({ key: 'processes', status: 'done' });

    // Remove every mode's artifacts
    await fs.rm(CERT_PATH(), { force: true });
    await fs.rm(LOCAL_CONFIG_PATH(), { force: true });
    await fs.rm(CREDENTIALS_PATH(), { force: true });
    await fs.rm(PREVIEW_ENV(), { force: true });
    for (const f of ['token', 'domain']) {
      try {
        await fs.writeFile(path.join(getConfigDir(), f), '', 'utf-8');
      } catch {
        // file may not exist in non-Umbrel environments
      }
    }
    steps.push({ key: 'credentials', status: 'done' });

    // Reset the published domain so the pkarr record stops advertising the
    // abandoned hostname after the next restart.
    try {
      const config = await fs.readFile(HOMESERVER_CONFIG(), 'utf-8');
      const reset = config
        .split('\n')
        .filter((line) => !/^public_icann_http_port\s*=/.test(line.trim()))
        .map((line) => (/^icann_domain\s*=/.test(line.trim()) ? 'icann_domain = "localhost"' : line))
        .join('\n');
      if (reset !== config) {
        const tmp = HOMESERVER_CONFIG() + '.tmp';
        await fs.writeFile(tmp, reset, 'utf-8');
        await fs.rename(tmp, HOMESERVER_CONFIG());
      }
      steps.push({ key: 'published_domain', status: 'done' });
    } catch {
      steps.push({ key: 'published_domain', status: 'skipped' });
    }

    logRouteInfo({
      requestId,
      route: ROUTE_NAME,
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      message: 'Cloudflare setup disconnected',
    });
    return NextResponse.json(
      {
        ok: true,
        steps,
        message:
          'Disconnected. Restart the app from Umbrel to finish. Note: the tunnel and DNS record still exist in your Cloudflare account (we keep no credentials that could delete them) - remove them in the Cloudflare dashboard if you want to reuse the same hostname.',
        requestId,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    const error = new RouteError(500, 'internal_error', 'Failed to disconnect');
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
