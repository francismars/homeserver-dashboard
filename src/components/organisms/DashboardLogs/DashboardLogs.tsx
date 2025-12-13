'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ScrollArea,
} from '@/components/ui/scroll-area';
import {
  FileText,
  RefreshCw,
  Search,
  Filter,
  Download,
  Trash2,
  Info,
  AlertCircle,
  CheckCircle2,
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
export type LogEventType = 
  | 'all'
  | 'auth'
  | 'user'
  | 'admin'
  | 'api'
  | 'database'
  | 'network'
  | 'storage'
  | 'system';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  eventType: LogEventType;
  message: string;
  details?: Record<string, any>;
  source?: string;
}

// Mock log data generator
const generateMockLogs = (count: number = 50): LogEntry[] => {
  const levels: LogLevel[] = ['info', 'warn', 'error', 'debug'];
  const eventTypes: Exclude<LogEventType, 'all'>[] = ['auth', 'user', 'admin', 'api', 'database', 'network', 'storage', 'system'];
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

const getLogLevelBadgeVariant = (level: LogLevel): "default" | "destructive" | "secondary" | "outline" => {
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

export function DashboardLogs({ isLoading, error }: DashboardLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<LogEventType>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30); // seconds
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Load logs
  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      // In real implementation, this would call the admin API
      // const response = await adminService.getLogs({ level, eventType, limit: 1000 });
      
      // Mock implementation
      await new Promise(resolve => setTimeout(resolve, 500));
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
    return logs.filter(log => {
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
          log.details && JSON.stringify(log.details).toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [logs, levelFilter, eventTypeFilter, searchQuery]);

  const handleClearLogs = useCallback(() => {
    if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      setLogs([]);
    }
  }, []);

  const handleDownloadLogs = useCallback(() => {
    const logText = filteredLogs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.eventType}] ${log.message}${log.source ? ` (${log.source})` : ''}${log.details ? ` ${JSON.stringify(log.details)}` : ''}`
    ).join('\n');

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
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Homeserver Logs
              </CardTitle>
              <CardDescription>View and filter homeserver event logs</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadLogs}
                disabled={isLoadingLogs}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', isLoadingLogs && 'animate-spin')} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadLogs}
                disabled={filteredLogs.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearLogs}
                disabled={logs.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as LogLevel | 'all')}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
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
                <Filter className="h-4 w-4 mr-2" />
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
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoRefresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="autoRefresh" className="text-sm cursor-pointer">
                Auto-refresh every
              </Label>
            </div>
            <Select
              value={autoRefreshInterval.toString()}
              onValueChange={(value) => setAutoRefreshInterval(Number(value))}
              disabled={!autoRefresh}
            >
              <SelectTrigger className="w-[100px]">
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
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No logs found</p>
              {logs.length > 0 && (
                <p className="text-sm mt-2">
                  Try adjusting your filters (showing {filteredLogs.length} of {logs.length} logs)
                </p>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[600px] w-full rounded-md border p-4">
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-md border text-sm',
                      log.level === 'error' && 'bg-destructive/10 border-destructive/20',
                      log.level === 'warn' && 'bg-yellow-500/10 border-yellow-500/20',
                      log.level === 'info' && 'bg-blue-500/10 border-blue-500/20',
                      log.level === 'debug' && 'bg-muted border-muted-foreground/20'
                    )}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getLogLevelIcon(log.level)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getLogLevelBadgeVariant(log.level)} className="text-xs">
                          {log.level.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          {getEventTypeIcon(log.eventType)}
                          {log.eventType}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(log.timestamp)}
                        </span>
                        {log.source && (
                          <code className="text-xs text-muted-foreground ml-auto">
                            {log.source}
                          </code>
                        )}
                      </div>
                      <p className="text-foreground">{log.message}</p>
                      {log.details && (
                        <pre className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="text-xs text-muted-foreground pt-2 border-t border-dashed">
            <Badge variant="outline" className="text-xs font-normal border-dashed">
              <Info className="h-3 w-3 mr-1" />
              Mock
            </Badge>
            <span className="ml-2">
              In production, this would fetch logs from the homeserver's logging endpoint. The backend needs to expose a logs API endpoint.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

