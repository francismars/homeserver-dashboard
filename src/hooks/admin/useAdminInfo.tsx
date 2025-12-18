import { useEffect, useState } from 'react';
import { AdminService } from '@/services/admin/admin';
import type { AdminInfoResponse } from '@/services/admin/admin.types';

const getService = () => {
  const baseUrl = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || '';
  const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
  return new AdminService({ baseUrl, token });
};

export function useAdminInfo() {
  const [data, setData] = useState<AdminInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const service = getService();
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    service
      .getInfo()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load server info'));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
