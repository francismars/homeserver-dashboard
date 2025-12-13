'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import {
  Users,
  HardDrive,
  TrendingUp,
  Key,
  AlertTriangle,
  Info,
  BarChart3,
  Clock,
  Cpu,
  MemoryStick,
  Network,
  Activity,
  Download,
  Upload,
  Wifi,
} from 'lucide-react';
import { cn } from '@/libs/utils';
import type { DashboardUsageProps } from './DashboardUsage.types';

// Mock data
const MOCK_TOP_USERS = [
  { pubkey: 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o', storageMB: 8542.3, files: 1247, percentage: 18.9 },
  { pubkey: 'y9nncs6ihtjuaq8djhgfxwnqry9k6d0pu5lyf2tgobjfrzt0r7p', storageMB: 6234.1, files: 892, percentage: 13.8 },
  { pubkey: 'z0oodt7jiukvbr9ekihgyxorz0l7e1qv6mzg3uhpckgssau1s8q', storageMB: 5123.7, files: 654, percentage: 11.3 },
  { pubkey: 'a1ppeu8kjvlwcs0fljihzypsa1m8f2rw7nah4viqdlhhtbv2t9r', storageMB: 4231.2, files: 521, percentage: 9.4 },
  { pubkey: 'b2qqfv9lkmwxdt1gmkjiazqtb2n9g3sx8obij5wjremiuwc3u0s', storageMB: 3892.5, files: 478, percentage: 8.6 },
];

const MOCK_USERS_BY_INVITE = [
  { inviteCode: 'INV-2024-001', userCount: 23, percentage: 26.4 },
  { inviteCode: 'INV-2024-002', userCount: 18, percentage: 20.7 },
  { inviteCode: 'INV-2024-003', userCount: 15, percentage: 17.2 },
  { inviteCode: 'INV-2024-004', userCount: 12, percentage: 13.8 },
  { inviteCode: 'INV-2024-005', userCount: 8, percentage: 9.2 },
  { inviteCode: 'INV-2024-006', userCount: 5, percentage: 5.7 },
  { inviteCode: 'INV-2024-007', userCount: 3, percentage: 3.4 },
  { inviteCode: 'Other', userCount: 3, percentage: 3.4 },
];

const MOCK_STORAGE_DISTRIBUTION = [
  { range: '0-1 GB', userCount: 45, percentage: 51.7 },
  { range: '1-5 GB', userCount: 28, percentage: 32.2 },
  { range: '5-10 GB', userCount: 10, percentage: 11.5 },
  { range: '10+ GB', userCount: 4, percentage: 4.6 },
];

const MOCK_STORAGE_TRENDS = [
  { period: '1 week ago', storageMB: 38500 },
  { period: '2 weeks ago', storageMB: 36200 },
  { period: '3 weeks ago', storageMB: 34100 },
  { period: '4 weeks ago', storageMB: 32100 },
  { period: 'Now', storageMB: 45200 },
];

const MOCK_QUOTA_USERS = [
  { pubkey: 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o', quotaMB: 10240, usedMB: 8542.3, percentage: 83.4 },
  { pubkey: 'y9nncs6ihtjuaq8djhgfxwnqry9k6d0pu5lyf2tgobjfrzt0r7p', quotaMB: 10240, usedMB: 6234.1, percentage: 60.9 },
  { pubkey: 'z0oodt7jiukvbr9ekihgyxorz0l7e1qv6mzg3uhpckgssau1s8q', quotaMB: 10240, usedMB: 5123.7, percentage: 50.0 },
];

const MOCK_CPU_USAGE = {
  current: 34.2,
  average1m: 28.5,
  average5m: 31.2,
  average15m: 29.8,
  cores: 8,
  processes: [
    { name: 'pubky-homeserver', cpu: 18.5 },
    { name: 'postgres', cpu: 8.2 },
    { name: 'dht-node', cpu: 4.1 },
    { name: 'other', cpu: 3.4 },
  ],
};

const MOCK_RAM_USAGE = {
  totalGB: 16,
  usedGB: 9.2,
  availableGB: 6.8,
  cachedGB: 2.1,
  buffersGB: 0.5,
  swapTotalGB: 4,
  swapUsedGB: 0.3,
  processes: [
    { name: 'pubky-homeserver', ramMB: 2048 },
    { name: 'postgres', ramMB: 1024 },
    { name: 'dht-node', ramMB: 512 },
    { name: 'other', ramMB: 256 },
  ],
};

const MOCK_NETWORK_USAGE = {
  totalIncomingGB: 124.5,
  totalOutgoingGB: 89.3,
  incomingPerSecondMB: 2.4,
  outgoingPerSecondMB: 1.8,
  connections: 47,
  dhtTrafficMB: 12.3,
  relayTrafficMB: 45.2,
  apiRequestsPerSecond: 8.5,
  bandwidthTrend: [
    { period: '1h ago', incomingMB: 210, outgoingMB: 156 },
    { period: '2h ago', incomingMB: 198, outgoingMB: 142 },
    { period: '3h ago', incomingMB: 185, outgoingMB: 131 },
    { period: '4h ago', incomingMB: 172, outgoingMB: 125 },
    { period: 'Now', incomingMB: 240, outgoingMB: 180 },
  ],
};

const MOCK_STORAGE_INFO = {
  totalCapacityGB: 100,
  usedGB: 45.2,
  availableGB: 54.8,
  breakdown: {
    userData: 38.4,
    database: 4.5,
    systemFiles: 2.3,
  },
  growthRateGB: 2.1,
  estimatedDaysRemaining: 26,
};

const MOCK_EXPLANATIONS = {
  topUsers: `This is mock data. Top users by storage requires the backend to provide per-user storage breakdowns. The /usage endpoint could be extended to include a sorted list of users by storage usage, or this could be calculated by aggregating WebDAV directory sizes.`,
  usersByInvite: `This is mock data. Users by invite code requires tracking which invite code was used during signup. This would need to be stored in the database when users sign up and then aggregated for reporting. The backend would need to expose this data through the /usage endpoint.`,
  storageDistribution: `This is mock data. Storage distribution requires calculating how many users fall into each storage tier. This can be derived from per-user storage data, but requires backend aggregation or frontend calculation from user storage data.`,
  storageTrends: `This is mock data. Storage trends over time require historical data collection. The backend would need to track storage usage snapshots over time and expose this data through the /usage endpoint with time-series data.`,
  quotaUtilization: `This is mock data. Quota utilization requires knowing both the quota limit per user (from config) and current usage per user. This can be calculated by comparing user storage against configured quotas, but requires backend support for quota configuration and per-user storage tracking.`,
  cpuUsage: `This is mock data. CPU usage monitoring requires system metrics collection. The backend would need to expose CPU usage statistics through a metrics endpoint (e.g., /metrics or /usage/system). This could use system monitoring libraries or expose Prometheus-style metrics.`,
  ramUsage: `This is mock data. RAM/memory usage requires system metrics collection. The backend would need to track memory usage for the homeserver process and potentially other services (database, DHT node). This data would be exposed through a metrics endpoint.`,
  networkUsage: `This is mock data. Network usage monitoring requires tracking incoming/outgoing bandwidth, connection counts, and traffic breakdown by service (DHT, relays, API). The backend would need to implement network monitoring, possibly using system tools or network libraries to track interface statistics.`,
  storageCapacity: `This is mock data. Total storage capacity requires the backend to expose the total disk space available to the homeserver. This could be obtained from system calls (e.g., checking filesystem capacity) and exposed through the /info or /usage endpoint. The breakdown by category (user data, database, system files) would require tracking storage usage by component.`,
};

export function DashboardUsage({ usage, isLoading, error, totalDiskMB, info }: DashboardUsageProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading usage data</AlertTitle>
        <AlertDescription>{error.message || 'Failed to load usage information'}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!usage) {
    return null;
  }

  const formatStorage = (mb: number): string => {
    if (mb < 1) return `${(mb * 1024).toFixed(1)} KB`;
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage
            </CardTitle>
            <CardDescription>Disk usage and capacity information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Storage Used (Real Data Only) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Storage Used:</span>
                <span className="text-2xl font-bold">
                  {formatStorage(usage.totalDiskUsedMB)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Total disk space used by all users and system files
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mock Storage Capacity */}
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
                    <HardDrive className="h-5 w-5" />
                    Storage Capacity
                    <Badge variant="outline" className="text-xs font-normal border-dashed">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </CardTitle>
                  <CardDescription>Total capacity and breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Total Capacity */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Capacity:</span>
                      <span className="text-lg font-semibold text-muted-foreground/70 italic">
                        {formatStorage(MOCK_STORAGE_INFO.totalCapacityGB * 1024)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Used:</span>
                      <span className="text-lg font-semibold text-muted-foreground/70 italic">
                        {formatStorage(MOCK_STORAGE_INFO.usedGB * 1024)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Available:</span>
                      <span className="text-sm font-semibold text-muted-foreground/70 italic">
                        {formatStorage(MOCK_STORAGE_INFO.availableGB * 1024)}
                      </span>
                    </div>
                    <ProgressBar
                      value={MOCK_STORAGE_INFO.usedGB}
                      max={MOCK_STORAGE_INFO.totalCapacityGB}
                      showLabel={false}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground/70 italic">
                      <span>
                        {((MOCK_STORAGE_INFO.usedGB / MOCK_STORAGE_INFO.totalCapacityGB) * 100).toFixed(1)}% used
                      </span>
                      <span>
                        {formatStorage(MOCK_STORAGE_INFO.availableGB * 1024)} available
                      </span>
                    </div>
                  </div>

                  {/* Storage Breakdown */}
                  <div className="pt-3 border-t border-dashed border-muted-foreground/20 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground/70 italic mb-2">Breakdown:</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground/70 italic">User Data:</span>
                      <span className="font-semibold text-muted-foreground/70 italic">
                        {formatStorage(MOCK_STORAGE_INFO.breakdown.userData * 1024)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground/70 italic">Database:</span>
                      <span className="font-semibold text-muted-foreground/70 italic">
                        {formatStorage(MOCK_STORAGE_INFO.breakdown.database * 1024)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground/70 italic">System Files:</span>
                      <span className="font-semibold text-muted-foreground/70 italic">
                        {formatStorage(MOCK_STORAGE_INFO.breakdown.systemFiles * 1024)}
                      </span>
                    </div>
                  </div>

                  {/* Storage Health */}
                  <div className="pt-3 border-t border-dashed border-muted-foreground/20">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground/70 italic">Storage Health:</span>
                      {(MOCK_STORAGE_INFO.usedGB / MOCK_STORAGE_INFO.totalCapacityGB) > 0.9 ? (
                        <Badge variant="destructive" className="text-xs">Critical</Badge>
                      ) : (MOCK_STORAGE_INFO.usedGB / MOCK_STORAGE_INFO.totalCapacityGB) > 0.75 ? (
                        <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">Warning</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-600">Healthy</Badge>
                      )}
                    </div>
                  </div>

                  {/* Growth Projection */}
                  <div className="pt-3 border-t border-dashed border-muted-foreground/20">
                    <div className="flex items-center justify-between text-xs text-muted-foreground/70 italic">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3" />
                        <span>Growth (7d):</span>
                      </div>
                      <span className="font-mono">+{formatStorage(MOCK_STORAGE_INFO.growthRateGB * 1024)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground/60 italic">
                      Estimated capacity: {MOCK_STORAGE_INFO.estimatedDaysRemaining} days
                    </div>
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
              <p className="text-sm">{MOCK_EXPLANATIONS.storageCapacity}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Additional Usage Sections */}
      <TooltipProvider>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Top Users by Storage */}
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
                    Top Users by Storage
                    <Badge variant="outline" className="text-xs font-normal border-dashed">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </CardTitle>
                  <CardDescription>Users with highest storage usage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">User</TableHead>
                          <TableHead>Storage</TableHead>
                          <TableHead>Files</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MOCK_TOP_USERS.map((user, idx) => (
                          <TableRow key={user.pubkey}>
                            <TableCell className="font-mono text-xs text-muted-foreground/70 italic">
                              {user.pubkey.substring(0, 12)}...
                            </TableCell>
                            <TableCell className="text-muted-foreground/70 italic">
                              {formatStorage(user.storageMB)}
                            </TableCell>
                            <TableCell className="text-muted-foreground/70 italic">
                              {user.files}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground/70 italic">
                              {user.percentage}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
              <p className="text-sm">{MOCK_EXPLANATIONS.topUsers}</p>
            </TooltipContent>
          </Tooltip>

          {/* Users by Invite Code */}
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
                    Users by Invite Code
                    <Badge variant="outline" className="text-xs font-normal border-dashed">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </CardTitle>
                  <CardDescription>Signup code effectiveness</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invite Code</TableHead>
                          <TableHead>Users</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MOCK_USERS_BY_INVITE.map((item) => (
                          <TableRow key={item.inviteCode}>
                            <TableCell className="font-mono text-xs text-muted-foreground/70 italic">
                              {item.inviteCode}
                            </TableCell>
                            <TableCell className="text-muted-foreground/70 italic">
                              {item.userCount}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground/70 italic">
                              {item.percentage}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
              <p className="text-sm">{MOCK_EXPLANATIONS.usersByInvite}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Storage Distribution */}
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
                    Storage Distribution
                    <Badge variant="outline" className="text-xs font-normal border-dashed">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </CardTitle>
                  <CardDescription>Users by storage tier</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {MOCK_STORAGE_DISTRIBUTION.map((tier) => (
                    <div key={tier.range} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{tier.range}</span>
                        <span className="text-muted-foreground/70 italic">
                          {tier.userCount} users ({tier.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary/50"
                          style={{ width: `${tier.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/20">
                    <p className="text-xs text-muted-foreground/60 italic">
                      Hover for implementation details
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm">
              <p className="text-sm">{MOCK_EXPLANATIONS.storageDistribution}</p>
            </TooltipContent>
          </Tooltip>

          {/* Storage Trends */}
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
                    Storage Trends
                    <Badge variant="outline" className="text-xs font-normal border-dashed">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </CardTitle>
                  <CardDescription>Storage growth over time</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {MOCK_STORAGE_TRENDS.map((trend) => (
                    <div key={trend.period} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{trend.period}:</span>
                      </div>
                      <span className="text-sm font-mono text-muted-foreground/70 italic">
                        {formatStorage(trend.storageMB)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60 italic">
                      <TrendingUp className="h-3 w-3" />
                      <span>Growth: ~2.1 GB/week</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-dashed border-muted-foreground/20">
                    <p className="text-xs text-muted-foreground/60 italic">
                      Hover for implementation details
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm">
              <p className="text-sm">{MOCK_EXPLANATIONS.storageTrends}</p>
            </TooltipContent>
          </Tooltip>

          {/* Quota Utilization */}
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
                    Quota Utilization
                    <Badge variant="outline" className="text-xs font-normal border-dashed">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </CardTitle>
                  <CardDescription>Users approaching limits</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {MOCK_QUOTA_USERS.map((user) => (
                    <div key={user.pubkey} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-muted-foreground/70 italic">
                          {user.pubkey.substring(0, 16)}...
                        </span>
                        <span className={cn(
                          'text-xs font-semibold',
                          user.percentage >= 80 ? 'text-destructive' : 
                          user.percentage >= 60 ? 'text-yellow-500' : 
                          'text-muted-foreground/70'
                        )}>
                          {user.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full transition-all',
                            user.percentage >= 80 ? 'bg-destructive' : 
                            user.percentage >= 60 ? 'bg-yellow-500' : 
                            'bg-primary/50'
                          )}
                          style={{ width: `${user.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground/60">
                        <span>{formatStorage(user.usedMB)}</span>
                        <span>/ {formatStorage(user.quotaMB)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/20">
                    <p className="text-xs text-muted-foreground/60 italic">
                      Hover for implementation details
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm">
              <p className="text-sm">{MOCK_EXPLANATIONS.quotaUtilization}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* System Resources */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* CPU Usage */}
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
                    CPU Usage
                    <Badge variant="outline" className="text-xs font-normal border-dashed">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </CardTitle>
                  <CardDescription>Processor utilization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current:</span>
                      <span className="font-mono text-muted-foreground/70 italic">
                        {MOCK_CPU_USAGE.current.toFixed(1)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={MOCK_CPU_USAGE.current}
                      max={100}
                      showLabel={false}
                    />
                  </div>
                  <div className="space-y-2 pt-2 border-t border-dashed border-muted-foreground/20">
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>1m avg:</span>
                      <span className="italic">{MOCK_CPU_USAGE.average1m.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>5m avg:</span>
                      <span className="italic">{MOCK_CPU_USAGE.average5m.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>15m avg:</span>
                      <span className="italic">{MOCK_CPU_USAGE.average15m.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-dashed border-muted-foreground/20">
                    <div className="text-xs text-muted-foreground/70 italic">Top Processes:</div>
                    {MOCK_CPU_USAGE.processes.map((proc) => (
                      <div key={proc.name} className="flex justify-between text-xs">
                        <span className="text-muted-foreground/70 italic">{proc.name}:</span>
                        <span className="font-mono text-muted-foreground/70 italic">
                          {proc.cpu.toFixed(1)}%
                        </span>
                      </div>
                    ))}
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
              <p className="text-sm">{MOCK_EXPLANATIONS.cpuUsage}</p>
            </TooltipContent>
          </Tooltip>

          {/* RAM Usage */}
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
                    RAM Usage
                    <Badge variant="outline" className="text-xs font-normal border-dashed">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </CardTitle>
                  <CardDescription>Memory utilization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Used:</span>
                      <span className="font-mono text-muted-foreground/70 italic">
                        {MOCK_RAM_USAGE.usedGB.toFixed(1)} / {MOCK_RAM_USAGE.totalGB} GB
                      </span>
                    </div>
                    <ProgressBar
                      value={(MOCK_RAM_USAGE.usedGB / MOCK_RAM_USAGE.totalGB) * 100}
                      max={100}
                      showLabel={false}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>Available:</span>
                      <span className="italic">{MOCK_RAM_USAGE.availableGB.toFixed(1)} GB</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-dashed border-muted-foreground/20">
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>Cached:</span>
                      <span className="italic">{MOCK_RAM_USAGE.cachedGB.toFixed(1)} GB</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>Buffers:</span>
                      <span className="italic">{MOCK_RAM_USAGE.buffersGB.toFixed(1)} GB</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>Swap:</span>
                      <span className="italic">
                        {MOCK_RAM_USAGE.swapUsedGB.toFixed(1)} / {MOCK_RAM_USAGE.swapTotalGB} GB
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-dashed border-muted-foreground/20">
                    <div className="text-xs text-muted-foreground/70 italic">Top Processes:</div>
                    {MOCK_RAM_USAGE.processes.map((proc) => (
                      <div key={proc.name} className="flex justify-between text-xs">
                        <span className="text-muted-foreground/70 italic">{proc.name}:</span>
                        <span className="font-mono text-muted-foreground/70 italic">
                          {formatStorage(proc.ramMB / 1024)}
                        </span>
                      </div>
                    ))}
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
              <p className="text-sm">{MOCK_EXPLANATIONS.ramUsage}</p>
            </TooltipContent>
          </Tooltip>

          {/* Network Usage */}
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
                    Network Usage
                    <Badge variant="outline" className="text-xs font-normal border-dashed">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </CardTitle>
                  <CardDescription>Bandwidth and connections</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Incoming:</span>
                      </div>
                      <span className="text-sm font-mono text-muted-foreground/70 italic">
                        {MOCK_NETWORK_USAGE.incomingPerSecondMB.toFixed(1)} MB/s
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Outgoing:</span>
                      </div>
                      <span className="text-sm font-mono text-muted-foreground/70 italic">
                        {MOCK_NETWORK_USAGE.outgoingPerSecondMB.toFixed(1)} MB/s
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-dashed border-muted-foreground/20">
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>Total Incoming:</span>
                      <span className="italic">{MOCK_NETWORK_USAGE.totalIncomingGB.toFixed(1)} GB</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>Total Outgoing:</span>
                      <span className="italic">{MOCK_NETWORK_USAGE.totalOutgoingGB.toFixed(1)} GB</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>Connections:</span>
                      <span className="italic">{MOCK_NETWORK_USAGE.connections}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>API Req/s:</span>
                      <span className="italic">{MOCK_NETWORK_USAGE.apiRequestsPerSecond.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-dashed border-muted-foreground/20">
                    <div className="text-xs text-muted-foreground/70 italic">Traffic by Service:</div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground/70 italic">DHT:</span>
                      <span className="font-mono text-muted-foreground/70 italic">
                        {MOCK_NETWORK_USAGE.dhtTrafficMB.toFixed(1)} MB
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground/70 italic">Relays:</span>
                      <span className="font-mono text-muted-foreground/70 italic">
                        {MOCK_NETWORK_USAGE.relayTrafficMB.toFixed(1)} MB
                      </span>
                    </div>
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
              <p className="text-sm">{MOCK_EXPLANATIONS.networkUsage}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

