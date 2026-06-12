/**
 * Helpers for running the embedded cloudflared binary for the two flows that
 * need a child process:
 *   - "Test drive" (Quick Tunnel): cloudflared tunnel --url <origin>
 *   - "Connect Cloudflare account": cloudflared tunnel login (+ create/route)
 *
 * Design constraint: Next.js route handlers have no stable module lifetime
 * (dev-mode reloads, multiple workers), so NO process state lives in module
 * memory. Children are spawned detached with their output redirected to log
 * files; every status read reconstructs reality from disk (state JSON + log
 * parse + pid identity probe).
 */
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { closeSync, openSync, readFileSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

// Env is read lazily (call time, not module load) so tests and multi-env
// deployments are never frozen to a stale value.
export const getCloudflaredBin = () => process.env.CLOUDFLARED_BIN || '/usr/local/bin/cloudflared';
export const getConfigDir = () => process.env.CLOUDFLARE_CONFIG_DIR || '/app/cloudflare-config';
/** Where the test-drive quick tunnel forwards to. */
export const getTestdriveOrigin = () => process.env.TESTDRIVE_ORIGIN || 'http://homeserver:6286';
/** A login attempt (and an unused authorization cert) older than this is expired. */
export const CONNECT_MAX_AGE_MS = 15 * 60 * 1000;

export const TESTDRIVE_STATE = () => path.join(getConfigDir(), '.testdrive.json');
export const TESTDRIVE_LOG = () => path.join(getConfigDir(), '.testdrive.log');
/** Marker that enables preview mode: gates the cloudflared-preview compose
 * service (env_file) AND tells the config wrapper to publish the URL. */
export const PREVIEW_ENV = () => path.join(getConfigDir(), 'testdrive.env');
/** Logfile of the cloudflared-preview compose service (post-restart). */
export const PREVIEW_SERVICE_LOG = () => path.join(getConfigDir(), 'preview', 'quick.log');
export const CONNECT_STATE = () => path.join(getConfigDir(), '.connect.json');
export const CONNECT_LOG = () => path.join(getConfigDir(), '.connect.log');
export const CERT_PATH = () => path.join(getConfigDir(), 'cert.pem');
export const CREDENTIALS_PATH = () => path.join(getConfigDir(), 'credentials.json');
export const LOCAL_CONFIG_PATH = () => path.join(getConfigDir(), 'config.yml');

// The --version probe result barely changes; cache it briefly so polling GETs
// do not fork a process every few seconds. Module memory is acceptable for a
// pure cache (worst case after a reload: one extra probe).
let binaryProbe: { at: number; ok: boolean } | null = null;

export async function isBinaryAvailable(): Promise<boolean> {
  if (binaryProbe && Date.now() - binaryProbe.at < 60_000) return binaryProbe.ok;
  try {
    await execFileAsync(getCloudflaredBin(), ['--version'], { timeout: 5000 });
    binaryProbe = { at: Date.now(), ok: true };
  } catch {
    binaryProbe = { at: Date.now(), ok: false };
  }
  return binaryProbe.ok;
}

/** /proc/<pid>/stat field 22 (starttime, clock ticks since host boot). The
 * (pid, starttime) pair identifies a process uniquely for the host's uptime,
 * unlike a bare pid, which the kernel recycles. */
function readProcStarttime(pid: number): number | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf-8');
    // comm (field 2) may contain spaces; fields resume after its closing paren.
    const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const starttime = Number(rest[19]); // field 22
    return Number.isFinite(starttime) ? starttime : null;
  } catch {
    return null;
  }
}

/**
 * A pid from a state file may belong to a different process after a container
 * restart (PID namespaces restart from 1; state files on the bind mount
 * survive). Trust a pid only when it is alive AND its command is one we
 * could have spawned - otherwise a stale state file could make us SIGTERM an
 * arbitrary same-uid process, including the dashboard itself. When the state
 * file recorded the child's starttime, the live process must match it too:
 * the comm check alone cannot tell our cloudflared from a pid-reuse one.
 */
function isOurProcess(pid: number, starttime?: number): boolean {
  try {
    const comm = readFileSync(`/proc/${pid}/comm`, 'utf-8').trim();
    if (comm !== 'cloudflared' && comm !== 'timeout') return false;
  } catch {
    return false;
  }
  if (starttime !== undefined && readProcStarttime(pid) !== starttime) return false;
  return true;
}

export function isPidAlive(pid: number, starttime?: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  return isOurProcess(pid, starttime);
}

export function killPid(pid: number, starttime?: number): void {
  if (!isOurProcess(pid, starttime)) return;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

export interface SpawnedChild {
  pid: number;
  starttime?: number;
}

/**
 * Spawns a command detached with stdout+stderr appended to logPath.
 * Returns the child's pid plus its /proc starttime. The caller persists
 * both in a state file.
 */
export async function spawnDetached(
  command: string[],
  logPath: string,
  env: Record<string, string> = {},
): Promise<SpawnedChild> {
  await fs.mkdir(getConfigDir(), { recursive: true });
  await fs.writeFile(logPath, '', 'utf-8'); // fresh log per attempt
  const out = openSync(logPath, 'a');
  const err = openSync(logPath, 'a');
  const [bin, ...args] = command;
  const child = spawn(bin, args, {
    detached: true,
    stdio: ['ignore', out, err],
    env: { ...process.env, ...env },
  });
  child.unref();
  closeSync(out);
  closeSync(err);
  if (child.pid === undefined) throw new Error(`Failed to spawn ${bin}`);
  // Capture identity now, while the pid is guaranteed to still be ours.
  return { pid: child.pid, starttime: readProcStarttime(child.pid) ?? undefined };
}

/** One-shot cloudflared invocation (create / route dns / delete). Async so a
 * slow Cloudflare cannot block the event loop for every dashboard user. */
export async function runCloudflared(
  args: string[],
  env: Record<string, string> = {},
  timeoutMs = 30_000,
): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(getCloudflaredBin(), args, {
      timeout: timeoutMs,
      env: { ...process.env, ...env },
      encoding: 'utf-8',
    });
    return { ok: true, output: `${stdout}\n${stderr}`.trim() };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, output: `${err.stdout ?? ''}\n${err.stderr ?? ''}\n${err.message ?? ''}`.trim() };
  }
}

/**
 * Live de-risk finding (2026-06-12): the assigned URL prints to stderr ~9s in.
 * cloudflared's FAILURE output also contains a trycloudflare host
 * (api.trycloudflare.com, the request endpoint), so the parse must take the
 * first match that is NOT the API host.
 */
const QUICK_TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/g;
/** Live de-risk finding: login URL prints to stderr immediately. */
const LOGIN_URL_PATTERN = /https:\/\/dash\.cloudflare\.com\/argotunnel\?[^\s]+/;
const QUICK_TUNNEL_FAILURE_PATTERN = /failed to request quick Tunnel|ERR /;

export async function parseQuickTunnelUrl(): Promise<string | null> {
  try {
    const log = await fs.readFile(TESTDRIVE_LOG(), 'utf-8');
    for (const match of log.match(QUICK_TUNNEL_URL_PATTERN) ?? []) {
      if (!match.startsWith('https://api.')) return match;
    }
    return null;
  } catch {
    return null;
  }
}

/** Latest URL the post-restart preview service obtained (appending logfile,
 * api.trycloudflare.com noise excluded). */
export async function parsePreviewPublishedUrl(): Promise<string | null> {
  try {
    const log = await fs.readFile(PREVIEW_SERVICE_LOG(), 'utf-8');
    const matches = (log.match(QUICK_TUNNEL_URL_PATTERN) ?? []).filter((m) => !m.startsWith('https://api.'));
    return matches[matches.length - 1] ?? null;
  } catch {
    return null;
  }
}

/** The tunnel is usable only after a connection registers with the edge
 * (live finding: the URL prints ~5s before registration; clicking in that
 * window hits a Cloudflare 530). */
export async function quickTunnelConnected(): Promise<boolean> {
  try {
    const log = await fs.readFile(TESTDRIVE_LOG(), 'utf-8');
    return /Registered tunnel connection/.test(log);
  } catch {
    return false;
  }
}

/** Whether the test-drive log shows the quick-tunnel request failing. */
export async function quickTunnelFailed(): Promise<boolean> {
  try {
    const log = await fs.readFile(TESTDRIVE_LOG(), 'utf-8');
    return QUICK_TUNNEL_FAILURE_PATTERN.test(log) && !(await parseQuickTunnelUrl());
  } catch {
    return false;
  }
}

/**
 * `cloudflared tunnel login` SAVES the cert to $HOME/.cloudflared/cert.pem
 * regardless of TUNNEL_ORIGIN_CERT (live finding, 2026-06-12: the env var
 * only controls where other commands READ it). The login child is therefore
 * spawned with HOME pointed at the config dir; this helper relocates the
 * delivered cert to CERT_PATH and removes the scratch directory.
 */
export async function relocateDeliveredCert(): Promise<void> {
  const delivered = path.join(getConfigDir(), '.cloudflared', 'cert.pem');
  try {
    await fs.access(delivered);
  } catch {
    return;
  }
  try {
    await fs.rename(delivered, CERT_PATH());
  } catch (e) {
    // Two concurrent polls can both pass the access check; the loser's
    // rename finds the file already moved.
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw e;
  }
  await fs.chmod(CERT_PATH(), 0o600);
  await fs.rm(path.join(getConfigDir(), '.cloudflared'), { recursive: true, force: true });
}

export async function parseLoginUrl(): Promise<string | null> {
  try {
    const log = await fs.readFile(CONNECT_LOG(), 'utf-8');
    return log.match(LOGIN_URL_PATTERN)?.[0] ?? null;
  } catch {
    return null;
  }
}

export interface ProcessState {
  pid: number;
  started_at: string; // ISO
  /** /proc starttime of the spawned child (see readProcStarttime); absent in
   * state files written before this field existed. */
  starttime?: number;
}

export async function readState(file: string): Promise<ProcessState | null> {
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf-8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ProcessState;
    if (typeof parsed.pid !== 'number' || typeof parsed.started_at !== 'string') throw new Error('malformed state');
    return parsed;
  } catch {
    // A half-written file reads as absent but still exists on disk; reap it
    // so it cannot block anything and the flow can start fresh.
    await fs.rm(file, { force: true });
    return null;
  }
}

/** Atomic write (tmp + rename) so a racing read never parses a torn file. */
export async function writeState(file: string, state: ProcessState): Promise<void> {
  await fs.mkdir(getConfigDir(), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state), 'utf-8');
  await fs.rename(tmp, file);
}

export async function clearState(file: string): Promise<void> {
  try {
    await fs.rm(file);
  } catch {
    // best effort
  }
}

/** Thrown when a flow lock is held by a live, in-age holder. Routes map it
 * to their 409 "already in progress" responses. */
export class AlreadyRunningError extends Error {
  constructor(name: string) {
    super(`The "${name}" flow is already running`);
    this.name = 'AlreadyRunningError';
  }
}

/** Lock shared by every flow that writes setup artifacts (connect complete,
 * auto-setup, preview enable). Interleaving two of them can point DNS at one
 * tunnel while the saved token runs another, or let preview shadow a real
 * domain whose setup completed mid-enable. */
export const SETUP_FLOW_LOCK = 'setup';
/** Worst case is connect complete: two 30s tunnel-create attempts plus route
 * dns. Anything older is a crashed holder and its lock gets stolen. */
export const SETUP_FLOW_LOCK_MAX_AGE_MS = 3 * 60_000;
export const CONNECT_START_FLOW_LOCK = 'connect-start';
/** Connect start worst case: spawn plus 10s of login-URL polling. */
export const CONNECT_START_FLOW_LOCK_MAX_AGE_MS = 60_000;

const flowLockPath = (name: string) => path.join(getConfigDir(), `.flow-${name}.lock`);

/** Liveness only - flow locks are held by dashboard workers, not cloudflared
 * children, so the comm check in isOurProcess does not apply. */
function isLockHolderAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns false when the lock file cannot be created at all (unwritable
 * config dir): the flow then runs unlocked and surfaces the real filesystem
 * error itself, which beats a misleading "already in progress". A crashed
 * holder must not wedge the flow forever: an existing lock is stolen when it
 * is unparseable, its pid is dead, or it is older than maxAgeMs (the flow's
 * worst-case runtime). Otherwise throws AlreadyRunningError.
 */
async function acquireFlowLock(file: string, maxAgeMs: number, name: string): Promise<boolean> {
  try {
    await fs.mkdir(getConfigDir(), { recursive: true });
  } catch {
    return false;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.open(file, 'wx');
      try {
        await handle.writeFile(JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }), 'utf-8');
      } finally {
        await handle.close();
      }
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') return false;
      let stale = false;
      try {
        const holder = JSON.parse(await fs.readFile(file, 'utf-8')) as { pid?: number; started_at?: string };
        const age = Date.now() - Date.parse(holder.started_at ?? '');
        stale = typeof holder.pid !== 'number' || !isLockHolderAlive(holder.pid) || !(age < maxAgeMs);
      } catch {
        stale = true; // empty or corrupt lock protects nothing
      }
      if (!stale || attempt > 0) throw new AlreadyRunningError(name);
      await fs.rm(file, { force: true }); // steal, then one retry
    }
  }
  throw new AlreadyRunningError(name);
}

/**
 * Runs fn under an on-disk exclusive lock (O_EXCL create; no module memory,
 * same constraint as the state files). Throws AlreadyRunningError when a
 * live, in-age holder exists; always releases the lock when fn settles.
 */
export async function withFlowLock<T>(name: string, maxAgeMs: number, fn: () => Promise<T>): Promise<T> {
  const file = flowLockPath(name);
  const acquired = await acquireFlowLock(file, maxAgeMs, name);
  try {
    return await fn();
  } finally {
    if (acquired) await fs.rm(file, { force: true });
  }
}

/** Removes every flow lock (disconnect; the entrypoint does the same at
 * boot). Includes the legacy completion-lock name so an upgrade over a
 * crashed flow cannot stay wedged. */
export async function clearAllFlowLocks(): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(getConfigDir());
  } catch {
    return;
  }
  const locks = entries.filter(
    (f) => (f.startsWith('.flow-') && f.endsWith('.lock')) || f === '.connect-complete.lock',
  );
  await Promise.all(locks.map((f) => fs.rm(path.join(getConfigDir(), f), { force: true })));
}
