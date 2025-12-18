'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StatCard } from '@/components/atoms/StatCard';
import {
  Users,
  HardDrive,
  Shield,
  Key,
  Server,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/libs/utils';
import type { DashboardOverviewProps } from './DashboardOverview.types';

// Mock data
const MOCK_SERVER_INFO = {
  address: 'https://homeserver.example.com',
  version: '0.1.0-dev',
  pubkey: 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o',
};

// Mock explanations
const MOCK_EXPLANATIONS = {
  serverInfo: `Some fields may be mock. This happens either because the dashboard is running in mock mode, or because the homeserver /info endpoint does not provide pubkey/version fields. To make these fields real, the backend needs to include them in /info (or expose a dedicated endpoint).`,
};

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!info) {
    return null;
  }

  const adminBaseUrl = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || '';
  const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
  const adminMock = process.env.NEXT_PUBLIC_ADMIN_MOCK === '1';
  const isMockMode = adminMock || !adminBaseUrl;
  const hasConfig = adminBaseUrl && adminToken;
  const isConfigured = hasConfig && !isMockMode;

  const homeserverPubkey = info.pubkey || MOCK_SERVER_INFO.pubkey;
  const homeserverVersion = info.version || MOCK_SERVER_INFO.version;
  const isPubkeyMock = isMockMode || !info.pubkey;
  const isVersionMock = isMockMode || !info.version;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={info.num_users.toString()} icon={Users} intent="default" />
        <StatCard
          label="Disabled Users"
          value={info.num_disabled_users.toString()}
          icon={Shield}
          intent={info.num_disabled_users > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Disk Used" value={`${info.total_disk_used_mb} MB`} icon={HardDrive} intent="default" />
        <StatCard label="Signup Codes" value={info.num_signup_codes.toString()} icon={Key} intent="default" />
      </div>

      <div className="grid gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className={cn(
                  'relative border-dashed border-2 border-muted-foreground/30',
                  'hover:border-muted-foreground/50 transition-colors cursor-help'
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Server & Connection
                      </CardTitle>
                      <CardDescription>Homeserver details and dashboard connection</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Connection Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Connection Status:</span>
                    {isConfigured ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : isMockMode ? (
                      <Badge variant="secondary">
                        <Server className="h-3 w-3 mr-1" />
                        Mock Mode
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not Configured
                      </Badge>
                    )}
                  </div>

                  {/* Server Pubkey */}
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-sm text-muted-foreground">Homeserver Pubkey:</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground/70 italic truncate">
                        {homeserverPubkey}
                      </span>
                      {isPubkeyMock && (
                        <Badge variant="outline" className="text-xs font-normal border-dashed shrink-0">
                          <Info className="h-3 w-3 mr-1" />
                          Mock
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Server Version */}
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-sm text-muted-foreground">Version:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground/70 italic">{homeserverVersion}</span>
                      {isVersionMock && (
                        <Badge variant="outline" className="text-xs font-normal border-dashed shrink-0">
                          <Info className="h-3 w-3 mr-1" />
                          Mock
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Admin Endpoint */}
                  {adminBaseUrl && (
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Admin Endpoint:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {adminBaseUrl}
                      </code>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/20">
                    <p className="text-xs text-muted-foreground/60 italic">
                      Hover for implementation details
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm">
              <p className="text-sm">{MOCK_EXPLANATIONS.serverInfo}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

