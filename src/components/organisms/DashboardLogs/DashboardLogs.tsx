'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Download, Pause, Play, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { usePolling } from '@/hooks/usePolling';
import type { LevelFilter, LogEntry, LogsResponse } from './DashboardLogs.types';

const POLL_INTERVAL_MS = 5_000;
const LINES = 500;
const LEVEL_OPTIONS: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'All levels' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
];

const LEVEL_BADGE: Record<string, string> = {
  trace: 'bg-muted text-muted-foreground',
  debug: 'bg-muted text-muted-foreground',
  info: 'bg-blue-500/10 text-blue-300',
  warn: 'bg-amber-500/15 text-amber-300',
  error: 'bg-red-500/15 text-red-300',
};

function fmtTs(ts: string | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  // HH:MM:SS.mmm
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function fmtFields(fields: Record<string, unknown> | undefined): string {
  if (!fields) return '';
  const pairs = Object.entries(fields)
    .filter(([k]) => k !== 'message' && k !== 'msg')
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
  return pairs.join(' ');
}

export function DashboardLogs() {
  const [items, setItems] = useState<LogEntry[]>([]);
  const [partial, setPartial] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [level, setLevel] = useState<LevelFilter>('all');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Shared GET /api/logs for both the live view and the download; honors the
  // active level filter. Throws the upstream error (or a fallback) on failure.
  const fetchLogsData = useCallback(
    async (lines: number, failMessage: string): Promise<LogsResponse> => {
      const params = new URLSearchParams({ lines: String(lines) });
      if (level !== 'all') params.set('level', level);
      const response = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || `${failMessage} (${response.status})`);
      }
      return (await response.json()) as LogsResponse;
    },
    [level],
  );

  const fetchLogs = useCallback(async () => {
    try {
      const data = await fetchLogsData(LINES, 'Failed to fetch logs');
      if (!isMountedRef.current) return;
      setItems(data.items);
      setPartial(Boolean(data.partial));
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      if (isMountedRef.current) setIsInitialLoading(false);
    }
  }, [fetchLogsData]);

  useEffect(() => {
    isMountedRef.current = true;
    void fetchLogs();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchLogs]);

  usePolling(fetchLogs, POLL_INTERVAL_MS, { enabled: !isPaused });

  const handleDownload = useCallback(async () => {
    setDownloadError(null);
    try {
      const data = await fetchLogsData(5000, 'Download failed');
      const blob = new Blob([data.items.map((item) => JSON.stringify(item)).join('\n')], {
        type: 'application/x-ndjson',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homeserver-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    }
  }, [fetchLogsData]);

  // Stable row keys on a sliding window: keyed by content plus an occurrence
  // counter for duplicate lines, instead of the array index, so rows keep
  // their identity as old lines fall off the top between polls.
  const rendered = useMemo(() => {
    const seen = new Map<string, number>();
    return items.map((entry) => {
      const base = `${entry.ts ?? ''}|${entry.target ?? ''}|${entry.raw ?? entry.msg ?? ''}`;
      const occurrence = seen.get(base) ?? 0;
      seen.set(base, occurrence + 1);
      const key = occurrence === 0 ? base : `${base}|${occurrence}`;
      const isRaw = entry.raw !== undefined;
      const lvl = (entry.level ?? '').toLowerCase();
      const badgeClass = LEVEL_BADGE[lvl] ?? 'bg-muted text-muted-foreground';
      const fieldsText = entry.fields ? fmtFields(entry.fields) : '';
      return (
        <div
          key={key}
          className="flex gap-2 border-b border-border/40 px-3 py-1 font-mono text-xs leading-relaxed hover:bg-muted/30"
          data-testid="logs-row"
        >
          <span className="shrink-0 text-muted-foreground tabular-nums">{fmtTs(entry.ts)}</span>
          {!isRaw && (
            <Badge variant="outline" className={cn('h-5 shrink-0 px-1.5 uppercase', badgeClass)}>
              {entry.level ?? '?'}
            </Badge>
          )}
          {entry.target && (
            <span className="max-w-[14rem] shrink-0 truncate text-muted-foreground/80">{entry.target}</span>
          )}
          <span className="break-words text-foreground/90">
            {entry.raw ?? entry.msg ?? ''}
            {fieldsText && <span className="ml-2 text-muted-foreground/80">{fieldsText}</span>}
          </span>
        </div>
      );
    });
  }, [items]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>Logs</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={level} onValueChange={(v) => setLevel(v as LevelFilter)}>
            <SelectTrigger className="h-8 w-28" data-testid="logs-level-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_OPTIONS.map((l) => (
                <SelectItem key={l.value} value={l.value} data-testid={`logs-level-${l.value}`}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setIsPaused((p) => !p)} data-testid="logs-pause-toggle">
            {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
            <span className="ml-1.5">{isPaused ? 'Resume' : 'Pause'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void fetchLogs()} data-testid="logs-refresh">
            <RefreshCw className="size-4" />
            <span className="ml-1.5">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleDownload()} data-testid="logs-download">
            <Download className="size-4" />
            <span className="ml-1.5">Download</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground/70" data-testid="logs-triage-note">
          Warnings during startup are normal.
        </p>
        {partial && (
          <Alert variant="default" className="mb-3">
            <AlertCircle className="size-4" />
            <AlertTitle>Partial tail</AlertTitle>
            <AlertDescription>
              The log file rotated while we were reading. Showing the most recent log lines; refresh to retry against
              the fresh file.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" className="mb-3" data-testid="logs-error">
            <AlertCircle className="size-4" />
            <AlertTitle>Couldn&apos;t load logs</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {downloadError && (
          <Alert variant="destructive" className="mb-3" data-testid="logs-download-error">
            <AlertCircle className="size-4" />
            <AlertTitle>Couldn&apos;t download logs</AlertTitle>
            <AlertDescription>{downloadError}</AlertDescription>
          </Alert>
        )}
        {isInitialLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div
            className="rounded border border-dashed border-border/60 py-12 text-center text-sm text-muted-foreground"
            data-testid="logs-empty"
          >
            No log entries to display.
          </div>
        ) : (
          <div
            className="max-h-[640px] overflow-y-auto rounded border border-border/60 bg-background/40"
            data-testid="logs-viewport"
          >
            {rendered}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
