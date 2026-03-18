import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { RouteError, errorResponse } from '@/lib/server/errors';
import { logRouteError, logRouteInfo } from '@/lib/server/logger';

const CONFIG_PATH = process.env.HOMESERVER_CONFIG_PATH || '/app/homeserver-data/config.toml';
const ROUTE_NAME = '/api/server-config';

// Fields to redact from the config for security
const REDACT_PATTERNS = [/^admin_password\s*=\s*".*"/, /^database_url\s*=\s*".*"/];

function redactConfig(content: string): string {
  return content
    .split('\n')
    .map((line) => {
      for (const pattern of REDACT_PATTERNS) {
        if (pattern.test(line.trim())) {
          const key = line.split('=')[0];
          return `${key}= "********"`;
        }
      }
      return line;
    })
    .join('\n');
}

/**
 * GET /api/server-config
 * Returns the homeserver config.toml (read-only, with sensitive fields redacted).
 */
export async function GET() {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const redacted = redactConfig(raw);
    logRouteInfo({
      requestId,
      route: ROUTE_NAME,
      method: 'GET',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      message: 'Server config read successfully',
    });
    return NextResponse.json({ config: redacted, requestId });
  } catch (e: unknown) {
    const isNotFound = (e as NodeJS.ErrnoException).code === 'ENOENT';
    if (isNotFound) {
      const error = new RouteError(404, 'not_found', 'Config file not found. The homeserver may not have started yet.');
      logRouteError({
        requestId,
        route: ROUTE_NAME,
        method: 'GET',
        statusCode: error.status,
        durationMs: Date.now() - startedAt,
        errorType: error.type,
        message: error.message,
      });
      return errorResponse(error, requestId);
    }
    const error = new RouteError(500, 'internal_error', 'Failed to read config file');
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
