import { promises as fs } from 'fs';
import {
  PREVIEW_ENV,
  PREVIEW_PUBLISHED,
  PREVIEW_INSTANT_STATE,
  clearState,
  killPid,
  readState,
} from './cloudflared-process';

/**
 * Tears preview mode down when a real setup lands (connect complete,
 * auto-setup, disconnect): the marker must vanish so the wrapper stops
 * publishing the temporary URL, the instant child must die so it stops
 * serving it, and the wrapper handshake must not linger as a stale
 * published_url. Best effort by construction: every step tolerates the
 * artifact already being gone.
 */
export async function teardownPreview(): Promise<void> {
  const state = await readState(PREVIEW_INSTANT_STATE());
  if (state) await killPid(state.pid, state.starttime);
  await clearState(PREVIEW_INSTANT_STATE());
  await fs.rm(PREVIEW_ENV(), { force: true });
  await fs.rm(PREVIEW_PUBLISHED(), { force: true });
}
