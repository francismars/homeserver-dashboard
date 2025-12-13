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
import { EnvInfo } from '@/components/molecules/EnvInfo';
import {
  Users,
  HardDrive,
  Shield,
  Key,
  Server,
  Info,
  Activity,
  Network,
  Database,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Globe,
  Wifi,
  WifiOff,
  TrendingUp,
  FileText,
  Settings as SettingsIcon,
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

const MOCK_NETWORK_INFO = {
  networkMode: 'Mainnet',
  dhtNodes: 847,
  relayConnections: 2,
  pkarrStatus: 'Active',
  homeserverPubkey: 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o',
};

const MOCK_STORAGE_DETAILS = {
  totalCapacity: '100 GB',
  used: '45.2 GB',
  available: '54.8 GB',
  quotaPerUser: '10 GB',
  averagePerUser: '2.1 GB',
  largestUser: '8.5 GB',
};

const MOCK_ACTIVITY = {
  activeUsers24h: 23,
  activeUsers7d: 87,
  recentSignups7d: 5,
  recentSignups30d: 18,
  recentUploads24h: 142,
  apiRequestsPerMinute: 12,
};

const MOCK_CONFIG = {
  signupMode: 'Token Required',
  storageQuotas: 'Enabled',
  driveEnabled: 'Yes',
  storageEnabled: 'Yes',
  metricsEnabled: 'No',
  adminApiStatus: 'Active',
};

// Mock explanations
const MOCK_EXPLANATIONS = {
  serverInfo: `This is mock data. The Server Information endpoint is not yet implemented in the homeserver admin API. To implement this, the backend needs to expose an endpoint that returns the homeserver's address, version, and public key. Currently, the /info endpoint only returns user counts and disk usage statistics.`,
  systemHealth: `This is mock data. System health monitoring requires backend endpoints to track server uptime, database connection status, DHT/relay connectivity, and storage health. These metrics would help administrators quickly identify system issues and ensure service availability.`,
  networkInfo: `This is mock data. Network information requires the backend to expose DHT node counts, relay connection status, PKARR resolution status, and network mode (mainnet/testnet). This helps administrators understand the homeserver's network connectivity and discoverability.`,
  storageDetails: `This is mock data. Detailed storage information requires backend endpoints to provide total capacity, per-user storage breakdowns, quota information, and largest users. This helps administrators manage storage resources and identify users approaching limits.`,
  activity: `This is mock data. Activity metrics require backend tracking of user activity, signup rates, file uploads, and API request rates. This helps administrators understand usage patterns and system load.`,
  config: `This is mock data. Configuration summary requires the backend to expose current settings like signup mode, enabled features, and service status. This provides a quick overview of homeserver configuration without navigating to the config tab.`,
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
                        Server Information
                        <Badge variant="outline" className="text-xs font-normal border-dashed">
                          <Info className="h-3 w-3 mr-1" />
                          Mock
                        </Badge>
                      </CardTitle>
                      <CardDescription>Basic homeserver details</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Address:</span>
                    <span className="text-sm font-mono text-muted-foreground/70 italic">
                      {info.address || MOCK_SERVER_INFO.address}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Version:</span>
                    <span className="text-sm text-muted-foreground/70 italic">
                      {info.version || MOCK_SERVER_INFO.version}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Pubkey:</span>
                    <span className="text-sm font-mono text-xs text-muted-foreground/70 italic">
                      {info.pubkey || MOCK_SERVER_INFO.pubkey}
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
              <p className="text-sm">{MOCK_EXPLANATIONS.serverInfo}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <EnvInfo />
      </div>

      {/* Additional Information Sections */}
      <TooltipProvider>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

          {/* Network Information */}
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
                  Network Information
                  <Badge variant="outline" className="text-xs font-normal border-dashed">
                    <Info className="h-3 w-3 mr-1" />
                    Mock
                  </Badge>
                </CardTitle>
                <CardDescription>DHT and relay connectivity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Network Mode:</span>
                  <Badge variant="outline" className="text-xs">
                    {MOCK_NETWORK_INFO.networkMode}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">DHT Nodes:</span>
                  <span className="text-sm font-mono text-muted-foreground/70 italic">
                    {MOCK_NETWORK_INFO.dhtNodes.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Relay Connections:</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_NETWORK_INFO.relayConnections}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">PKARR Status:</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_NETWORK_INFO.pkarrStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Homeserver Pubkey:</span>
                  <span className="text-sm font-mono text-xs text-muted-foreground/70 italic">
                    {MOCK_NETWORK_INFO.homeserverPubkey.substring(0, 16)}...
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
            <p className="text-sm">{MOCK_EXPLANATIONS.networkInfo}</p>
          </TooltipContent>
          </Tooltip>

          {/* Storage Details */}
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
                  Storage Details
                  <Badge variant="outline" className="text-xs font-normal border-dashed">
                    <Info className="h-3 w-3 mr-1" />
                    Mock
                  </Badge>
                </CardTitle>
                <CardDescription>Storage capacity and usage breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Capacity:</span>
                  <span className="text-sm font-mono text-muted-foreground/70 italic">
                    {MOCK_STORAGE_DETAILS.totalCapacity}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Used:</span>
                  <span className="text-sm font-mono text-muted-foreground/70 italic">
                    {MOCK_STORAGE_DETAILS.used}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Available:</span>
                  <span className="text-sm font-mono text-muted-foreground/70 italic">
                    {MOCK_STORAGE_DETAILS.available}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Quota per User:</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_STORAGE_DETAILS.quotaPerUser}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average per User:</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_STORAGE_DETAILS.averagePerUser}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Largest User:</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_STORAGE_DETAILS.largestUser}
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
            <p className="text-sm">{MOCK_EXPLANATIONS.storageDetails}</p>
          </TooltipContent>
          </Tooltip>

          {/* Activity Metrics */}
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
                  Activity Metrics
                  <Badge variant="outline" className="text-xs font-normal border-dashed">
                    <Info className="h-3 w-3 mr-1" />
                    Mock
                  </Badge>
                </CardTitle>
                <CardDescription>User activity and system usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active Users (24h):</span>
                  <span className="text-sm font-mono text-muted-foreground/70 italic">
                    {MOCK_ACTIVITY.activeUsers24h}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active Users (7d):</span>
                  <span className="text-sm font-mono text-muted-foreground/70 italic">
                    {MOCK_ACTIVITY.activeUsers7d}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Recent Signups (7d):</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_ACTIVITY.recentSignups7d}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Recent Signups (30d):</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_ACTIVITY.recentSignups30d}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Uploads (24h):</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_ACTIVITY.recentUploads24h}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">API Requests/min:</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_ACTIVITY.apiRequestsPerMinute}
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
            <p className="text-sm">{MOCK_EXPLANATIONS.activity}</p>
          </TooltipContent>
          </Tooltip>

          {/* Configuration Summary */}
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
                  Configuration Summary
                  <Badge variant="outline" className="text-xs font-normal border-dashed">
                    <Info className="h-3 w-3 mr-1" />
                    Mock
                  </Badge>
                </CardTitle>
                <CardDescription>Key homeserver settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Signup Mode:</span>
                  <Badge variant="outline" className="text-xs">
                    {MOCK_CONFIG.signupMode}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Storage Quotas:</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_CONFIG.storageQuotas}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Drive Enabled:</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_CONFIG.driveEnabled}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Storage Enabled:</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_CONFIG.storageEnabled}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Metrics Enabled:</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_CONFIG.metricsEnabled}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Admin API:</span>
                  <span className="text-sm text-muted-foreground/70 italic">
                    {MOCK_CONFIG.adminApiStatus}
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
            <p className="text-sm">{MOCK_EXPLANATIONS.config}</p>
          </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

