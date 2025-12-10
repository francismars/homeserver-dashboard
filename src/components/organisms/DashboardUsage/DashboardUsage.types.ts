import type { AdminUsageResponse } from '@/services/admin';

export type DashboardUsageProps = {
  usage: AdminUsageResponse | null;
  isLoading: boolean;
  error: Error | null;
  totalDiskMB?: number;
};

