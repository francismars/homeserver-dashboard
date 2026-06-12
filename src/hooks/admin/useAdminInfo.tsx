import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminService } from '@/services/admin/admin';
import { usePolling } from '@/hooks/usePolling';
import type { AdminInfoResponse } from '@/services/admin/admin.types';

const getService = () => new AdminService();

/** Retry cadence while the homeserver is unreachable (it can take up to a
 * couple of minutes to come up after an app start or restart). */
const RETRY_INTERVAL_MS = 5000;

export function useAdminInfo() {
  const [data, setData] = useState<AdminInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  const inFlightRef = useRef(false);

  // `silent` fetches (the background retries) never touch isLoading, so the
  // page keeps showing the error explanation instead of flashing skeletons.
  const fetchInfo = useCallback(async (silent: boolean) => {
    const service = getService();
    const fetchId = ++fetchIdRef.current;
    inFlightRef.current = true;

    if (!silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const result = await service.getInfo();
      if (!isMountedRef.current) return;
      if (fetchId !== fetchIdRef.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      if (fetchId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to load server info'));
    } finally {
      if (fetchId === fetchIdRef.current) inFlightRef.current = false;
      if (isMountedRef.current && fetchId === fetchIdRef.current && !silent) {
        setIsLoading(false);
      }
    }
  }, []);

  const refetch = useCallback(() => fetchInfo(false), [fetchInfo]);

  useEffect(() => {
    isMountedRef.current = true;
    void refetch();
    return () => {
      isMountedRef.current = false;
    };
  }, [refetch]);

  // Boot-window recovery: while the info is errored or absent, retry in the
  // background until the homeserver answers, then go back to fetch-on-demand
  // only. usePolling serializes its own ticks; inFlightRef additionally keeps
  // a retry from overlapping a manual refetch.
  usePolling(
    () => {
      if (inFlightRef.current) return;
      return fetchInfo(true);
    },
    RETRY_INTERVAL_MS,
    { enabled: !data || !!error },
  );

  return { data, isLoading, error, refetch };
}
