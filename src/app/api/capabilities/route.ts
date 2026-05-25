import { NextResponse } from 'next/server';
import { constants as fsConstants, promises as fs } from 'fs';
import { logRouteError } from '@/lib/server/logger';

const CONFIG_PATH = process.env.HOMESERVER_CONFIG_PATH || '/app/homeserver-data/config.toml';
const LOG_PATH = process.env.HOMESERVER_LOG_PATH || '';
const CACHE_TTL_MS = 5000;
const ROUTE_NAME = '/api/capabilities';

/**
 * Runtime feature flags derived from filesystem accessibility — used by the
 * UI to gate the Logs tab and the Config edit affordance without coordinating
 * a coupled release between dashboard and homeserver.
 */
export type Capabilities = {
  logs: boolean;
  configWrite: boolean;
};

type CacheEntry = { value: Capabilities; expires: number };

// Module-scoped cache. Next.js gives each route handler a fresh request context
// but the module state persists across requests, so a tiny LRU-of-one works.
// Tests reset via `vi.resetModules()`, which re-evaluates this module and
// gives them a fresh `cached`.
let cached: CacheEntry | null = null;

async function probe(): Promise<Capabilities> {
  const logs = LOG_PATH
    ? await fs
        .access(LOG_PATH, fsConstants.R_OK)
        .then(() => true)
        .catch(() => false)
    : false;
  const configWrite = await fs
    .access(CONFIG_PATH, fsConstants.W_OK)
    .then(() => true)
    .catch(() => false);
  return { logs, configWrite };
}

/**
 * GET /api/capabilities
 * Returns `{ logs, configWrite }`. `logs` is true only when HOMESERVER_LOG_PATH
 * is set AND the file is readable; `configWrite` is true when the config file
 * is writable. Cached for ~5s; tests can reset via `_resetCacheForTests`.
 */
export async function GET() {
  const now = Date.now();
  if (cached && cached.expires > now) {
    return NextResponse.json(cached.value);
  }
  try {
    const value = await probe();
    cached = { value, expires: now + CACHE_TTL_MS };
    return NextResponse.json(value);
  } catch (e) {
    logRouteError({
      requestId: crypto.randomUUID(),
      route: ROUTE_NAME,
      method: 'GET',
      statusCode: 200,
      errorType: 'internal_error',
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ logs: false, configWrite: false });
  }
}
