import { NextRequest, NextResponse } from 'next/server';
import { RouteError, errorResponse, isAbortError } from '@/lib/server/errors';
import { getRequestId, logRouteError, logRouteInfo } from '@/lib/server/logger';

export const dynamic = 'force-dynamic';
const UPSTREAM_TIMEOUT_MS = 60000;
const MAX_RETRIES = 0;

function getForwardHeaders(request: NextRequest): Record<string, string> {
  const allowlist = new Set(['accept', 'content-type', 'if-none-match', 'if-match', 'user-agent']);
  const result: Record<string, string> = {};

  for (const [rawKey, value] of request.headers.entries()) {
    const key = rawKey.toLowerCase();
    if (allowlist.has(key)) {
      result[rawKey] = value;
    }
  }

  return result;
}

async function fetchWithRetry(url: string, init: RequestInit, retryable: boolean): Promise<Response> {
  let lastError: unknown;
  const attempts = retryable ? MAX_RETRIES + 1 : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (!retryable || !isAbortError(error) || attempt === attempts) {
        throw error;
      }
    }
  }

  throw lastError;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path, 'POST');
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path, 'PUT');
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path, 'DELETE');
}

async function proxyRequest(request: NextRequest, pathSegments: string[], method: string) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  const routeName = '/api/admin/[...path]';
  const baseUrl = process.env.ADMIN_BASE_URL;
  const token = process.env.ADMIN_TOKEN;

  if (!baseUrl || !token) {
    const error = new RouteError(500, 'config_error', 'Homeserver admin API is not configured');
    logRouteError({
      requestId,
      route: routeName,
      method,
      statusCode: error.status,
      durationMs: Date.now() - startedAt,
      errorType: error.type,
      message: error.message,
    });
    return errorResponse(error, requestId);
  }

  const path = '/' + pathSegments.join('/');
  const url = new URL(path, baseUrl);

  // Forward query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  try {
    const body = method !== 'GET' && method !== 'HEAD' ? await request.text() : undefined;
    const response = await fetchWithRetry(
      url.toString(),
      {
        method,
        cache: 'no-store',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers: {
          'X-Admin-Password': token,
          ...getForwardHeaders(request),
        },
        body,
      },
      method === 'GET' || method === 'HEAD',
    );

    const contentType = response.headers.get('Content-Type') || 'application/json';
    const data = await response.text();
    const durationMs = Date.now() - startedAt;
    logRouteInfo({
      requestId,
      route: routeName,
      method,
      statusCode: response.status,
      durationMs,
      message: 'Admin proxy request completed',
      meta: { path },
    });

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    const mapped = isAbortError(error)
      ? new RouteError(504, 'timeout', 'Homeserver request timed out')
      : new RouteError(502, 'upstream_error', 'Failed to connect to homeserver');
    logRouteError({
      requestId,
      route: routeName,
      method,
      statusCode: mapped.status,
      durationMs: Date.now() - startedAt,
      errorType: mapped.type,
      message: error instanceof Error ? error.message : String(error),
      meta: { path, targetHost: new URL(baseUrl).host },
    });
    return errorResponse(mapped, requestId);
  }
}
