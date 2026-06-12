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

/**
 * A pid from a state file may belong to a different process after a container
 * restart (PID namespaces restart from 1; state files on the bind mount
 * survive). Trust a pid only when it is alive AND its command is one we
 * could have spawned - otherwise a stale state file could make us SIGTERM an
 * arbitrary same-uid process, including the dashboard itself.
 */
function isOurProcess(pid: number): boolean {
  try {
    const comm = readFileSync(`/proc/${pid}/comm`, 'utf-8').trim();
    return comm === 'cloudflared' || comm === 'timeout';
  } catch {
    return false;
  }
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  return isOurProcess(pid);
}

export function killPid(pid: number): void {
  if (!isOurProcess(pid)) return;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

/**
 * Spawns a command detached with stdout+stderr appended to logPath.
 * Returns the child's pid. The caller persists it in a state file.
 */
export async function spawnDetached(
  command: string[],
  logPath: string,
  env: Record<string, string> = {},
): Promise<number> {
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
  return child.pid;
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
  await fs.rename(delivered, CERT_PATH());
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
}

export async function readState(file: string): Promise<ProcessState | null> {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as ProcessState;
    if (typeof parsed.pid !== 'number' || typeof parsed.started_at !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Atomically claims the state file (O_EXCL). Returns false when another
 * request already holds it - the spawn mutex against double-start races.
 */
export async function claimState(file: string): Promise<boolean> {
  await fs.mkdir(getConfigDir(), { recursive: true });
  try {
    const handle = await fs.open(file, 'wx');
    await handle.close();
    return true;
  } catch {
    return false;
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
