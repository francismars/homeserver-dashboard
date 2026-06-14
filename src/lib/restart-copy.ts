/**
 * The one canonical restart instruction, used verbatim anywhere the dashboard
 * (or an API route message) asks the operator to restart the app. A single
 * source avoids drift between "restart the app", "stop and start", etc.
 *
 * Platform-aware: under Umbrel the restart is the app tile's Restart; a
 * standalone operator restarts the homeserver however they run it, so the
 * Umbrel-specific instruction would be wrong. Server routes pass
 * getPlatform(); client components use the useRestartSentence() hook.
 *
 * Keep this module free of React and Node-only imports (the Platform type is
 * erased at build time).
 */
import type { Platform } from '@/lib/server/platform';

export function restartAppSentence(platform: Platform): string {
  return platform === 'umbrel'
    ? "Restart the Pubky Homeserver app from Umbrel (open the app's tile, then Restart)."
    : 'Restart your homeserver to apply this.';
}
