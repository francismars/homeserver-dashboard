// @vitest-environment node
import { NextRequest } from 'next/server';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./utils', () => ({
  proxyWebDavRequest: vi.fn(async () => new Response('proxied', { status: 207 })),
}));

import { DELETE, GET, POST, PUT } from './route';
import { proxyWebDavRequest } from './utils';

describe('webdav root route handlers', () => {
  beforeEach(() => {
    (proxyWebDavRequest as Mock).mockClear();
  });

  it.each([
    ['GET', GET],
    ['POST', POST],
    ['PUT', PUT],
    ['DELETE', DELETE],
  ] as const)('%s delegates to the proxy with an empty path', async (method, handler) => {
    const request = new NextRequest('http://localhost:8080/api/webdav', { method });
    const res = await handler(request);
    expect(res.status).toBe(207);
    expect(proxyWebDavRequest).toHaveBeenCalledTimes(1);
    const [passedRequest, params, passedMethod] = (proxyWebDavRequest as Mock).mock.calls[0];
    expect(passedRequest).toBe(request);
    expect(passedMethod).toBe(method);
    await expect(params).resolves.toEqual({ path: [] });
  });
});
