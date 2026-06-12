// @vitest-environment node
import { NextRequest } from 'next/server';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils', () => ({
  proxyWebDavRequest: vi.fn(async () => new Response('proxied', { status: 207 })),
}));

import { DELETE, GET, POST, PUT } from './route';
import { proxyWebDavRequest } from '../utils';

describe('webdav catch-all route handlers', () => {
  beforeEach(() => {
    (proxyWebDavRequest as Mock).mockClear();
  });

  it.each([
    ['GET', GET],
    ['POST', POST],
    ['PUT', PUT],
    ['DELETE', DELETE],
  ] as const)('%s forwards the request, path params and method to the proxy', async (method, handler) => {
    const request = new NextRequest('http://localhost:8080/api/webdav/pub/files/a.txt', { method });
    const params = Promise.resolve({ path: ['pub', 'files', 'a.txt'] });
    const res = await handler(request, { params });
    expect(res.status).toBe(207);
    expect(proxyWebDavRequest).toHaveBeenCalledTimes(1);
    const [passedRequest, passedParams, passedMethod] = (proxyWebDavRequest as Mock).mock.calls[0];
    expect(passedRequest).toBe(request);
    expect(passedParams).toBe(params);
    expect(passedMethod).toBe(method);
  });
});
