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
  Network,
  Database,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wifi,
} from 'lucide-react';
import { cn } from '@/libs/utils';
import type { DashboardOverviewProps } from './DashboardOverview.types';

// Mock data
const MOCK_SERVER_INFO = {
  address: 'https://homeserver.example.com',
  version: '0.1.0-dev',
  pubkey: 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o',
};

const MOCK_SYSTEM_HEALTH = {
  uptime: '12 days, 4 hours',
  databaseStatus: 'Connected',
  dhtStatus: 'Connected',
  relayStatus: 'Connected',
  storageHealth: 'Healthy',
};

// Mock explanations
const MOCK_EXPLANATIONS = {
  serverInfo: `This is mock data. The Server Information endpoint is not yet implemented in the homeserver admin API. To implement this, the backend needs to expose an endpoint that returns the homeserver's address, version, and public key. Currently, the /info endpoint only returns user counts and disk usage statistics.`,
  systemHealth: `This is mock data. System health monitoring requires backend endpoints to track server uptime, database connection status, DHT/relay connectivity, and storage health. These metrics would help administrators quickly identify system issues and ensure service availability.`,
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

      <div className="grid gap-4 md:grid-cols-2">
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
                        <Badge variant="outline" className="text-xs font-normal border-dashed">
                          <Info className="h-3 w-3 mr-1" />
                          Mock
                        </Badge>
                      </CardTitle>
                      <CardDescription>Homeserver details and dashboard connection</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Connection Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Connection Status:</span>
                    {(() => {
                      const adminBaseUrl = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || '';
                      const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
                      const adminMock = process.env.NEXT_PUBLIC_ADMIN_MOCK === '1';
                      const isMockMode = adminMock || !adminBaseUrl;
                      const hasConfig = adminBaseUrl && adminToken;
                      const isConfigured = hasConfig && !isMockMode;
                      
                      if (isConfigured) {
                        return (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        );
                      } else if (isMockMode) {
                        return (
                          <Badge variant="secondary">
                            <Server className="h-3 w-3 mr-1" />
                            Mock Mode
                          </Badge>
                        );
                      } else {
                        return (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Not Configured
                          </Badge>
                        );
                      }
                    })()}
                  </div>

                  {/* Server Pubkey */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Homeserver Pubkey:</span>
                    <span className="text-sm font-mono text-xs text-muted-foreground/70 italic">
                      {info.pubkey || MOCK_SERVER_INFO.pubkey}
                    </span>
                  </div>

                  {/* Server Version */}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Version:</span>
                    <span className="text-sm text-muted-foreground/70 italic">
                      {info.version || MOCK_SERVER_INFO.version}
                    </span>
                  </div>

                  {/* Admin Endpoint */}
                  {process.env.NEXT_PUBLIC_ADMIN_BASE_URL && (
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Admin Endpoint:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {process.env.NEXT_PUBLIC_ADMIN_BASE_URL}
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

        {/* System Health & Status */}
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
                  <CardTitle className="flex items-center gap-2">
                    System Health & Status
                    <Badge variant="outline" className="text-xs font-normal border-dashed">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </CardTitle>
                  <CardDescription>Server health and service status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Uptime:</span>
                    </div>
                    <span className="text-sm font-mono text-muted-foreground/70 italic">
                      {MOCK_SYSTEM_HEALTH.uptime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">Database:</span>
                    </div>
                    <span className="text-sm text-muted-foreground/70 italic">
                      {MOCK_SYSTEM_HEALTH.databaseStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">DHT:</span>
                    </div>
                    <span className="text-sm text-muted-foreground/70 italic">
                      {MOCK_SYSTEM_HEALTH.dhtStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">Relays:</span>
                    </div>
                    <span className="text-sm text-muted-foreground/70 italic">
                      {MOCK_SYSTEM_HEALTH.relayStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">Storage:</span>
                    </div>
                    <span className="text-sm text-muted-foreground/70 italic">
                      {MOCK_SYSTEM_HEALTH.storageHealth}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/20">
                    <p className="text-xs text-muted-foreground/60 italic">
                      Hover for implementation details
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm">
              <p className="text-sm">{MOCK_EXPLANATIONS.systemHealth}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

