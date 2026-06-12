import { useEffect, useRef } from 'react';

type UsePollingOptions = {
  /** When false, no interval is scheduled and nothing runs. Defaults to true. */
  enabled?: boolean;
  /** Also run `fn` immediately when polling starts, before the first tick. */
  immediate?: boolean;
};

/**
 * Runs `fn` every `intervalMs` while mounted (and `enabled`).
 *
 * Overlap and staleness: a tick is skipped while a previous call is still in
 * flight, so calls are serialized. Because at most one call runs at a time
 * and the next one only starts after the previous resolved, a slow response
 * can never be applied after a newer one - last-write-wins protection falls
 * out of the serialization, no response versioning needed.
 *
 * The latest `fn` is always called (it is read through a ref), so consumers
 * can pass inline closures without resetting the interval. Changing
 * `intervalMs` or `enabled` reschedules the interval.
 */
export function usePolling(fn: () => void | Promise<void>, intervalMs: number, opts: UsePollingOptions = {}) {
  const { enabled = true, immediate = false } = opts;
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await fnRef.current();
      } finally {
        inFlight = false;
      }
    };
    if (immediate) void tick();
    const id = setInterval(() => void tick(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, immediate]);
}
