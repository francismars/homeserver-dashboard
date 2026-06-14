export type Platform = 'umbrel' | 'standalone';

/**
 * Which deployment this dashboard runs in. The same image serves both Umbrel
 * and standalone; only the runtime `PLATFORM` env differs (the Umbrel compose
 * sets `PLATFORM=umbrel`). Read lazily at call time. Anything other than the
 * explicit 'umbrel' is treated as standalone, so a missing or misconfigured
 * value fails safe toward the generic, non-Umbrel-specific experience.
 */
export function getPlatform(): Platform {
  return process.env.PLATFORM === 'umbrel' ? 'umbrel' : 'standalone';
}
