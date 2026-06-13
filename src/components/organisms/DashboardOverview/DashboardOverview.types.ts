import type { AdminInfoResponse } from '@/services/admin';

/** Client-side mirror of /api/pkarr-health's response (the server type lives
 * in a node-only module that client components must not import). */
export type PkarrGate = 'match' | 'mismatch' | 'not_compared';
export type PkarrVerdict = 'verified' | 'mismatch' | 'not_found' | 'invalid' | 'unavailable';

export type PkarrRecordRow = { name: string; type: string; value: string; ttl: number };

export type PkarrHealthResponse = {
  verdict: PkarrVerdict;
  gates: { address: PkarrGate; domain: PkarrGate };
  published: { address: string | null; domain: string | null };
  expected: { address: string | null; domain: string | null };
  timestamp_ms: number | null;
  packet_age_ms: number | null;
  records: PkarrRecordRow[];
};

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
