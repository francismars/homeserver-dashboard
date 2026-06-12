import type { AdminInfoResponse } from '@/services/admin';

export type DashboardOverviewProps = {
  info: AdminInfoResponse | null;
  isLoading: boolean;
  error: Error | null;
  /** Opens the Settings dialog focused on the Cloudflare tab ("Fix it"). */
  onFixCloudflare?: () => void;
  /** Manual "Retry now" in the connection-error state. */
  onRetry?: () => void;
  /** Switches the dashboard to the Invites tab (get-started step 2 CTA). */
  onGoToInvites?: () => void;
  /** null = not yet read from localStorage; the checklist renders only on false. */
  setupGuideDismissed?: boolean | null;
  /** Persists the dismissal; the checklist renders only when this is wired. */
  onDismissSetupGuide?: () => void;
  /** Re-reads Cloudflare mode + restart-pending when this changes (the parent
   * bumps it when the Settings dialog closes). */
  cloudflareRefreshKey?: number;
};
