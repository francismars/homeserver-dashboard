'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CircleCheckBig, AlertCircle, Copy, RefreshCw } from 'lucide-react';
import { cn, copyToClipboard } from '@/libs/utils';
import { RestartCallout } from '@/components/organisms/ConfigDialog/RestartCallout';
import { RESTART_APP_SENTENCE } from '@/lib/restart-copy';
import { GetStartedChecklist } from './GetStartedChecklist';
import type { DashboardOverviewProps } from './DashboardOverview.types';

type DomainHealth = 'not_set_up' | 'checking' | 'reachable' | 'unreachable';

/** "localhost:6286" / missing -> the operator never set up public access. */
function domainHostname(pkarrIcannDomain: string | undefined): string | null {
  const hostname = (pkarrIcannDomain ?? '').split(':')[0].trim().toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return null;
  return hostname;
}

/** Connection failure explained for the operator first (on Umbrel there is no
 * .env.local to fix); the env-var checklist only matters to developers and
 * lives behind a collapsed disclosure. */
function ConnectionErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-testid="connection-error">
      <AlertTitle>Connection Error</AlertTitle>
      <AlertDescription className="text-xs">
        <p>Your homeserver may still be starting. Wait a minute - this page retries automatically.</p>
        <p className="mt-1">If this persists: {RESTART_APP_SENTENCE}</p>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 px-2 text-xs"
            onClick={onRetry}
            data-testid="connection-retry"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry now
          </Button>
        )}
        <details className="mt-2" data-testid="connection-dev-details">
          <summary className="cursor-pointer font-medium">Developer details</summary>
          <p className="mt-1 break-words">{message}</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>Missing or incorrect ADMIN_BASE_URL in .env.local</li>
            <li>Missing or incorrect ADMIN_TOKEN in .env.local</li>
            <li>Homeserver is not running or unreachable</li>
          </ul>
        </details>
      </AlertDescription>
    </Alert>
  );
}

/** /info does not include this field: say so instead of inventing a value. */
function NotAvailable() {
  return (
    <div className="flex min-w-0 flex-col sm:items-end">
      <span className="text-xs text-foreground sm:text-sm">Not available</span>
      <span className="text-xs text-muted-foreground">Not reported by this homeserver (it may be too old)</span>
    </div>
  );
}

function CopyValueButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await copyToClipboard({ text: value });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-6 shrink-0 px-1.5"
      onClick={() => void copy()}
      aria-label={label}
    >
      {copied ? <span className="text-xs text-brand">Copied</span> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export function DashboardOverview({
  info,
  isLoading,
  error,
  onFixCloudflare,
  onRetry,
  onGoToInvites,
  setupGuideDismissed,
  onDismissSetupGuide,
  cloudflareRefreshKey,
}: DashboardOverviewProps) {
  const isConnected = !error && !!info;
  const connectionError = error?.message || (error ? 'Failed to load server information' : null);

  // Live reachability of the published domain. One probe when the domain
  // becomes known (no polling - this is the landing view), manual re-check.
  const probeHostname = domainHostname(info?.pkarr_icann_domain);
  const [domainHealth, setDomainHealth] = useState<DomainHealth>('not_set_up');

  const checkDomain = async (hostname: string) => {
    setDomainHealth('checking');
    try {
      const res = await fetch(`/api/public-health?domain=${encodeURIComponent(hostname)}`, { cache: 'no-store' });
      const data = await res.json();
      setDomainHealth(data.ok ? 'reachable' : 'unreachable');
    } catch {
      setDomainHealth('unreachable');
    }
  };

  useEffect(() => {
    if (!probeHostname) {
      setDomainHealth('not_set_up');
      return;
    }
    void checkDomain(probeHostname);
  }, [probeHostname]);

  // Durable restart-pending signal (boot stamp vs state mtimes, server
  // derived): survives page reloads, unlike the Settings dialog's session
  // state. Reachability cannot stand in for it - the tunnel reconnects
  // without a restart, the pkarr publication does not. The same read carries
  // the server-derived Cloudflare mode, which drives the get-started step.
  const [restartPending, setRestartPending] = useState(false);
  const [cloudflareMode, setCloudflareMode] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/cloudflare-config', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) {
          setRestartPending(data.restart_pending === true);
          setCloudflareMode(typeof data.mode === 'string' ? data.mode : null);
        }
      } catch {
        // unknown: keep the callout hidden
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [cloudflareRefreshKey]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Only show server details if we have info
  if (!info) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">Server & Connection</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Homeserver details and dashboard connection
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {/* Inset separator between the header and the content (lighter than a full divider) */}
        <div className="mx-6 h-px bg-border/60" />

        <CardContent className="space-y-3 pt-4">
          {/* Connection Status */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Connection Status:</span>
            <div className="shrink-0">
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="mr-1 h-3 w-3" />
                Not Connected
              </Badge>
            </div>
          </div>
          {connectionError && <ConnectionErrorAlert message={connectionError} onRetry={onRetry} />}
        </CardContent>
      </Card>
    );
  }

  // Support both new (public_key) and legacy (pubkey) field names. No
  // fallback values: a made-up pubkey gets copied into pkdns and shared.
  const homeserverPubkey = info.public_key ?? info.pubkey ?? null;
  const homeserverVersion = info.version ?? null;

  return (
    <div className="space-y-4">
      {/* Get-started checklist: rendered only when its wiring is present
          (onDismissSetupGuide) and the user has not dismissed it. */}
      {onDismissSetupGuide && setupGuideDismissed === false && (
        <GetStartedChecklist
          reachableDone={cloudflareMode !== null && cloudflareMode !== 'off' && domainHealth === 'reachable'}
          inviteDone={info.num_signup_codes > 0}
          signupDone={info.num_users > 0}
          onSetUpAccess={onFixCloudflare}
          onCreateInvite={onGoToInvites}
          onDismiss={onDismissSetupGuide}
        />
      )}
      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">Server & Connection</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Homeserver details and dashboard connection
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          {/* Inset separator between the header and the content (lighter than a full divider) */}
          <div className="mx-6 h-px bg-border/60" />

          <CardContent className="space-y-3 pt-4">
            {/* Connection Status */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Connection Status:</span>
              <div className="shrink-0">
                {isConnected ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand sm:text-sm">
                    <CircleCheckBig className="h-4 w-4" />
                    <span>Connected</span>
                  </div>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Not Connected
                  </Badge>
                )}
              </div>
            </div>

            {/* Connection Error Message */}
            {connectionError && <ConnectionErrorAlert message={connectionError} onRetry={onRetry} />}

            {/* After a failed refetch the details below are from the last
                successful read, not the present: say so and dim them. */}
            {!isConnected && (
              <p className="pt-1 text-xs font-medium text-muted-foreground" data-testid="stale-info-label">
                Last known state
              </p>
            )}

            <div className={cn('space-y-3', !isConnected && 'opacity-70')}>
              {/* Server Pubkey */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Homeserver Pubkey:</span>
                {homeserverPubkey ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
                    <span className="font-mono text-xs break-all text-foreground sm:text-sm">{homeserverPubkey}</span>
                    <CopyValueButton value={homeserverPubkey} label="Copy pubkey" />
                  </div>
                ) : (
                  <NotAvailable />
                )}
              </div>

              {/* Server Version */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Homeserver version:</span>
                {homeserverVersion ? (
                  <span className="text-xs break-words text-foreground sm:text-sm">{homeserverVersion}</span>
                ) : (
                  <NotAvailable />
                )}
              </div>

              {/* Pubky address (technically the PKARR address) */}
              {info.pkarr_pubky_address && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="shrink-0 text-xs text-muted-foreground sm:text-sm" title="PKARR address">
                      Pubky address:
                    </span>
                    <span className="text-xs text-muted-foreground/70">How Pubky apps find this server</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <code className="min-w-0 rounded bg-muted px-2 py-1 font-mono text-xs break-all">
                      {info.pkarr_pubky_address}
                    </code>
                    <CopyValueButton value={info.pkarr_pubky_address} label="Copy address" />
                  </div>
                </div>
              )}

              {/* Public domain (technically the PKARR ICANN domain) + live
                  reachability. Always rendered: a missing or localhost value
                  means public access was never set up, which is exactly what
                  the row should say (without leaking the localhost value). */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="shrink-0 text-xs text-muted-foreground sm:text-sm" title="PKARR ICANN domain">
                  Public address:
                </span>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {probeHostname && info.pkarr_icann_domain && (
                    <>
                      <code className="min-w-0 rounded bg-muted px-2 py-1 font-mono text-xs break-all">
                        {info.pkarr_icann_domain}
                      </code>
                      <CopyValueButton value={info.pkarr_icann_domain} label="Copy public address" />
                    </>
                  )}
                  {domainHealth === 'checking' && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                      data-testid="domain-health-checking"
                    >
                      <RefreshCw className="h-3 w-3 animate-spin" /> Checking…
                    </span>
                  )}
                  {domainHealth === 'reachable' && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand"
                      data-testid="domain-health-reachable"
                    >
                      <CircleCheckBig className="h-3 w-3" /> Reachable
                    </span>
                  )}
                  {domainHealth === 'unreachable' && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 text-xs text-amber-400"
                      data-testid="domain-health-unreachable"
                    >
                      <AlertCircle className="h-3 w-3" /> {restartPending ? 'Not reachable yet' : 'Not reachable'}
                    </span>
                  )}
                  {domainHealth === 'not_set_up' && (
                    <span className="shrink-0 text-xs text-muted-foreground" data-testid="domain-health-not-set-up">
                      Not set up
                    </span>
                  )}
                  {probeHostname && domainHealth !== 'checking' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-1.5"
                      onClick={() => void checkDomain(probeHostname)}
                      aria-label="Re-check public address reachability"
                      data-testid="domain-health-recheck"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                  {/* Right after a setup the domain is expectedly unreachable
                      until the app restarts; "Fix it" would point at a
                      non-problem. */}
                  {((domainHealth === 'unreachable' && !restartPending) || domainHealth === 'not_set_up') &&
                    onFixCloudflare && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 shrink-0 px-2 text-xs"
                        onClick={onFixCloudflare}
                        data-testid="domain-health-fix"
                      >
                        {domainHealth === 'not_set_up' ? 'Set up' : 'Fix it'}
                      </Button>
                    )}
                  {domainHealth === 'unreachable' && restartPending && (
                    <span className="w-full text-xs text-muted-foreground" data-testid="domain-health-restart-hint">
                      To finish setup: {RESTART_APP_SENTENCE}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Durable restart signal next to the reachability/"Fix it" area */}
            {restartPending && <RestartCallout />}
          </CardContent>
        </Card>
      </div>

      {/* Where the data actually lives; the dashboard offers no export, so
          this is the one place the backup story is told. */}
      <p className="px-1 text-xs text-muted-foreground/70" data-testid="backup-note">
        Backups: your homeserver&apos;s identity and all user data live in this app&apos;s data directory on your
        Umbrel. Include it in your Umbrel backups; losing it means losing this server&apos;s identity.
      </p>
    </div>
  );
}
