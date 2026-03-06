import { NextRequest, NextResponse } from 'next/server';
import { RouteError, errorResponse, isAbortError } from '@/lib/server/errors';
import { getRequestId, logRouteError, logRouteInfo } from '@/lib/server/logger';

const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const SUPPORTED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PROPFIND', 'MKCOL', 'MOVE', 'COPY']);

function getActualMethod(request: NextRequest, fallbackMethod: string): string {
  const overrideMethod = request.headers.get('X-HTTP-Method-Override');
  const actualMethod = (overrideMethod || fallbackMethod).toUpperCase();
  if (!SUPPORTED_METHODS.has(actualMethod)) {
    throw new RouteError(400, 'bad_request', `Unsupported WebDAV method: ${actualMethod}`);
  }
  return actualMethod;
}

function getAuthHeader(adminToken: string): string {
  const value = Buffer.from(`admin:${adminToken}`).toString('base64');
  return `Basic ${value}`;
}

function isRetryableMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'PROPFIND';
}

function buildDavPath(pathSegments: string, actualMethod: string): string {
  const isDirectoryRequest = actualMethod === 'PROPFIND' || actualMethod === 'MKCOL';
  const needsTrailingSlash = isDirectoryRequest && pathSegments;

  const suffix = pathSegments ? `/${pathSegments}` : '';
  const normalizedSuffix = needsTrailingSlash && !suffix.endsWith('/') ? `${suffix}/` : suffix || '/';
  return `/dav${normalizedSuffix}`;
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

// Handle PROPFIND and other WebDAV methods via POST with X-HTTP-Method-Override header
export async function proxyWebDavRequest(
  request: NextRequest,
  paramsPromise: Promise<{ path: string[] }>,
  method: string
) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  const routeName = '/api/webdav/[...path]';
  const { path } = await paramsPromise;

  const adminBaseUrl = process.env.ADMIN_BASE_URL || '';
  const adminToken = process.env.ADMIN_TOKEN || '';

  if (!adminBaseUrl || !adminToken) {
    const error = new RouteError(500, 'config_error', 'WebDAV proxy is not configured');
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

  const pathSegments = path.join('/');
  let actualMethod = method.toUpperCase();
  let webdavPath = '/dav/';

  try {
    actualMethod = getActualMethod(request, method);
    const allowedBodyMethods = new Set(['POST', 'PUT']);
    let body: string | undefined;
    if (allowedBodyMethods.has(method.toUpperCase())) {
      body = await request.text();
    }
    const commonHeaders: HeadersInit = {};
    const depth = request.headers.get('Depth');
    if (depth) commonHeaders['Depth'] = depth;

    const contentType = request.headers.get('Content-Type');
    if (contentType) commonHeaders['Content-Type'] = contentType;

    const destination = request.headers.get('Destination');
    if (destination) commonHeaders['Destination'] = destination;

    webdavPath = buildDavPath(pathSegments, actualMethod);
    const url = new URL(webdavPath, adminBaseUrl);
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    const response = await fetchWithRetry(
      url.toString(),
      {
        method: actualMethod,
        headers: {
          ...commonHeaders,
          Authorization: getAuthHeader(adminToken),
        },
        body,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
      isRetryableMethod(actualMethod),
    );

    if (response.status === 204) {
      logRouteInfo({
        requestId,
        route: routeName,
        method: actualMethod,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        message: 'WebDAV proxy request completed',
        meta: { path: webdavPath },
      });
      return new NextResponse(null, {
        status: 204,
        headers: { 'X-Request-Id': requestId },
      });
    }

    const responseText = await response.text();
    const responseContentType = response.headers.get('Content-Type') || 'application/xml';
    logRouteInfo({
      requestId,
      route: routeName,
      method: actualMethod,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      message: 'WebDAV proxy request completed',
      meta: { path: webdavPath },
    });

    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'Content-Type': responseContentType,
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    const mapped =
      error instanceof RouteError
        ? error
        : isAbortError(error)
          ? new RouteError(504, 'timeout', 'Homeserver WebDAV request timed out')
          : new RouteError(502, 'upstream_error', 'Failed to connect to homeserver WebDAV');
    logRouteError({
      requestId,
      route: routeName,
      method: actualMethod,
      statusCode: mapped.status,
      durationMs: Date.now() - startedAt,
      errorType: mapped.type,
      message: error instanceof Error ? error.message : String(error),
      meta: { path: webdavPath },
    });
    return errorResponse(mapped, requestId);
  }
}
