import type { AdminUsageResponse, AdminInfoResponse } from '@/services/admin';

export type DashboardUsageProps = {
  usage: AdminUsageResponse | null;
  isLoading: boolean;
  error: Error | null;
  info?: AdminInfoResponse | null;
};

