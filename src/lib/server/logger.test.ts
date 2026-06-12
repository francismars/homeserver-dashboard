// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestId, logRouteError, logRouteInfo } from './logger';

const basePayload = {
  requestId: 'req-1',
  route: '/api/test',
  method: 'GET',
  message: 'hello',
};

describe('getRequestId', () => {
  it('returns the incoming x-request-id header when present', () => {
    const request = new NextRequest('http://localhost:8080/api/test', { headers: { 'x-request-id': 'upstream-7' } });
    expect(getRequestId(request)).toBe('upstream-7');
  });

  it('generates a UUID when no header is set', () => {
    const request = new NextRequest('http://localhost:8080/api/test');
    expect(getRequestId(request)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('route logging', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logRouteInfo emits a structured info entry', () => {
    logRouteInfo({ ...basePayload, statusCode: 200, durationMs: 12 });
    expect(console.info).toHaveBeenCalledTimes(1);
    const entry = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(entry.level).toBe('info');
    expect(entry.route).toBe('/api/test');
    expect(entry.statusCode).toBe(200);
    expect(entry.timestamp).toEqual(expect.any(String));
  });

  it('logRouteError emits on console.error with the error type', () => {
    logRouteError({ ...basePayload, statusCode: 502, errorType: 'upstream_error' });
    expect(console.error).toHaveBeenCalledTimes(1);
    const entry = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(entry.level).toBe('error');
    expect(entry.errorType).toBe('upstream_error');
  });

  it('redacts sensitive meta keys and keeps the rest', () => {
    logRouteInfo({
      ...basePayload,
      meta: {
        authorization: 'Bearer abc',
        'x-admin-password': 'hunter2',
        apiToken: 'secret-token',
        userPassword: 'pw',
        clientSecret: 'shh',
        zoneCount: 3,
      },
    });
    const entry = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(entry.meta).toEqual({
      authorization: '[REDACTED]',
      'x-admin-password': '[REDACTED]',
      apiToken: '[REDACTED]',
      userPassword: '[REDACTED]',
      clientSecret: '[REDACTED]',
      zoneCount: 3,
    });
  });

  it('omits meta entirely when none is given', () => {
    logRouteInfo(basePayload);
    const entry = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(entry.meta).toBeUndefined();
  });
});
