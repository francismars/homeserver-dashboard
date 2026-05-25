import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

describe('capabilities route', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'capabilities-test-'));
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function load(opts: { config?: string; log?: string | null }) {
    if (opts.config !== undefined) process.env.HOMESERVER_CONFIG_PATH = opts.config;
    if (opts.log === null) delete process.env.HOMESERVER_LOG_PATH;
    else if (opts.log !== undefined) process.env.HOMESERVER_LOG_PATH = opts.log;
    // `vi.resetModules()` in beforeEach gives us a fresh module (and thus a
    // fresh `cached`) on every dynamic import.
    return await import('./route');
  }

  it('returns logs:false when HOMESERVER_LOG_PATH is unset', async () => {
    const configPath = path.join(tmpDir, 'config.toml');
    await fs.writeFile(configPath, '');
    const { GET } = await load({ config: configPath, log: null });
    const payload = await (await GET()).json();
    expect(payload.logs).toBe(false);
  });

  it('returns logs:false when the log file is missing', async () => {
    const configPath = path.join(tmpDir, 'config.toml');
    await fs.writeFile(configPath, '');
    const { GET } = await load({ config: configPath, log: path.join(tmpDir, 'absent.log') });
    const payload = await (await GET()).json();
    expect(payload.logs).toBe(false);
  });

  it('returns logs:true when the log file is readable', async () => {
    const configPath = path.join(tmpDir, 'config.toml');
    const logPath = path.join(tmpDir, 'homeserver.log');
    await fs.writeFile(configPath, '');
    await fs.writeFile(logPath, '');
    const { GET } = await load({ config: configPath, log: logPath });
    const payload = await (await GET()).json();
    expect(payload.logs).toBe(true);
  });

  it('returns configWrite:true when the config file is writable', async () => {
    const configPath = path.join(tmpDir, 'config.toml');
    await fs.writeFile(configPath, '');
    const { GET } = await load({ config: configPath, log: null });
    const payload = await (await GET()).json();
    expect(payload.configWrite).toBe(true);
  });

  it('returns configWrite:false when the config file is missing', async () => {
    const { GET } = await load({ config: path.join(tmpDir, 'absent.toml'), log: null });
    const payload = await (await GET()).json();
    expect(payload.configWrite).toBe(false);
  });

  it('returns configWrite:false on a read-only config file', async () => {
    const configPath = path.join(tmpDir, 'config.toml');
    await fs.writeFile(configPath, '');
    await fs.chmod(configPath, 0o444);
    const { GET } = await load({ config: configPath, log: null });
    const payload = await (await GET()).json();
    expect(payload.configWrite).toBe(false);
  });

  it('mixed: logs:true + configWrite:false', async () => {
    const configPath = path.join(tmpDir, 'config.toml');
    const logPath = path.join(tmpDir, 'homeserver.log');
    await fs.writeFile(configPath, '');
    await fs.writeFile(logPath, '');
    await fs.chmod(configPath, 0o444);
    const { GET } = await load({ config: configPath, log: logPath });
    const payload = await (await GET()).json();
    expect(payload).toEqual({ logs: true, configWrite: false });
  });

  it('caches the probe within 5s — second call does not re-stat', async () => {
    const configPath = path.join(tmpDir, 'config.toml');
    const logPath = path.join(tmpDir, 'homeserver.log');
    await fs.writeFile(configPath, '');
    await fs.writeFile(logPath, '');
    const { GET } = await load({ config: configPath, log: logPath });
    const first = await (await GET()).json();
    expect(first).toEqual({ logs: true, configWrite: true });
    // Remove the log file but stay within TTL — cached response should still say logs:true
    await fs.rm(logPath);
    const second = await (await GET()).json();
    expect(second).toEqual({ logs: true, configWrite: true });
  });
});
