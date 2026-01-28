'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  RefreshCw,
  Search,
  Filter,
  Download,
  Trash2,
  Info,
  AlertCircle,
  XCircle,
  Clock,
  Server,
  User,
  Shield,
  Key,
  Database,
  Network,
} from 'lucide-react';
import { cn } from '@/libs/utils';
import type { DashboardLogsProps } from './DashboardLogs.types';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogEventType = 'all' | 'auth' | 'user' | 'admin' | 'api' | 'database' | 'network' | 'storage' | 'system';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  eventType: LogEventType;
  message: string;
  details?: Record<string, unknown>;
  source?: string;
}

// Mock log data generator
const generateMockLogs = (count: number = 50): LogEntry[] => {
  const levels: LogLevel[] = ['info', 'warn', 'error', 'debug'];
  const eventTypes: Exclude<LogEventType, 'all'>[] = [
    'auth',
    'user',
    'admin',
    'api',
    'database',
    'network',
    'storage',
    'system',
  ];
  const messages = [
    'User signed in successfully',
    'Failed authentication attempt',
    'User account disabled',
    'User account enabled',
    'Admin API request received',
    'Database query executed',
    'Network connection established',
    'Storage quota exceeded',
    'System health check completed',
    'Configuration updated',
    'Invite token generated',
    'File uploaded',
    'File deleted',
    'Directory created',
    'Session created',
    'Session expired',
    'PKARR resolution successful',
    'DHT node connected',
    'Relay connection established',
    'Error processing request',
  ];

  const logs: LogEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const timestamp = new Date(now - (count - i) * 60000).toISOString(); // Spread over time

    logs.push({
      id: `log-${i}`,
      timestamp,
      level,
      eventType,
      message,
      source: eventType === 'api' ? '/admin/info' : undefined,
      details: level === 'error' ? { errorCode: 'E' + Math.floor(Math.random() * 1000) } : undefined,
    });
  }

  return logs;
};

const getLogLevelIcon = (level: LogLevel) => {
  switch (level) {
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'warn':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-500" />;
    case 'debug':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getLogLevelBadgeVariant = (level: LogLevel): 'default' | 'destructive' | 'secondary' | 'outline' => {
  switch (level) {
    case 'error':
      return 'destructive';
    case 'warn':
      return 'secondary';
    case 'info':
      return 'default';
    case 'debug':
      return 'outline';
    default:
      return 'outline';
  }
};

const getEventTypeIcon = (eventType: LogEventType) => {
  switch (eventType) {
    case 'auth':
      return <Key className="h-3 w-3" />;
    case 'user':
      return <User className="h-3 w-3" />;
    case 'admin':
      return <Shield className="h-3 w-3" />;
    case 'api':
      return <Server className="h-3 w-3" />;
    case 'database':
      return <Database className="h-3 w-3" />;
    case 'network':
      return <Network className="h-3 w-3" />;
    case 'storage':
      return <FileText className="h-3 w-3" />;
    case 'system':
      return <Server className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

export function DashboardLogs({ isLoading: _isLoading, error }: DashboardLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<LogEventType>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30); // seconds
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Load logs
  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      // In real implementation, this would call the admin API
      // const response = await adminService.getLogs({ level, eventType, limit: 1000 });

      // Mock implementation
      await new Promise((resolve) => setTimeout(resolve, 500));
      const mockLogs = generateMockLogs(100);
      setLogs(mockLogs);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  // Load logs on mount
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh && autoRefreshInterval > 0) {
      autoRefreshRef.current = setInterval(() => {
        loadLogs();
      }, autoRefreshInterval * 1000);
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    }

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [autoRefresh, autoRefreshInterval, loadLogs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Level filter
      if (levelFilter !== 'all' && log.level !== levelFilter) {
        return false;
      }

      // Event type filter
      if (eventTypeFilter !== 'all' && log.eventType !== eventTypeFilter) {
        return false;
      }

      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          log.message.toLowerCase().includes(query) ||
          log.source?.toLowerCase().includes(query) ||
          (log.details && JSON.stringify(log.details).toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [logs, levelFilter, eventTypeFilter, searchQuery]);

  const handleClearLogs = useCallback(() => {
    setIsClearDialogOpen(true);
  }, []);

  const handleConfirmClear = useCallback(() => {
    setLogs([]);
    setIsClearDialogOpen(false);
  }, []);

  const handleDownloadLogs = useCallback(() => {
    const logText = filteredLogs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.eventType}] ${log.message}${log.source ? ` (${log.source})` : ''}${log.details ? ` ${JSON.stringify(log.details)}` : ''}`,
      )
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `homeserver-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading logs</AlertTitle>
        <AlertDescription>{error.message || 'Failed to load logs'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Homeserver Logs
                <Badge variant="outline" className="border-dashed text-xs font-normal">
                  <Info className="mr-1 h-3 w-3" />
                  Soon
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">View and filter homeserver event logs</CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={loadLogs} disabled={isLoadingLogs} aria-label="Refresh logs">
                <RefreshCw className={cn('h-4 w-4', isLoadingLogs && 'animate-spin')} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadLogs}
                disabled={filteredLogs.length === 0}
                aria-label="Download logs"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearLogs}
                disabled={logs.length === 0}
                aria-label="Clear logs"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Inset separator between the header and the content (lighter than a full divider) */}
        <div className="mx-6 h-px bg-border/60" />

        <CardContent className="space-y-4 pt-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as LogLevel | 'all')}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
            <Select value={eventTypeFilter} onValueChange={(value) => setEventTypeFilter(value as LogEventType)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="auth">Authentication</SelectItem>
                <SelectItem value="user">User Management</SelectItem>
                <SelectItem value="admin">Admin Operations</SelectItem>
                <SelectItem value="api">API Requests</SelectItem>
                <SelectItem value="database">Database</SelectItem>
                <SelectItem value="network">Network</SelectItem>
                <SelectItem value="storage">Storage</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auto-refresh controls */}
          <div className="flex flex-col gap-3 rounded-md bg-muted/50 p-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoRefresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="autoRefresh" className="cursor-pointer text-xs sm:text-sm">
                Auto-refresh every
              </Label>
            </div>
            <Select
              value={autoRefreshInterval.toString()}
              onValueChange={(value) => setAutoRefreshInterval(Number(value))}
              disabled={!autoRefresh}
            >
              <SelectTrigger className="w-full sm:w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10s</SelectItem>
                <SelectItem value="30">30s</SelectItem>
                <SelectItem value="60">60s</SelectItem>
                <SelectItem value="300">5m</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} shown
            </span>
          </div>

          {/* Logs display */}
          {isLoadingLogs && logs.length === 0 ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>No logs found</p>
              {logs.length > 0 && (
                <p className="mt-2 text-sm">
                  Try adjusting your filters (showing {filteredLogs.length} of {logs.length} logs)
                </p>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[400px] w-full rounded-md border p-3 sm:h-[500px] sm:p-4 md:h-[600px]">
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      'flex items-start gap-2 rounded-md border p-2 text-xs sm:gap-3 sm:p-3 sm:text-sm',
                      log.level === 'error' && 'border-destructive/20 bg-destructive/10',
                      log.level === 'warn' && 'border-yellow-500/20 bg-yellow-500/10',
                      log.level === 'info' && 'border-blue-500/20 bg-blue-500/10',
                      log.level === 'debug' && 'border-muted-foreground/20 bg-muted',
                    )}
                  >
                    <div className="mt-0.5 shrink-0">{getLogLevelIcon(log.level)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Badge variant={getLogLevelBadgeVariant(log.level)} className="text-xs">
                          {log.level.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1 text-xs">
                          {getEventTypeIcon(log.eventType)}
                          <span className="hidden sm:inline">{log.eventType}</span>
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="hidden sm:inline">{formatTimestamp(log.timestamp)}</span>
                          <span className="sm:hidden">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </span>
                        {log.source && (
                          <code className="ml-auto max-w-[120px] truncate text-xs text-muted-foreground sm:max-w-none">
                            {log.source}
                          </code>
                        )}
                      </div>
                      <p className="wrap-break-word text-foreground">{log.message}</p>
                      {log.details && (
                        <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="border-t pt-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-dashed text-xs font-normal">
              <Info className="mr-1 h-3 w-3" />
              Soon
            </Badge>
            <span className="ml-2">
              In production, this would fetch logs from the homeserver&apos;s logging endpoint. The backend needs to
              expose a logs API endpoint.
            </span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Logs</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all logs? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleConfirmClear}>
              Clear Logs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
