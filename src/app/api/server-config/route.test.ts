import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

describe('server-config route', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'srv-config-test-'));
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function loadRoute(configPath: string) {
    process.env.HOMESERVER_CONFIG_PATH = configPath;
    const mod = await import('./route');
    return mod.GET;
  }

  it('returns 404 when the config file does not exist', async () => {
    const GET = await loadRoute(path.join(tmpDir, 'missing.toml'));
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(404);
    expect(payload.type).toBe('not_found');
  });

  it('returns the raw config with sensitive fields redacted', async () => {
    const cfg = [
      '# Pubky homeserver config',
      'public_address = "https://example.com"',
      'admin_password = "super-secret-123"',
      'database_url = "postgres://user:pw@db/pubky"',
      'something_else = 42',
    ].join('\n');
    const configPath = path.join(tmpDir, 'config.toml');
    await fs.writeFile(configPath, cfg, 'utf-8');
    const GET = await loadRoute(configPath);
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.config).toContain('public_address = "https://example.com"');
    expect(payload.config).toContain('something_else = 42');
    expect(payload.config).not.toContain('super-secret-123');
    expect(payload.config).not.toContain('postgres://user:pw@db/pubky');
    expect(payload.config).toContain('"********"');
  });

  it('preserves non-sensitive lines unchanged', async () => {
    const cfg = '# header\nfoo = "bar"\n';
    const configPath = path.join(tmpDir, 'config.toml');
    await fs.writeFile(configPath, cfg, 'utf-8');
    const GET = await loadRoute(configPath);
    const response = await GET();
    const payload = await response.json();
    expect(payload.config).toBe(cfg);
  });

  it('returns 500 internal_error on unexpected fs failure', async () => {
    const configPath = path.join(tmpDir, 'unreadable.toml');
    await fs.writeFile(configPath, 'irrelevant');
    const GET = await loadRoute(configPath);
    const readFileSpy = vi.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('EACCES'));
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.type).toBe('internal_error');
    expect(payload).not.toHaveProperty('details');
    readFileSpy.mockRestore();
  });
});
