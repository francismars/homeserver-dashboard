'use client';

import { useState } from 'react';
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
import { ProgressBar } from '@/components/atoms/ProgressBar';
import {
  HardDrive,
  TrendingUp,
  Info,
  Clock,
  Cpu,
  MemoryStick,
  Network,
  Download,
  Upload,
} from 'lucide-react';
import { cn } from '@/libs/utils';
import type { DashboardUsageProps } from './DashboardUsage.types';

// Mock data
const MOCK_TRENDS = [
  { period: '4w ago', storageGB: 31.3, cpuPercent: 27.3, ramGB: 8.1, networkGB: 181.2 },
  { period: '3w ago', storageGB: 33.3, cpuPercent: 29.8, ramGB: 8.8, networkGB: 194.3 },
  { period: '2w ago', storageGB: 37.6, cpuPercent: 31.2, ramGB: 8.2, networkGB: 186.8 },
  { period: '1w ago', storageGB: 37.6, cpuPercent: 28.5, ramGB: 8.5, networkGB: 197.3 },
  { period: 'Now', storageGB: 44.1, cpuPercent: 34.2, ramGB: 9.2, networkGB: 213.8 },
];

type TrendType = 'storage' | 'cpu' | 'ram' | 'network';

// Simple line chart component
const SimpleLineChart = ({ 
  data, 
  maxValue, 
  formatValue 
}: { 
  data: number[]; 
  maxValue: number; 
  formatValue: (val: number) => string;
}) => {
  // Use a base width for calculations, but make it responsive
  const baseWidth = 400; // Increased base width for better scaling
  const height = 200; // Increased height to match storage capacity card
  const padding = { top: 15, right: 15, bottom: 25, left: 40 };
  const chartWidth = baseWidth - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((value, index) => {
    const x = padding.left + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
    return { x, y, value };
  });

  const pathData = points.length > 0 
    ? `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`
    : '';

  // Area gradient path
  const areaPath = points.length > 0
    ? `${pathData} L ${points[points.length - 1].x},${padding.top + chartHeight} L ${points[0].x},${padding.top + chartHeight} Z`
    : '';

  return (
    <div className="w-full">
      <svg 
        width="100%" 
        height={height} 
        viewBox={`0 0 ${baseWidth} ${height}`} 
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* Y-axis labels */}
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + chartHeight - (ratio * chartHeight);
          const value = maxValue * ratio;
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={baseWidth - padding.right}
                y2={y}
                stroke="currentColor"
                strokeWidth="0.5"
                opacity="0.1"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="text-[10px] fill-muted-foreground"
              >
                {formatValue(value)}
              </text>
            </g>
          );
        })}
        
        {/* Area fill */}
        {areaPath && (
          <path
            d={areaPath}
            fill="url(#areaGradient)"
            className="text-primary"
          />
        )}
        
        {/* Chart line */}
        {pathData && (
          <path
            d={pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          />
        )}
        
        {/* Data points */}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill="currentColor"
            stroke="hsl(var(--background))"
            strokeWidth="2"
            className="text-primary"
          />
        ))}
        
        {/* Period labels (X-axis) */}
        {points.map((point, index) => {
          const period = MOCK_TRENDS[index]?.period || '';
          return (
            <text
              key={index}
              x={point.x}
              y={height - 8}
              textAnchor="middle"
              className="text-[10px] fill-muted-foreground"
            >
              {period}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

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
  storageTrends: `This is mock data. Usage trends over time require historical data collection. The backend would need to track storage, CPU, RAM, and network usage snapshots over time and expose this data through the /usage endpoint with time-series data. This helps administrators identify patterns, plan capacity, and detect anomalies.`,
  cpuUsage: `This is mock data. CPU usage monitoring requires system metrics collection. The backend would need to expose CPU usage statistics through a metrics endpoint (e.g., /metrics or /usage/system). This could use system monitoring libraries or expose Prometheus-style metrics.`,
  ramUsage: `This is mock data. RAM/memory usage requires system metrics collection. The backend would need to track memory usage for the homeserver process and potentially other services (database, DHT node). This data would be exposed through a metrics endpoint.`,
  networkUsage: `This is mock data. Network usage monitoring requires tracking incoming/outgoing bandwidth, connection counts, and traffic breakdown by service (DHT, relays, API). The backend would need to implement network monitoring, possibly using system tools or network libraries to track interface statistics.`,
  storageCapacity: `This is mock data. Total storage capacity requires the backend to expose the total disk space available to the homeserver. This could be obtained from system calls (e.g., checking filesystem capacity) and exposed through the /info or /usage endpoint. The breakdown by category (user data, database, system files) would require tracking storage usage by component.`,
};

// Combined trend chart with switcher component
function TrendChartWithSwitcher() {
  const [selectedTrend, setSelectedTrend] = useState<TrendType>('storage');

  const trends: { type: TrendType; icon: React.ReactNode; label: string }[] = [
    { type: 'storage', icon: <HardDrive className="h-4 w-4" />, label: 'Storage' },
    { type: 'cpu', icon: <Cpu className="h-4 w-4" />, label: 'CPU' },
    { type: 'ram', icon: <MemoryStick className="h-4 w-4" />, label: 'RAM' },
    { type: 'network', icon: <Network className="h-4 w-4" />, label: 'Network' },
  ];

  const getTrendData = () => {
    switch (selectedTrend) {
      case 'storage':
        return {
          data: MOCK_TRENDS.map(t => t.storageGB),
          maxValue: Math.max(...MOCK_TRENDS.map(t => t.storageGB)) * 1.2,
          formatValue: (val: number) => `${val.toFixed(1)} GB`,
          label: 'Storage',
          icon: <HardDrive className="h-4 w-4" />,
        };
      case 'cpu':
        return {
          data: MOCK_TRENDS.map(t => t.cpuPercent),
          maxValue: 100,
          formatValue: (val: number) => `${val.toFixed(1)}%`,
          label: 'CPU Usage',
          icon: <Cpu className="h-4 w-4" />,
        };
      case 'ram':
        return {
          data: MOCK_TRENDS.map(t => t.ramGB),
          maxValue: Math.max(...MOCK_TRENDS.map(t => t.ramGB)) * 1.2,
          formatValue: (val: number) => `${val.toFixed(1)} GB`,
          label: 'RAM Usage',
          icon: <MemoryStick className="h-4 w-4" />,
        };
      case 'network':
        return {
          data: MOCK_TRENDS.map(t => t.networkGB),
          maxValue: Math.max(...MOCK_TRENDS.map(t => t.networkGB)) * 1.2,
          formatValue: (val: number) => `${val.toFixed(1)} GB`,
          label: 'Network Traffic',
          icon: <Network className="h-4 w-4" />,
        };
    }
  };

  const trendData = getTrendData();

  // Calculate trend statistics
  const currentValue = trendData.data[trendData.data.length - 1];
  const previousValue = trendData.data[trendData.data.length - 2];
  const change = currentValue - previousValue;
  const changePercent = previousValue !== 0 ? ((change / previousValue) * 100) : 0;
  const isPositive = change >= 0;

  return (
    <div className="space-y-4">
      {/* Header with icons and total/percentage */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            {trends.map((trend) => (
              <button
                key={trend.type}
                onClick={() => setSelectedTrend(trend.type)}
                className={cn(
                  'p-1.5 rounded transition-all',
                  selectedTrend === trend.type
                    ? 'bg-primary text-primary-foreground shadow-sm scale-110'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title={trend.label}
              >
                {trend.icon}
              </button>
            ))}
          </div>
          <span className="text-sm font-medium text-muted-foreground">{trendData.label}</span>
        </div>
        {/* Current value and change */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{trendData.formatValue(currentValue)}</span>
            <div className={cn(
              'flex items-center gap-1 text-xs font-medium',
              isPositive ? 'text-green-600' : 'text-red-600'
            )}>
              <TrendingUp className={cn('h-3 w-3', !isPositive && 'rotate-180')} />
              <span>{isPositive ? '+' : ''}{changePercent.toFixed(1)}%</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">vs previous period</p>
        </div>
      </div>

      {/* Chart */}
      <div className="pt-2">
        <SimpleLineChart
          data={trendData.data}
          maxValue={trendData.maxValue}
          formatValue={trendData.formatValue}
        />
      </div>
    </div>
  );
}

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
      <TooltipProvider>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Mock Storage Capacity */}
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
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-muted-foreground/70 italic">Breakdown:</div>
                      {(MOCK_STORAGE_INFO.usedGB / MOCK_STORAGE_INFO.totalCapacityGB) > 0.9 ? (
                        <Badge variant="destructive" className="text-xs">Critical</Badge>
                      ) : (MOCK_STORAGE_INFO.usedGB / MOCK_STORAGE_INFO.totalCapacityGB) > 0.75 ? (
                        <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">Warning</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-600">Healthy</Badge>
                      )}
                    </div>
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

          {/* Trends */}
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
                        Trends
                        <Badge variant="outline" className="text-xs font-normal border-dashed">
                          <Info className="h-3 w-3 mr-1" />
                          Mock
                        </Badge>
                      </CardTitle>
                      <CardDescription>Usage trends over time</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <TrendChartWithSwitcher />
                  <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/20">
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
        </div>
      </TooltipProvider>

      {/* System Resources */}
      <TooltipProvider>
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

