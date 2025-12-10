import { useEffect, useState } from 'react';
import { AdminService } from '@/services/admin/admin';
import type { AdminUsageResponse } from '@/services/admin/admin.types';

const getService = () => {
  const baseUrl = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || '';
  const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
  // Default to mock mode if no baseUrl is provided
  const mock = process.env.NEXT_PUBLIC_ADMIN_MOCK === '1' || !baseUrl;
  return new AdminService({ baseUrl, token, mock });
};

export function useAdminUsage() {
  const [data, setData] = useState<AdminUsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const service = getService();
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    service
      .getUsage()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load usage data'));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
