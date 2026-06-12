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
 * parse + pid liveness probe).
 */
import { spawn, spawnSync } from 'child_process';
import { closeSync, openSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';

// Env is read lazily (call time, not module load) so tests and multi-env
// deployments are never frozen to a stale value.
export const getCloudflaredBin = () => process.env.CLOUDFLARED_BIN || '/usr/local/bin/cloudflared';
export const getConfigDir = () => process.env.CLOUDFLARE_CONFIG_DIR || '/app/cloudflare-config';
/** Where the test-drive quick tunnel forwards to. */
export const getTestdriveOrigin = () => process.env.TESTDRIVE_ORIGIN || 'http://homeserver:6286';
/** Quick tunnels are auto-stopped after this long. */
export const TESTDRIVE_MAX_AGE_MS = 30 * 60 * 1000;
/** A login attempt older than this is treated as expired. */
export const CONNECT_MAX_AGE_MS = 15 * 60 * 1000;

export const TESTDRIVE_STATE = () => path.join(getConfigDir(), '.testdrive.json');
export const TESTDRIVE_LOG = () => path.join(getConfigDir(), '.testdrive.log');
export const CONNECT_STATE = () => path.join(getConfigDir(), '.connect.json');
export const CONNECT_LOG = () => path.join(getConfigDir(), '.connect.log');
export const CERT_PATH = () => path.join(getConfigDir(), 'cert.pem');
export const CREDENTIALS_PATH = () => path.join(getConfigDir(), 'credentials.json');
export const LOCAL_CONFIG_PATH = () => path.join(getConfigDir(), 'config.yml');

export function isBinaryAvailable(): boolean {
  try {
    const probe = spawnSync(getCloudflaredBin(), ['--version'], { timeout: 5000 });
    return probe.status === 0;
  } catch {
    return false;
  }
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killPid(pid: number): void {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

/**
 * Spawns cloudflared detached with stdout+stderr appended to logPath.
 * Returns the child's pid. The caller persists it in a state file.
 */
export async function spawnDetached(
  args: string[],
  logPath: string,
  env: Record<string, string> = {},
): Promise<number> {
  await fs.mkdir(getConfigDir(), { recursive: true });
  await fs.writeFile(logPath, '', 'utf-8'); // fresh log per attempt
  const out = openSync(logPath, 'a');
  const err = openSync(logPath, 'a');
  const child = spawn(getCloudflaredBin(), args, {
    detached: true,
    stdio: ['ignore', out, err],
    env: { ...process.env, ...env },
  });
  child.unref();
  closeSync(out);
  closeSync(err);
  if (child.pid === undefined) throw new Error('Failed to spawn cloudflared');
  return child.pid;
}

/** One-shot cloudflared invocation (create / route dns). Returns combined output. */
export function runCloudflared(
  args: string[],
  env: Record<string, string> = {},
  timeoutMs = 30_000,
): { ok: boolean; output: string } {
  const result = spawnSync(getCloudflaredBin(), args, {
    timeout: timeoutMs,
    env: { ...process.env, ...env },
    encoding: 'utf-8',
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  return { ok: result.status === 0, output };
}

/** Live de-risk finding (2026-06-12): the URL prints to stderr ~9s in, boxed. */
const QUICK_TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
/** Live de-risk finding: login URL prints to stderr immediately. */
const LOGIN_URL_PATTERN = /https:\/\/dash\.cloudflare\.com\/argotunnel\?[^\s]+/;

export async function parseQuickTunnelUrl(): Promise<string | null> {
  try {
    const log = await fs.readFile(TESTDRIVE_LOG(), 'utf-8');
    return log.match(QUICK_TUNNEL_URL_PATTERN)?.[0] ?? null;
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

export async function writeState(file: string, state: ProcessState): Promise<void> {
  await fs.mkdir(getConfigDir(), { recursive: true });
  await fs.writeFile(file, JSON.stringify(state), 'utf-8');
}

export async function clearState(file: string): Promise<void> {
  try {
    await fs.rm(file);
  } catch {
    // best effort
  }
}
