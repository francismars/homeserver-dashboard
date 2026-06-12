/**
 * Helpers for running the embedded cloudflared binary for the two flows that
 * need a child process:
 *   - Preview mode's instant tunnel (Quick Tunnel): cloudflared tunnel --url <origin>
 *   - "Connect Cloudflare account": cloudflared tunnel login (+ create/route)
 *
 * Design constraint: Next.js route handlers have no stable module lifetime
 * (dev-mode reloads, multiple workers), so NO process state lives in module
 * memory. Children are spawned detached with their output redirected to log
 * files; every status read reconstructs reality from disk (state JSON + log
 * parse + pid identity probe).
 */
import { execFile, spawn } from 'child_process';
import { X509Certificate, randomUUID } from 'crypto';
import { promisify } from 'util';
import { closeSync, openSync, readFileSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

// Env is read lazily (call time, not module load) so tests and multi-env
// deployments are never frozen to a stale value.
export const getCloudflaredBin = () => process.env.CLOUDFLARED_BIN || '/usr/local/bin/cloudflared';
export const getConfigDir = () => process.env.CLOUDFLARE_CONFIG_DIR || '/app/cloudflare-config';
/** The fixed tunnel name the app owns. Re-runs adopt it (idempotency). */
export const TUNNEL_NAME = 'pubky-homeserver';
/** Where the tunnel forwards traffic inside the Umbrel network. */
export const INGRESS_SERVICE = 'http://homeserver:6286';
/** Where preview mode's instant quick tunnel forwards to. */
export const getPreviewInstantOrigin = () => process.env.PREVIEW_INSTANT_ORIGIN || 'http://homeserver:6286';
/** A login attempt (and an unused authorization cert) older than this is expired. */
export const CONNECT_MAX_AGE_MS = 15 * 60 * 1000;

// The .testdrive.* on-disk names predate the feature's rename to "Preview
// mode" and are kept for upgrade compatibility (they live on the bind mount).
export const PREVIEW_INSTANT_STATE = () => path.join(getConfigDir(), '.testdrive.json');
export const PREVIEW_INSTANT_LOG = () => path.join(getConfigDir(), '.testdrive.log');
/** Marker that enables preview mode: gates the cloudflared-preview compose
 * service (env_file) AND tells the config wrapper to publish the URL. The
 * on-disk name is testdrive.env because the shipped wrapper and compose
 * reference it; it MUST NOT change. */
export const PREVIEW_ENV = () => path.join(getConfigDir(), 'testdrive.env');
/** Logfile of the cloudflared-preview compose service (post-restart). */
export const PREVIEW_SERVICE_LOG = () => path.join(getConfigDir(), 'preview', 'quick.log');
/** Handshake written by the config wrapper: the preview URL it actually
 * published into the homeserver config (removed when preview is off). */
export const PREVIEW_PUBLISHED = () => path.join(getConfigDir(), 'preview', 'published');
export const CONNECT_STATE = () => path.join(getConfigDir(), '.connect.json');
export const CONNECT_LOG = () => path.join(getConfigDir(), '.connect.log');
export const CERT_PATH = () => path.join(getConfigDir(), 'cert.pem');
/** Where the login child (HOME redirected to the config dir) drops the cert
 * before relocateDeliveredCert moves it to CERT_PATH. Cancel/disconnect must
 * remove it too, or a cert delivered between polls resurrects a cancelled
 * authorization on the next status read. */
export const CONNECT_SCRATCH_DIR = () => path.join(getConfigDir(), '.cloudflared');
export const CREDENTIALS_PATH = () => path.join(getConfigDir(), 'credentials.json');
export const LOCAL_CONFIG_PATH = () => path.join(getConfigDir(), 'config.yml');
export const DOMAIN_PATH = () => path.join(getConfigDir(), 'domain');
export const TOKEN_PATH = () => path.join(getConfigDir(), 'token');

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const KILL_POLL_INTERVAL_MS = 80;
const SIGTERM_GRACE_MS = 2000;
const SIGKILL_CONFIRM_MS = 1000;

/**
 * SIGTERM, poll ~2s for exit, escalate to SIGKILL, confirm. Returns whether
 * the process is gone, so callers can report honestly instead of assuming a
 * fire-and-forget signal worked while a stuck child keeps serving traffic.
 */
export async function killPid(pid: number, starttime?: number): Promise<boolean> {
  if (!isOurProcess(pid, starttime)) return true;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return true;
  }
  for (let waited = 0; waited < SIGTERM_GRACE_MS; waited += KILL_POLL_INTERVAL_MS) {
    await sleep(KILL_POLL_INTERVAL_MS);
    if (!isPidAlive(pid, starttime)) return true;
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    return true;
  }
  for (let waited = 0; waited < SIGKILL_CONFIRM_MS; waited += KILL_POLL_INTERVAL_MS) {
    await sleep(KILL_POLL_INTERVAL_MS);
    if (!isPidAlive(pid, starttime)) return true;
  }
  return false;
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
    const log = await fs.readFile(PREVIEW_INSTANT_LOG(), 'utf-8');
    for (const match of log.match(QUICK_TUNNEL_URL_PATTERN) ?? []) {
      if (!match.startsWith('https://api.')) return match;
    }
    return null;
  } catch {
    return null;
  }
}

/** URL the post-restart preview service actually published. The wrapper
 * handshake file is authoritative when present (the quick.log is append-only
 * across boots, so its last match can be a previous boot's dead URL); the
 * log parse is only a fallback for wrappers that predate the handshake. */
export async function parsePreviewPublishedUrl(): Promise<string | null> {
  let handshakeAbsent = false;
  try {
    const published = (await fs.readFile(PREVIEW_PUBLISHED(), 'utf-8')).trim();
    if (published) return published;
  } catch {
    handshakeAbsent = true;
  }
  if (!handshakeAbsent) return null; // file exists but is empty: nothing published yet
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
    const log = await fs.readFile(PREVIEW_INSTANT_LOG(), 'utf-8');
    return /Registered tunnel connection/.test(log);
  } catch {
    return false;
  }
}

/** Whether the test-drive log shows the quick-tunnel request failing. */
export async function quickTunnelFailed(): Promise<boolean> {
  try {
    const log = await fs.readFile(PREVIEW_INSTANT_LOG(), 'utf-8');
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
  const delivered = path.join(CONNECT_SCRATCH_DIR(), 'cert.pem');
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
  await fs.rm(CONNECT_SCRATCH_DIR(), { recursive: true, force: true });
}

const PEM_CERT_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/;
const DOMAIN_SHAPE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * The zone the login cert authorizes, read from the SAN DNS entries of its
 * CERTIFICATE block (the cert.pem cloudflared delivers also carries a private
 * key and an Argo token block). Wildcard labels are stripped; with several
 * entries (zone + *.zone) the shortest survivor is the apex. Returns null on
 * ANY problem: a live cert's layout has not been validated against this
 * parser yet, so the full-hostname flow must keep working when it fails.
 */
export async function parseAuthorizedDomain(): Promise<string | null> {
  try {
    const pem = await fs.readFile(CERT_PATH(), 'utf-8');
    const block = pem.match(PEM_CERT_BLOCK)?.[0];
    if (!block) return null;
    const san = new X509Certificate(block).subjectAltName ?? '';
    const domains = san
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith('DNS:'))
      .map((entry) => entry.slice('DNS:'.length).replace(/^\*\./, '').toLowerCase())
      .filter((domain) => DOMAIN_SHAPE.test(domain));
    if (domains.length === 0) return null;
    return domains.reduce((apex, candidate) => (candidate.length < apex.length ? candidate : apex));
  } catch {
    return null;
  }
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

/**
 * Atomic write (tmp in the same dir + rename) so a racing read never sees a
 * torn file. Mandatory for token/domain/config.yml: the crash-looping
 * cloudflared containers and the init wrapper poll them from another
 * container, so a plain writeFile can hand them half a token.
 */
export async function atomicWrite(filePath: string, contents: string, mode?: number): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, contents, 'utf-8');
  // chmod the tmp file so the mode is in place before the rename publishes it
  // (writeFile's own mode argument is umask-clipped).
  if (mode !== undefined) await fs.chmod(tmp, mode);
  await fs.rename(tmp, filePath);
}

export async function writeState(file: string, state: ProcessState): Promise<void> {
  await fs.mkdir(getConfigDir(), { recursive: true });
  await atomicWrite(file, JSON.stringify(state));
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
      // Steal atomically: renaming the stale lock to a unique name is the one
      // point where exactly one racer can win. A blind rm here would let a
      // second racer delete the fresh lock a first racer just created, so both
      // would proceed. Losing the rename (ENOENT) means another racer already
      // stole or replaced it, so we back off rather than retry.
      try {
        const stolen = `${file}.stale-${randomUUID()}`;
        await fs.rename(file, stolen);
        await fs.rm(stolen, { force: true });
      } catch {
        throw new AlreadyRunningError(name);
      }
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
