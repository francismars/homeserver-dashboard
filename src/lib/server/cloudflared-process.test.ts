import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { readFileSync } from 'fs';

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

  it('writeState round-trips atomically; clearState removes the file', async () => {
    const { writeState, readState, clearState, TESTDRIVE_STATE } = await import('./cloudflared-process');
    await writeState(TESTDRIVE_STATE(), { pid: 1234, started_at: new Date().toISOString() });
    expect((await readState(TESTDRIVE_STATE()))?.pid).toBe(1234);
    await clearState(TESTDRIVE_STATE());
    expect(await readState(TESTDRIVE_STATE())).toBeNull();
  });

  it('readState reaps an unparseable state file instead of leaving it half-present', async () => {
    const { readState, TESTDRIVE_STATE } = await import('./cloudflared-process');
    await fs.writeFile(TESTDRIVE_STATE(), '', 'utf-8');
    expect(await readState(TESTDRIVE_STATE())).toBeNull();
    await expect(fs.access(TESTDRIVE_STATE())).rejects.toThrow();
    await fs.writeFile(TESTDRIVE_STATE(), '{"pid":"not-a-number"}', 'utf-8');
    expect(await readState(TESTDRIVE_STATE())).toBeNull();
    await expect(fs.access(TESTDRIVE_STATE())).rejects.toThrow();
  });

  it('isPidAlive rejects a live pid that is not cloudflared (pid-reuse guard)', async () => {
    const { isPidAlive, killPid } = await import('./cloudflared-process');
    // Our own pid is alive but is node, not cloudflared: must be treated as dead.
    expect(isPidAlive(process.pid)).toBe(false);
    // And killPid must refuse to signal it (we would be killing ourselves).
    killPid(process.pid);
    expect(true).toBe(true); // still alive
  });

  it('isPidAlive rejects a matching-comm pid whose starttime does not match (pid-reuse guard)', async () => {
    const { isPidAlive, killPid, spawnDetached } = await import('./cloudflared-process');
    // `timeout` is in the comm allowance, so a real child stands in for a
    // wrapped cloudflared without needing the binary.
    const child = await spawnDetached(['timeout', '30', 'sleep', '30'], path.join(tmpDir, 'child.log'));
    try {
      expect(typeof child.starttime).toBe('number');
      // Wait for the execve so /proc/<pid>/comm reads "timeout".
      for (let i = 0; i < 50; i++) {
        try {
          if (readFileSync(`/proc/${child.pid}/comm`, 'utf-8').trim() === 'timeout') break;
        } catch {
          // not yet
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(isPidAlive(child.pid, child.starttime)).toBe(true);
      expect(isPidAlive(child.pid, (child.starttime ?? 0) + 12345)).toBe(false);
      // killPid must refuse the mismatched identity too...
      killPid(child.pid, (child.starttime ?? 0) + 12345);
      expect(isPidAlive(child.pid, child.starttime)).toBe(true);
      // ...and honor the matching one.
      killPid(child.pid, child.starttime);
    } finally {
      try {
        process.kill(child.pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
  });
});

describe('withFlowLock', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;
  const lockPath = () => path.join(tmpDir, '.flow-test.lock');

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cfd-lock-test-'));
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('acquires a fresh lock, runs fn, and releases it', async () => {
    const { withFlowLock } = await import('./cloudflared-process');
    const result = await withFlowLock('test', 60_000, async () => {
      const holder = JSON.parse(await fs.readFile(lockPath(), 'utf-8'));
      expect(holder.pid).toBe(process.pid);
      return 'ok';
    });
    expect(result).toBe('ok');
    await expect(fs.access(lockPath())).rejects.toThrow();
  });

  it('throws AlreadyRunningError while a live in-age holder exists', async () => {
    const { withFlowLock, AlreadyRunningError } = await import('./cloudflared-process');
    await fs.writeFile(lockPath(), JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
    await expect(withFlowLock('test', 60_000, async () => 'never')).rejects.toBeInstanceOf(AlreadyRunningError);
    // The held lock must not have been stolen.
    await expect(fs.access(lockPath())).resolves.toBeUndefined();
  });

  it('steals a lock whose holder pid is dead', async () => {
    const { withFlowLock } = await import('./cloudflared-process');
    await fs.writeFile(lockPath(), JSON.stringify({ pid: 999999999, started_at: new Date().toISOString() }));
    expect(await withFlowLock('test', 60_000, async () => 'ran')).toBe('ran');
  });

  it('steals a lock older than maxAgeMs even when its holder is alive', async () => {
    const { withFlowLock } = await import('./cloudflared-process');
    const old = new Date(Date.now() - 61_000).toISOString();
    await fs.writeFile(lockPath(), JSON.stringify({ pid: process.pid, started_at: old }));
    expect(await withFlowLock('test', 60_000, async () => 'ran')).toBe('ran');
  });

  it('steals an empty or corrupt lock file', async () => {
    const { withFlowLock } = await import('./cloudflared-process');
    await fs.writeFile(lockPath(), '', 'utf-8');
    expect(await withFlowLock('test', 60_000, async () => 'ran')).toBe('ran');
    await fs.writeFile(lockPath(), 'not json', 'utf-8');
    expect(await withFlowLock('test', 60_000, async () => 'ran again')).toBe('ran again');
  });

  it('releases the lock when fn throws', async () => {
    const { withFlowLock } = await import('./cloudflared-process');
    await expect(
      withFlowLock('test', 60_000, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(fs.access(lockPath())).rejects.toThrow();
    expect(await withFlowLock('test', 60_000, async () => 'recovered')).toBe('recovered');
  });

  it('serializes concurrent callers: the loser gets AlreadyRunningError', async () => {
    const { withFlowLock, AlreadyRunningError } = await import('./cloudflared-process');
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const winner = withFlowLock('test', 60_000, async () => {
      await gate;
      return 'winner';
    });
    // Give the winner a tick to take the lock.
    await new Promise((r) => setTimeout(r, 50));
    await expect(withFlowLock('test', 60_000, async () => 'loser')).rejects.toBeInstanceOf(AlreadyRunningError);
    release();
    expect(await winner).toBe('winner');
  });

  it('clearAllFlowLocks removes flow locks (and the legacy name) but nothing else', async () => {
    const { clearAllFlowLocks } = await import('./cloudflared-process');
    await fs.writeFile(path.join(tmpDir, '.flow-setup.lock'), '{}', 'utf-8');
    await fs.writeFile(path.join(tmpDir, '.flow-connect-start.lock'), '{}', 'utf-8');
    await fs.writeFile(path.join(tmpDir, '.connect-complete.lock'), '', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'token'), 'keep-me', 'utf-8');
    await clearAllFlowLocks();
    await expect(fs.access(path.join(tmpDir, '.flow-setup.lock'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, '.flow-connect-start.lock'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, '.connect-complete.lock'))).rejects.toThrow();
    expect(await fs.readFile(path.join(tmpDir, 'token'), 'utf-8')).toBe('keep-me');
  });
});
