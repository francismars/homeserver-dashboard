import { promises as fs } from 'fs';
import {
  PREVIEW_ENV,
  PREVIEW_PUBLISHED,
  PREVIEW_TEARDOWN_STAMP,
  PREVIEW_INSTANT_STATE,
  clearState,
  killPid,
  readState,
} from './cloudflared-process';

/**
 * Tears preview mode down when a real setup lands (connect complete,
 * auto-setup, disconnect) or the user disables it: the marker must vanish so
 * the wrapper stops publishing the temporary URL, the instant child must die
 * so it stops serving it, and the wrapper handshake must not linger as a
 * stale published_url. Best effort by construction: every step tolerates the
 * artifact already being gone.
 *
 * Returns whether the instant child is actually gone (killPid escalates and
 * reports; a caller's response must not claim a dead tunnel while a stuck
 * child still serves it).
 */
export async function teardownPreview(): Promise<boolean> {
  const state = await readState(PREVIEW_INSTANT_STATE());
  const instantGone = state ? await killPid(state.pid, state.starttime) : true;
  await clearState(PREVIEW_INSTANT_STATE());
  let hadMarker = false;
  try {
    await fs.rm(PREVIEW_ENV());
    hadMarker = true;
  } catch {
    // already gone (or unremovable - nothing to record either way)
  }
  await fs.rm(PREVIEW_PUBLISHED(), { force: true });
  // Removing the marker leaves no state file newer than the boot stamp, so
  // detectRestartPending needs this trace to flag the pending restart.
  if (hadMarker) await fs.writeFile(PREVIEW_TEARDOWN_STAMP(), new Date().toISOString(), 'utf-8').catch(() => {});
  return instantGone;
}
