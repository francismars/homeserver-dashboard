'use client';

import { useEffect, useRef, useState } from 'react';

export type Capabilities = {
  logs: boolean;
  configWrite: boolean;
};

type State = {
  data: Capabilities | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Probes /api/capabilities to find out which runtime features are available
 * (Logs tab, Config edit). Refetches every 30s while the consumer is mounted,
 * so adding a log file or remounting `:rw` lights up the affordances without
 * a page reload. Tolerates network/server failure by leaving the previous
 * snapshot in place — never flickers everything off on a transient blip.
 */
export function useCapabilities() {
  const [state, setState] = useState<State>({
    data: null,
    isLoading: true,
    error: null,
  });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    async function probe() {
      try {
        const response = await fetch('/api/capabilities', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Capabilities probe failed: ${response.status}`);
        }
        const data = (await response.json()) as Capabilities;
        if (!cancelled && isMountedRef.current) {
          setState({ data, isLoading: false, error: null });
        }
      } catch (err) {
        if (!cancelled && isMountedRef.current) {
          setState((prev) => ({
            data: prev.data,
            isLoading: false,
            error: err instanceof Error ? err : new Error('Capabilities probe failed'),
          }));
        }
      }
    }

    void probe();
    const interval = setInterval(probe, 30_000);

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return {
    capabilities: state.data,
    isLoading: state.isLoading,
    error: state.error,
    logs: state.data?.logs ?? false,
    configWrite: state.data?.configWrite ?? false,
  };
}
