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

  const adminBaseUrl = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || '';
  const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
  const hasConfig = adminBaseUrl && adminToken;
  const isConfigured = !!hasConfig;

  const isPubkeySoon = !info.pubkey;
  const isVersionSoon = !info.version;

  const homeserverPubkey = info.pubkey ?? FALLBACK_HOMESERVER_PUBKEY;
  const homeserverVersion = info.version ?? FALLBACK_HOMESERVER_VERSION;

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <Card>
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">Server & Connection</CardTitle>
                <CardDescription>Homeserver details and dashboard connection</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Connection Status:</span>
              {isConfigured ? (
                <Badge variant="default" className="bg-brand">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Not Configured
                </Badge>
              )}
            </div>

            {/* Server Pubkey */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Homeserver Pubkey:</span>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-xs text-muted-foreground/70 italic">{homeserverPubkey}</span>
                {isPubkeySoon && (
                  <Badge variant="outline" className="shrink-0 border-dashed text-xs font-normal">
                    <Info className="mr-1 h-3 w-3" />
                    Soon
                  </Badge>
                )}
              </div>
            </div>

            {/* Server Version */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Version:</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground/70 italic">{homeserverVersion}</span>
                {isVersionSoon && (
                  <Badge variant="outline" className="shrink-0 border-dashed text-xs font-normal">
                    <Info className="mr-1 h-3 w-3" />
                    Soon
                  </Badge>
                )}
              </div>
            </div>

            {/* Admin Endpoint */}
            {adminBaseUrl && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Admin Endpoint:</span>
                <code className="rounded bg-muted px-2 py-1 text-xs">{adminBaseUrl}</code>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
