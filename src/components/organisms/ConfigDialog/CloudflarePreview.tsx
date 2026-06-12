'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Copy, ExternalLink, FlaskConical, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RestartCallout } from './RestartCallout';

type InstantStatus = { status: 'stopped' | 'starting' | 'running'; url?: string; error?: string };
type PreviewState = {
  enabled: boolean;
  instant: InstantStatus;
  published_url?: string;
  supported: boolean;
};

const LIMITATIONS = [
  'The address changes on every app restart - old links stop working',
  'If the tunnel crashes, the address breaks until you restart the app',
  'No uptime promise from Cloudflare, and a 200 simultaneous request cap',
  'Live event streaming (SSE) does not work through it',
  'Some corporate networks block trycloudflare.com',
];

/**
 * Preview mode: a temporary public address published to the Pubky network.
 * No Cloudflare account, no domain - and none of the guarantees either.
 * For a permanent address, the real setups live right above this card.
 */
export function CloudflarePreview() {
  const [state, setState] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [justChanged, setJustChanged] = useState<'enabled' | 'disabled' | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch('/api/cloudflare-preview', { cache: 'no-store' });
      const data = (await res.json()) as PreviewState;
      setState(data);
    } catch {
      // transient
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll fast while the instant tunnel is coming up, slow while running.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    if (!state?.enabled) return;
    const interval = state.instant.status === 'starting' ? 3000 : 20000;
    pollRef.current = setInterval(() => void refresh(), interval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.enabled, state?.instant.status]);

  const act = async (action: 'enable' | 'disable') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cloudflare-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}) as Record<string, never>);
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setState((s) => ({ ...(s as PreviewState), ...data }));
      setJustChanged(action === 'enable' ? 'enabled' : 'disabled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  if (state && !state.supported) return null;

  const activeUrl = state?.instant.url ?? state?.published_url;

  return (
    <div className="space-y-3 rounded border border-border/60 bg-muted/10 p-3" data-testid="cf-preview">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Preview mode</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Get a temporary public address, published to the Pubky network, with no Cloudflare account and no domain. Good
        for trying things out; for a permanent address use one of the setups above.
      </p>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-amber-400/90" data-testid="cf-preview-limitations">
          Limitations - read before using
        </summary>
        <ul className="mt-1.5 ml-4 list-disc space-y-1">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>

      {!state?.enabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !state}
          onClick={() => void act('enable')}
          data-testid="cf-preview-enable"
        >
          {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Enable preview'}
        </Button>
      )}

      {state?.enabled && (
        <div className="space-y-2" data-testid="cf-preview-enabled">
          {state.instant.status === 'starting' && (
            <p
              className="inline-flex items-center gap-2 text-xs text-muted-foreground"
              data-testid="cf-preview-starting"
            >
              <RefreshCw className="h-3 w-3 animate-spin" /> Requesting a temporary address from Cloudflare…
            </p>
          )}

          {activeUrl && (
            <div
              className="flex items-center gap-2 rounded-md border bg-background px-3 py-2"
              data-testid="cf-preview-url"
            >
              <code className="min-w-0 flex-1 font-mono text-xs break-all text-foreground">{activeUrl}</code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => void copyUrl(activeUrl)}
                aria-label="Copy URL"
              >
                {copied ? <span className="text-xs text-brand">Copied</span> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open URL"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {justChanged === 'enabled' && (
            <RestartCallout>
              Restart the app from Umbrel to publish this preview address to the Pubky network. The address shown now
              works immediately but is not yet published; it will change after the restart.
            </RestartCallout>
          )}
          {state.published_url && !justChanged && (
            <p className="text-xs text-muted-foreground">
              Published to the Pubky network. The Overview shows whether it is reachable right now.
            </p>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={busy}
            onClick={() => void act('disable')}
            data-testid="cf-preview-disable"
          >
            Turn off preview
          </Button>
        </div>
      )}

      {justChanged === 'disabled' && (
        <RestartCallout>
          Restart the app from Umbrel to fully turn the preview off and unpublish the address.
        </RestartCallout>
      )}

      {(error || state?.instant.error) && (
        <div className="flex items-start gap-2 text-sm text-destructive" data-testid="cf-preview-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error ?? state?.instant.error}</span>
        </div>
      )}
    </div>
  );
}
