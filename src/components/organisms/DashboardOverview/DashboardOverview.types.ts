import type { AdminInfoResponse } from '@/services/admin';

export type DashboardOverviewProps = {
  info: AdminInfoResponse | null;
  isLoading: boolean;
  error: Error | null;
  /** Opens the Settings dialog focused on the Cloudflare tab ("Fix it"). */
  onFixCloudflare?: () => void;
};
