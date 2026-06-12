'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, CircleCheckBig, AlertCircle, RefreshCw } from 'lucide-react';
import { RestartCallout } from '@/components/organisms/ConfigDialog/RestartCallout';
import type { DashboardOverviewProps } from './DashboardOverview.types';

const FALLBACK_HOMESERVER_PUBKEY = 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o';
const FALLBACK_HOMESERVER_VERSION = '0.1.0-dev';

type DomainHealth = 'not_set_up' | 'checking' | 'reachable' | 'unreachable';

/** "localhost:6286" / missing -> the operator never set up public access. */
function domainHostname(pkarrIcannDomain: string | undefined): string | null {
  const hostname = (pkarrIcannDomain ?? '').split(':')[0].trim().toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return null;
  return hostname;
}

export function DashboardOverview({ info, isLoading, error, onFixCloudflare }: DashboardOverviewProps) {
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
  // without a restart, the pkarr publication does not.
  const [restartPending, setRestartPending] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/cloudflare-config', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setRestartPending(data.restart_pending === true);
      } catch {
        // unknown: keep the callout hidden
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
          {connectionError && (
            <Alert variant="destructive">
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription className="text-xs">
                {connectionError}
                {connectionError.includes('ADMIN_BASE_URL') || connectionError.includes('ADMIN_TOKEN') ? (
                  <div className="mt-2">
                    <p className="font-medium">Possible causes:</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      <li>Missing or incorrect ADMIN_BASE_URL in .env.local</li>
                      <li>Missing or incorrect ADMIN_TOKEN in .env.local</li>
                      <li>Homeserver is not running or unreachable</li>
                    </ul>
                  </div>
                ) : null}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  const isPubkeySoon = !info.public_key && !info.pubkey;
  const isVersionSoon = !info.version;

  // Support both new (public_key) and legacy (pubkey) field names
  const homeserverPubkey = info.public_key ?? info.pubkey ?? FALLBACK_HOMESERVER_PUBKEY;
  const homeserverVersion = info.version ?? FALLBACK_HOMESERVER_VERSION;

  return (
    <div className="space-y-4">
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
            {connectionError && (
              <Alert variant="destructive">
                <AlertTitle>Connection Error</AlertTitle>
                <AlertDescription className="text-xs">
                  {connectionError}
                  {connectionError.includes('ADMIN_BASE_URL') || connectionError.includes('ADMIN_TOKEN') ? (
                    <div className="mt-2">
                      <p className="font-medium">Possible causes:</p>
                      <ul className="mt-1 list-inside list-disc space-y-0.5">
                        <li>Missing or incorrect ADMIN_BASE_URL in .env.local</li>
                        <li>Missing or incorrect ADMIN_TOKEN in .env.local</li>
                        <li>Homeserver is not running or unreachable</li>
                      </ul>
                    </div>
                  ) : null}
                </AlertDescription>
              </Alert>
            )}

            {/* Server Pubkey */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Homeserver Pubkey:</span>
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
                <span className="font-mono text-xs break-all text-foreground sm:text-sm">{homeserverPubkey}</span>
                {isPubkeySoon && (
                  <Badge variant="outline" className="shrink-0 border-dashed text-xs font-normal">
                    <Info className="mr-1 h-3 w-3" />
                    Soon
                  </Badge>
                )}
              </div>
            </div>

            {/* Server Version */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Homeserver version:</span>
              <div className="flex flex-1 items-center gap-2 sm:flex-initial">
                <span className="text-xs break-words text-foreground sm:text-sm">{homeserverVersion}</span>
                {isVersionSoon && (
                  <Badge variant="outline" className="shrink-0 border-dashed text-xs font-normal">
                    <Info className="mr-1 h-3 w-3" />
                    Soon
                  </Badge>
                )}
              </div>
            </div>

            {/* PKARR Pubky Address */}
            {info.pkarr_pubky_address && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">PKARR Address:</span>
                <code className="min-w-0 rounded bg-muted px-2 py-1 font-mono text-xs break-all">
                  {info.pkarr_pubky_address}
                </code>
              </div>
            )}

            {/* PKARR ICANN Domain + live reachability */}
            {info.pkarr_icann_domain && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">PKARR Domain:</span>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <code className="min-w-0 rounded bg-muted px-2 py-1 font-mono text-xs break-all">
                    {info.pkarr_icann_domain}
                  </code>
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
                      <AlertCircle className="h-3 w-3" /> Not reachable
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
                      aria-label="Re-check domain reachability"
                      data-testid="domain-health-recheck"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                  {(domainHealth === 'unreachable' || domainHealth === 'not_set_up') && onFixCloudflare && (
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
                </div>
              </div>
            )}

            {/* Durable restart signal next to the reachability/"Fix it" area */}
            {restartPending && <RestartCallout>Restart the app from Umbrel to apply your changes.</RestartCallout>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
