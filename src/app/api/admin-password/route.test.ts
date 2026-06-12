// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('admin-password route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  async function loadRoute() {
    const mod = await import('./route');
    return mod;
  }

  function getRequest(): NextRequest {
    return new NextRequest('http://localhost:8080/api/admin-password');
  }

  it('returns the ADMIN_TOKEN value with no-store caching', async () => {
    process.env.ADMIN_TOKEN = 'super-secret-admin-password';
    const { GET } = await loadRoute();
    const response = await GET(getRequest());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.password).toBe('super-secret-admin-password');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 404 when ADMIN_TOKEN is not configured', async () => {
    delete process.env.ADMIN_TOKEN;
    const { GET } = await loadRoute();
    const response = await GET(getRequest());
    const payload = await response.json();
    expect(response.status).toBe(404);
    expect(payload.type).toBe('not_found');
  });

  it('never includes the password in a 404 response', async () => {
    delete process.env.ADMIN_TOKEN;
    const { GET } = await loadRoute();
    const response = await GET(getRequest());
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain('password":"');
  });
});
