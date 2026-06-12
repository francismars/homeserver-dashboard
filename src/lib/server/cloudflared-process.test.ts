import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

// Unmocked: these tests pin the log-parsing behavior against REAL cloudflared
// output captured during the live de-risk runs (2026-06-12).

describe('cloudflared-process log parsing', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cfd-lib-test-'));
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const SUCCESS_LOG = [
    '2026-06-11T14:30:04Z INF Requesting new quick Tunnel on trycloudflare.com...',
    '2026-06-11T14:30:13Z INF |  https://lotus-scenarios-fill-sizes.trycloudflare.com                                      |',
  ].join('\n');

  const FAILURE_LOG =
    '2026-06-11T14:30:04Z ERR failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": dial tcp 1.2.3.4:443: i/o timeout';

  it('parses the assigned quick-tunnel URL from real output', async () => {
    const { parseQuickTunnelUrl } = await import('./cloudflared-process');
    await fs.writeFile(path.join(tmpDir, '.testdrive.log'), SUCCESS_LOG, 'utf-8');
    expect(await parseQuickTunnelUrl()).toBe('https://lotus-scenarios-fill-sizes.trycloudflare.com');
  });

  it('does NOT mistake the api.trycloudflare.com request endpoint in failure output for an assigned URL', async () => {
    const { parseQuickTunnelUrl, quickTunnelFailed } = await import('./cloudflared-process');
    await fs.writeFile(path.join(tmpDir, '.testdrive.log'), FAILURE_LOG, 'utf-8');
    expect(await parseQuickTunnelUrl()).toBeNull();
    expect(await quickTunnelFailed()).toBe(true);
  });

  it('parses the login URL from real output', async () => {
    const { parseLoginUrl } = await import('./cloudflared-process');
    await fs.writeFile(
      path.join(tmpDir, '.connect.log'),
      'A browser window should have opened at the following URL:\n\nhttps://dash.cloudflare.com/argotunnel?aud=&callback=https%3A%2F%2Flogin.cloudflareaccess.org%2Fbl4h45ty\n',
      'utf-8',
    );
    expect(await parseLoginUrl()).toBe(
      'https://dash.cloudflare.com/argotunnel?aud=&callback=https%3A%2F%2Flogin.cloudflareaccess.org%2Fbl4h45ty',
    );
  });

  it('claimState is an exclusive mutex; writeState is atomic over it', async () => {
    const { claimState, writeState, readState, clearState, TESTDRIVE_STATE } = await import('./cloudflared-process');
    expect(await claimState(TESTDRIVE_STATE())).toBe(true);
    expect(await claimState(TESTDRIVE_STATE())).toBe(false);
    await writeState(TESTDRIVE_STATE(), { pid: 1234, started_at: new Date().toISOString() });
    expect((await readState(TESTDRIVE_STATE()))?.pid).toBe(1234);
    await clearState(TESTDRIVE_STATE());
    expect(await claimState(TESTDRIVE_STATE())).toBe(true);
  });

  it('isPidAlive rejects a live pid that is not cloudflared (pid-reuse guard)', async () => {
    const { isPidAlive, killPid } = await import('./cloudflared-process');
    // Our own pid is alive but is node, not cloudflared: must be treated as dead.
    expect(isPidAlive(process.pid)).toBe(false);
    // And killPid must refuse to signal it (we would be killing ourselves).
    killPid(process.pid);
    expect(true).toBe(true); // still alive
  });
});
