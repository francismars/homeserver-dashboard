import { promises as fs } from 'fs';
import path from 'path';
import {
  CREDENTIALS_PATH,
  DOMAIN_PATH,
  LOCAL_CONFIG_PATH,
  PREVIEW_ENV,
  PREVIEW_TEARDOWN_STAMP,
  TOKEN_PATH,
} from './cloudflared-process';

export type RestartReason = 'setup_changed' | 'preview_changed' | 'config_changed';

export interface RestartPendingInfo {
  /** true: something changed since the last app boot and needs a restart to
   * take full effect. false: the wrapper has demonstrably run since the
   * newest change. null: unknown - no boot stamp exists (old wrapper, dev
   * env), so the client falls back to its in-session signals. */
  restart_pending: boolean | null;
  restart_reason: RestartReason | null;
}

const getHomeserverConfigPath = () => process.env.HOMESERVER_CONFIG_PATH || '/app/homeserver-data/config.toml';

/** Written atomically by the init wrapper at the END of every app boot, next
 * to config.toml on the homeserver data mount. Anything modified after it
 * has not been picked up by a boot yet. */
export const BOOT_STAMP_PATH = () => path.join(path.dirname(getHomeserverConfigPath()), '.wrapper-boot-stamp');

async function mtimeMs(p: string): Promise<number | null> {
  try {
    return (await fs.stat(p)).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Durable, server-derived "restart pending" signal: compares the Cloudflare
 * state files and config.toml against the wrapper boot stamp, so the signal
 * survives page reloads instead of living in React state. HTTPS reachability
 * is deliberately NOT an input: the crash-looping cloudflared picks up
 * token/config changes without an app restart, while the pkarr record (how
 * Pubky clients find the server) only republishes when the homeserver
 * process restarts.
 *
 * The newest mtime among the present files decides the reason. Only durable
 * setup artifacts are candidates - NOT the config directory's mtime, which
 * transient files (flow locks, .connect.json, login logs) bump even when no
 * setup artifact changed, e.g. a started-then-cancelled Connect flow.
 * Deletions still register: disconnect truncates token/domain (fresh
 * mtimes), and a preview teardown touches its dedicated stamp file.
 */
export async function detectRestartPending(): Promise<RestartPendingInfo> {
  const stamp = await mtimeMs(BOOT_STAMP_PATH());
  if (stamp === null) return { restart_pending: null, restart_reason: null };
  const candidates: Array<[string, RestartReason]> = [
    [TOKEN_PATH(), 'setup_changed'],
    [DOMAIN_PATH(), 'setup_changed'],
    [LOCAL_CONFIG_PATH(), 'setup_changed'],
    [CREDENTIALS_PATH(), 'setup_changed'],
    [PREVIEW_ENV(), 'preview_changed'],
    [PREVIEW_TEARDOWN_STAMP(), 'preview_changed'],
    [getHomeserverConfigPath(), 'config_changed'],
  ];
  let newest = stamp;
  let reason: RestartReason | null = null;
  for (const [file, fileReason] of candidates) {
    const m = await mtimeMs(file);
    if (m !== null && m > newest) {
      newest = m;
      reason = fileReason;
    }
  }
  if (reason === null) return { restart_pending: false, restart_reason: null };
  return { restart_pending: true, restart_reason: reason };
}
