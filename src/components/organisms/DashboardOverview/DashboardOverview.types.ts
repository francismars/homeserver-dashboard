import type { AdminInfoResponse } from '@/services/admin';

export type DashboardOverviewProps = {
  info: AdminInfoResponse | null;
  isLoading: boolean;
  error: Error | null;
};

