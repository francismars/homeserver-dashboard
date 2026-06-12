// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__');

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

  it('parsePreviewPublishedUrl prefers the wrapper handshake file over the append-only log', async () => {
    const { parsePreviewPublishedUrl } = await import('./cloudflared-process');
    await fs.mkdir(path.join(tmpDir, 'preview'), { recursive: true });
    // The log still carries a previous boot's URL as its last match.
    await fs.writeFile(
      path.join(tmpDir, 'preview', 'quick.log'),
      'INF |  https://previous-boot.trycloudflare.com |\n',
      'utf-8',
    );
    await fs.writeFile(path.join(tmpDir, 'preview', 'published'), 'https://current.trycloudflare.com\n', 'utf-8');
    expect(await parsePreviewPublishedUrl()).toBe('https://current.trycloudflare.com');
  });

  it('parsePreviewPublishedUrl returns null while the handshake file exists but is empty', async () => {
    const { parsePreviewPublishedUrl } = await import('./cloudflared-process');
    await fs.mkdir(path.join(tmpDir, 'preview'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'preview', 'quick.log'),
      'INF |  https://previous-boot.trycloudflare.com |\n',
      'utf-8',
    );
    await fs.writeFile(path.join(tmpDir, 'preview', 'published'), '', 'utf-8');
    expect(await parsePreviewPublishedUrl()).toBeNull();
  });

  it('parsePreviewPublishedUrl falls back to the last non-api log match when the handshake is absent', async () => {
    const { parsePreviewPublishedUrl } = await import('./cloudflared-process');
    await fs.mkdir(path.join(tmpDir, 'preview'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'preview', 'quick.log'),
      [
        'INF Requesting https://api.trycloudflare.com/tunnel',
        'INF |  https://older.trycloudflare.com |',
        'INF |  https://newest.trycloudflare.com |',
      ].join('\n'),
      'utf-8',
    );
    expect(await parsePreviewPublishedUrl()).toBe('https://newest.trycloudflare.com');
  });

  it('atomicWrite replaces the target without a torn intermediate and applies the mode', async () => {
    const { atomicWrite } = await import('./cloudflared-process');
    const file = path.join(tmpDir, 'token');
    await atomicWrite(file, 'first');
    expect(await fs.readFile(file, 'utf-8')).toBe('first');
    await atomicWrite(file, 'second', 0o644);
    expect(await fs.readFile(file, 'utf-8')).toBe('second');
    expect((await fs.stat(file)).mode & 0o777).toBe(0o644);
    // The tmp file must not survive the rename.
    await expect(fs.access(`${file}.tmp`)).rejects.toThrow();
  });

  it('writeState round-trips atomically; clearState removes the file', async () => {
    const { writeState, readState, clearState, PREVIEW_INSTANT_STATE } = await import('./cloudflared-process');
    await writeState(PREVIEW_INSTANT_STATE(), { pid: 1234, started_at: new Date().toISOString() });
    expect((await readState(PREVIEW_INSTANT_STATE()))?.pid).toBe(1234);
    await clearState(PREVIEW_INSTANT_STATE());
    expect(await readState(PREVIEW_INSTANT_STATE())).toBeNull();
  });

  it('readState reaps an unparseable state file instead of leaving it half-present', async () => {
    const { readState, PREVIEW_INSTANT_STATE } = await import('./cloudflared-process');
    await fs.writeFile(PREVIEW_INSTANT_STATE(), '', 'utf-8');
    expect(await readState(PREVIEW_INSTANT_STATE())).toBeNull();
    await expect(fs.access(PREVIEW_INSTANT_STATE())).rejects.toThrow();
    await fs.writeFile(PREVIEW_INSTANT_STATE(), '{"pid":"not-a-number"}', 'utf-8');
    expect(await readState(PREVIEW_INSTANT_STATE())).toBeNull();
    await expect(fs.access(PREVIEW_INSTANT_STATE())).rejects.toThrow();
  });

  it('isPidAlive rejects a live pid that is not cloudflared (pid-reuse guard)', async () => {
    const { isPidAlive, killPid } = await import('./cloudflared-process');
    // Our own pid is alive but is node, not cloudflared: must be treated as dead.
    expect(isPidAlive(process.pid)).toBe(false);
    // And killPid must refuse to signal it (we would be killing ourselves);
    // it reports "gone" because the tracked child no longer owns the pid.
    expect(await killPid(process.pid)).toBe(true);
  });

  /** Spawns `timeout 30 sleep 30` (comm "timeout" is in the allowance, so a
   * real child stands in for cloudflared) and waits for the execve so
   * /proc/<pid>/comm reads "timeout". */
  async function spawnStandIn() {
    const { spawnDetached } = await import('./cloudflared-process');
    const child = await spawnDetached(['timeout', '30', 'sleep', '30'], path.join(tmpDir, 'child.log'));
    for (let i = 0; i < 50; i++) {
      try {
        if (readFileSync(`/proc/${child.pid}/comm`, 'utf-8').trim() === 'timeout') break;
      } catch {
        // not yet
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    return child;
  }

  it('isPidAlive rejects a matching-comm pid whose starttime does not match (pid-reuse guard)', async () => {
    const { isPidAlive, killPid } = await import('./cloudflared-process');
    const child = await spawnStandIn();
    try {
      expect(typeof child.starttime).toBe('number');
      expect(isPidAlive(child.pid, child.starttime)).toBe(true);
      expect(isPidAlive(child.pid, (child.starttime ?? 0) + 12345)).toBe(false);
      // killPid must refuse the mismatched identity too (reported gone, child untouched)...
      expect(await killPid(child.pid, (child.starttime ?? 0) + 12345)).toBe(true);
      expect(isPidAlive(child.pid, child.starttime)).toBe(true);
      // ...and honor the matching one: SIGTERM lands and the exit is confirmed.
      expect(await killPid(child.pid, child.starttime)).toBe(true);
      expect(isPidAlive(child.pid, child.starttime)).toBe(false);
    } finally {
      try {
        process.kill(child.pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
  });

  /** Wraps process.kill so signals to the child can be swallowed, simulating
   * a stuck cloudflared. Liveness probes (signal 0) report ESRCH once the
   * fake considers the child dead. */
  function stubKill(childPid: number, opts: { termWorks: boolean; killWorks: boolean }) {
    const realKill = process.kill.bind(process);
    let dead = false;
    const spy = vi.spyOn(process, 'kill').mockImplementation(((pid: number, sig?: string | number) => {
      if (pid !== childPid) return realKill(pid, sig as NodeJS.Signals);
      if (sig === 'SIGTERM') {
        if (opts.termWorks) dead = true;
        return true;
      }
      if (sig === 'SIGKILL') {
        if (opts.killWorks) dead = true;
        return true;
      }
      if (dead) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      return realKill(pid, sig as NodeJS.Signals);
    }) as typeof process.kill);
    return { spy, realKill };
  }

  it('killPid escalates to SIGKILL when SIGTERM is ignored and confirms the exit', async () => {
    const { killPid } = await import('./cloudflared-process');
    const child = await spawnStandIn();
    const { spy, realKill } = stubKill(child.pid, { termWorks: false, killWorks: true });
    vi.useFakeTimers();
    try {
      const pending = killPid(child.pid, child.starttime);
      await vi.advanceTimersByTimeAsync(4000);
      expect(await pending).toBe(true);
      expect(spy).toHaveBeenCalledWith(child.pid, 'SIGTERM');
      expect(spy).toHaveBeenCalledWith(child.pid, 'SIGKILL');
    } finally {
      vi.useRealTimers();
      spy.mockRestore();
      try {
        realKill(child.pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
  });

  it('killPid returns false when the process survives even SIGKILL', async () => {
    const { killPid } = await import('./cloudflared-process');
    const child = await spawnStandIn();
    const { spy, realKill } = stubKill(child.pid, { termWorks: false, killWorks: false });
    vi.useFakeTimers();
    try {
      const pending = killPid(child.pid, child.starttime);
      await vi.advanceTimersByTimeAsync(6000);
      expect(await pending).toBe(false);
    } finally {
      vi.useRealTimers();
      spy.mockRestore();
      try {
        realKill(child.pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
  });
});

describe('parseAuthorizedDomain', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;
  const certPath = () => path.join(tmpDir, 'cert.pem');

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cfd-cert-test-'));
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('extracts the zone apex from a multi-block PEM (key + cert + token block)', async () => {
    const { parseAuthorizedDomain } = await import('./cloudflared-process');
    // Fixture mirrors the cloudflared cert.pem layout: PRIVATE KEY first,
    // then the CERTIFICATE (SAN: example.com, *.example.com), then an
    // ARGO TUNNEL TOKEN block.
    await fs.copyFile(path.join(FIXTURES, 'origincert-example.pem'), certPath());
    expect(await parseAuthorizedDomain()).toBe('example.com');
  });

  it('strips the wildcard label from a wildcard-only SAN', async () => {
    const { parseAuthorizedDomain } = await import('./cloudflared-process');
    await fs.copyFile(path.join(FIXTURES, 'cert-wildcard-only.pem'), certPath());
    expect(await parseAuthorizedDomain()).toBe('wild.example.net');
  });

  it('returns null for garbage content, a non-certificate PEM block, and a missing file', async () => {
    const { parseAuthorizedDomain } = await import('./cloudflared-process');
    expect(await parseAuthorizedDomain()).toBeNull(); // missing
    await fs.writeFile(certPath(), 'not a pem at all', 'utf-8');
    expect(await parseAuthorizedDomain()).toBeNull();
    await fs.writeFile(
      certPath(),
      '-----BEGIN CERTIFICATE-----\nbm90IGEgY2VydA==\n-----END CERTIFICATE-----\n',
      'utf-8',
    );
    expect(await parseAuthorizedDomain()).toBeNull();
    // PEM with blocks but no CERTIFICATE block at all
    const multiblock = await fs.readFile(path.join(FIXTURES, 'origincert-example.pem'), 'utf-8');
    const withoutCert = multiblock.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/, '');
    await fs.writeFile(certPath(), withoutCert, 'utf-8');
    expect(await parseAuthorizedDomain()).toBeNull();
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

  it('lets only one of many concurrent callers steal the same stale lock', async () => {
    const { withFlowLock, AlreadyRunningError } = await import('./cloudflared-process');
    const staleHolder = () =>
      JSON.stringify({ pid: 999999999, started_at: new Date(Date.now() - 61_000).toISOString() });
    // Many trials: the old blind-rm steal double-acquired a few per thousand.
    for (let trial = 0; trial < 200; trial += 1) {
      await fs.writeFile(lockPath(), staleHolder());
      let running = 0;
      let peak = 0;
      const run = () =>
        withFlowLock('test', 60_000, async () => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((r) => setTimeout(r, 1));
          running -= 1;
          return 'ran';
        });
      const results = await Promise.allSettled([run(), run(), run(), run()]);
      const ran = results.filter((r) => r.status === 'fulfilled').length;
      const backedOff = results.filter(
        (r) => r.status === 'rejected' && r.reason instanceof AlreadyRunningError,
      ).length;
      expect(peak).toBe(1); // never two critical sections at once
      expect(ran).toBe(1);
      expect(ran + backedOff).toBe(4);
      await fs.rm(lockPath(), { force: true });
    }
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
