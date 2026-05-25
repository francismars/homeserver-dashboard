import { NextRequest } from 'next/server';

type LogLevel = 'info' | 'warn' | 'error';

type RouteLogPayload = {
  requestId: string;
  route: string;
  method: string;
  statusCode?: number;
  durationMs?: number;
  errorType?: string;
  message: string;
  meta?: Record<string, unknown>;
};

const REDACTED_KEYS = ['authorization', 'x-admin-password', 'token', 'password', 'secret'];

function redactMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (REDACTED_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function emitLog(level: LogLevel, payload: RouteLogPayload) {
  const body = {
    timestamp: new Date().toISOString(),
    level,
    ...payload,
    meta: redactMeta(payload.meta),
  };

  if (level === 'error') {
    console.error(body);
    return;
  }
  if (level === 'warn') {
    console.warn(body);
    return;
  }
  console.info(body);
}

export function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') || crypto.randomUUID();
}

export function logRouteInfo(payload: RouteLogPayload) {
  emitLog('info', payload);
}

export function logRouteError(payload: RouteLogPayload) {
  emitLog('error', payload);
}
