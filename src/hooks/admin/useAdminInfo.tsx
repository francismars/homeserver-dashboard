import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminService } from '@/services/admin/admin';
import type { AdminInfoResponse } from '@/services/admin/admin.types';

const getService = () => {
  // AdminService now uses API routes, no need for baseUrl/token
  return new AdminService({ baseUrl: '', token: '' });
};

export function useAdminInfo() {
  const [data, setData] = useState<AdminInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const service = getService();
    const fetchId = ++fetchIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const result = await service.getInfo();
      if (!isMountedRef.current) return;
      if (fetchId !== fetchIdRef.current) return;
      setData(result);
    } catch (err) {
      if (!isMountedRef.current) return;
      if (fetchId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to load server info'));
    } finally {
      if (!isMountedRef.current) return;
      if (fetchId !== fetchIdRef.current) return;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void refetch();
    return () => {
      isMountedRef.current = false;
    };
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
