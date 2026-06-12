'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Copy, ExternalLink, FlaskConical, RefreshCw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

type DriveStatus = 'stopped' | 'starting' | 'running';

/**
 * "Test drive": temporary public URL via a Cloudflare Quick Tunnel. No
 * account, no domain. The URL is random and dies on stop/restart/30-minute
 * expiry; it is never wired into the homeserver's published record. Purely
 * a "does public access work from my network?" preview.
 */
export function CloudflareTestDrive() {
  const [status, setStatus] = useState<DriveStatus>('stopped');
  const [supported, setSupported] = useState(true);
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch('/api/cloudflare-test-drive', { cache: 'no-store' });
      const data = await res.json();
      setSupported(Boolean(data.supported));
      setStatus(data.status);
      setUrl(data.url ?? null);
      setExpiresAt(data.expires_at ?? null);
    } catch {
      // transient
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll fast while starting (URL appears ~10s in), slow while running.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    if (status === 'starting') {
      pollRef.current = setInterval(() => void refresh(), 3000);
    } else if (status === 'running') {
      pollRef.current = setInterval(() => void refresh(), 20000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const act = async (action: 'start' | 'stop') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cloudflare-test-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}) as Record<string, never>);
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setStatus(data.status);
      setUrl(data.url ?? null);
      setExpiresAt(data.expires_at ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  if (!supported) return null;

  const expiresInMin = expiresAt ? Math.max(0, Math.round((Date.parse(expiresAt) - Date.now()) / 60000)) : null;

  return (
    <div className="space-y-2 rounded border border-border/60 bg-muted/10 p-3" data-testid="cf-test-drive">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Just trying it out?</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Get a temporary public URL with no Cloudflare account and no domain. The URL changes every time and stops after
        30 minutes; for a permanent address use one of the setups above.
      </p>

      {status === 'stopped' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void act('start')}
          data-testid="cf-test-drive-start"
        >
          {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Test public access'}
        </Button>
      )}

      {status === 'starting' && (
        <p
          className="inline-flex items-center gap-2 text-xs text-muted-foreground"
          data-testid="cf-test-drive-starting"
        >
          <RefreshCw className="h-3 w-3 animate-spin" /> Requesting a temporary URL from Cloudflare…
        </p>
      )}

      {status === 'running' && url && (
        <div className="space-y-2" data-testid="cf-test-drive-running">
          <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
            <code className="min-w-0 flex-1 font-mono text-xs break-all text-foreground">{url}</code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => void copyUrl()}
              aria-label="Copy URL"
            >
              {copied ? <span className="text-xs text-brand">Copied</span> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open URL"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="flex items-center gap-3">
            {expiresInMin !== null && (
              <span className="text-xs text-muted-foreground">Stops in ~{expiresInMin} min</span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={busy}
              onClick={() => void act('stop')}
              data-testid="cf-test-drive-stop"
            >
              <Square className="mr-1 h-3 w-3" /> Stop
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive" data-testid="cf-test-drive-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
