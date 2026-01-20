'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, CheckCircle2, AlertCircle } from 'lucide-react';
import type { DashboardOverviewProps } from './DashboardOverview.types';

const FALLBACK_HOMESERVER_PUBKEY = 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o';
const FALLBACK_HOMESERVER_VERSION = '0.1.0-dev';

export function DashboardOverview({ info, isLoading, error }: DashboardOverviewProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading server info</AlertTitle>
        <AlertDescription>{error.message || 'Failed to load server information'}</AlertDescription>
      </Alert>
    );
  }

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

  if (!info) {
    return null;
  }

  // Using API routes now, so always configured
  const isConfigured = true;

  const isPubkeySoon = !info.public_key && !info.pubkey;
  const isVersionSoon = !info.version;

  // Support both new (public_key) and legacy (pubkey) field names
  const homeserverPubkey = info.public_key ?? info.pubkey ?? FALLBACK_HOMESERVER_PUBKEY;
  const homeserverVersion = info.version ?? FALLBACK_HOMESERVER_VERSION;

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <Card>
          <CardHeader className="border-b pb-3 sm:pb-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">Server & Connection</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Homeserver details and dashboard connection
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-3 sm:space-y-3 sm:pt-4">
            {/* Connection Status */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Connection Status:</span>
              <div className="flex-shrink-0">
                {isConfigured ? (
                  <Badge variant="default" className="bg-brand text-xs">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Not Configured
                  </Badge>
                )}
              </div>
            </div>

            {/* Server Pubkey */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Homeserver Pubkey:</span>
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
                <span className="truncate font-mono text-xs break-all text-muted-foreground/70 italic">
                  {homeserverPubkey}
                </span>
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
              <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Version:</span>
              <div className="flex flex-1 items-center gap-2 sm:flex-initial">
                <span className="text-xs break-words text-muted-foreground/70 italic sm:text-sm">
                  {homeserverVersion}
                </span>
                {isVersionSoon && (
                  <Badge variant="outline" className="shrink-0 border-dashed text-xs font-normal">
                    <Info className="mr-1 h-3 w-3" />
                    Soon
                  </Badge>
                )}
              </div>
            </div>

            {/* Admin Endpoint - Using API routes, endpoint configured server-side */}
            {isConfigured && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Admin API:</span>
                <code className="min-w-0 rounded bg-muted px-2 py-1 text-xs break-all">Configured via API routes</code>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
