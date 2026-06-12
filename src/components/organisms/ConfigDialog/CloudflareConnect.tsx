'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeSVG } from 'qrcode.react';
import { RestartCallout } from './RestartCallout';
import { StepList } from './StepList';

type ConnectStatus = 'idle' | 'waiting' | 'authorized' | 'completed';
type Step = { key: 'tunnel' | 'dns' | 'config'; status: 'done' | 'failed'; detail?: string };

const STEP_LABELS: Record<Step['key'], string> = {
  tunnel: 'Tunnel',
  dns: 'DNS record',
  config: 'Save configuration',
};

const SUBDOMAIN_SUGGESTIONS = ['pubky', 'hs', 'homeserver'] as const;
// One DNS label: letters/digits/hyphens, no leading/trailing hyphen, no dots.
const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

interface CloudflareConnectProps {
  /** Called with the configured hostname after a successful completion. */
  onConfigured: (hostname: string) => void;
}

/**
 * "Connect Cloudflare account": zero-copy-paste setup. The user clicks the
 * auth link (or scans the QR with a phone), logs in on cloudflare.com, picks
 * their domain, clicks Authorize. The dashboard detects the authorization
 * and asks only for the hostname to publish.
 */
export function CloudflareConnect({ onConfigured }: CloudflareConnectProps) {
  const [status, setStatus] = useState<ConnectStatus>('idle');
  const [supported, setSupported] = useState(true);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [hostname, setHostname] = useState('');
  const [subdomain, setSubdomain] = useState('');
  // Zone parsed from the authorization cert; null = unknown, which falls
  // back to the original full-hostname input.
  const [authorizedDomain, setAuthorizedDomain] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [doneHostname, setDoneHostname] = useState<string | null>(null);
  // null = not probed yet, true/false = live reachability of the published
  // hostname. Decides whether the restart callout is still warranted.
  const [tunnelLive, setTunnelLive] = useState<boolean | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch('/api/cloudflare-connect', { cache: 'no-store' });
      const data = await res.json();
      setSupported(Boolean(data.supported));
      setStatus(data.status);
      setAuthorizedDomain(data.authorized_domain ?? null);
      setExpired(Boolean(data.expired));
      if (data.auth_url) setAuthUrl(data.auth_url);
      if (data.status === 'completed' && data.hostname && !doneHostname) {
        setDoneHostname(data.hostname);
      }
    } catch {
      // transient; next poll retries
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once completed, check whether the tunnel is actually up: if the
  // published hostname is reachable the restart clearly already happened
  // and nagging about it would be wrong (field feedback).
  useEffect(() => {
    const hostname = doneHostname?.split(':')[0];
    if (!hostname) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public-health?domain=${encodeURIComponent(hostname)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setTunnelLive(Boolean(data.ok));
      } catch {
        if (!cancelled) setTunnelLive(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doneHostname]);

  const handleDisconnect = async () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cloudflare-disconnect', { method: 'POST' });
      const data = await res.json().catch(() => ({}) as Record<string, never>);
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setDoneHostname(null);
      setSteps(null);
      setStatus('idle');
      setTunnelLive(null);
      setConfirmDisconnect(false);
      setDisconnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  // Poll while waiting for the user to authorize on cloudflare.com.
  useEffect(() => {
    if (status !== 'waiting') {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    pollRef.current = setInterval(() => void refresh(), 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cloudflare-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}) as Record<string, never>);
      if (!res.ok) {
        setSteps(data.steps ?? null);
        setError(data.error || `Request failed (${res.status})`);
        return { data: null, status: res.status };
      }
      return { data, status: res.status };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      return { data: null, status: 0 };
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async () => {
    const { data } = await act({ action: 'start' });
    if (data) {
      setExpired(false);
      setStatus(data.status);
      if (data.authorized_domain) setAuthorizedDomain(data.authorized_domain);
      if (data.auth_url) setAuthUrl(data.auth_url);
    }
  };

  const handleCancel = async () => {
    const { data } = await act({ action: 'cancel' });
    if (data) {
      setStatus('idle');
      setAuthUrl(null);
    }
  };

  const handleComplete = async () => {
    const fullHostname = authorizedDomain
      ? `${subdomain.trim().toLowerCase()}.${authorizedDomain}`
      : hostname.trim().toLowerCase();
    const { data, status: httpStatus } = await act({ action: 'complete', hostname: fullHostname });
    if (data?.ok) {
      setSteps(data.steps ?? null);
      setStatus('completed');
      setDoneHostname(data.hostname);
      onConfigured(data.hostname);
    } else if (httpStatus === 409) {
      // The authorization is gone (expired between polls, or another tab is
      // mid-setup); the idle card with the error shown is the only state
      // with a recovery affordance.
      setStatus('idle');
      setAuthUrl(null);
    }
  };

  const subdomainValid = SUBDOMAIN_PATTERN.test(subdomain.trim());

  if (!supported) return null;

  if (status === 'completed' || doneHostname) {
    return (
      <div className="space-y-3" data-testid="cf-connect-success">
        <div className="flex items-center gap-2 text-sm font-medium text-brand">
          <CheckCircle className="h-4 w-4" />
          <span>Cloudflare account connected{doneHostname ? ` - ${doneHostname}` : ''}</span>
        </div>
        {steps && <StepList steps={steps} labels={STEP_LABELS} testId="cf-connect-steps" />}
        {tunnelLive === true ? (
          <p className="text-xs text-muted-foreground" data-testid="cf-connect-live">
            Tunnel connected and your domain is published. The Overview tracks its reachability.
          </p>
        ) : (
          <RestartCallout>
            Restart the app from Umbrel to connect the tunnel and publish your domain to the Pubky network.
          </RestartCallout>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => void handleDisconnect()}
          data-testid="cf-connect-disconnect"
        >
          {confirmDisconnect ? 'Click again to confirm disconnect' : 'Disconnect and start over'}
        </Button>
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="cf-connect">
      {disconnected && (
        <RestartCallout>
          Disconnected. Restart the app from Umbrel to finish. The old tunnel and DNS record still exist in your
          Cloudflare account; remove them there if you want to reuse the same hostname.
        </RestartCallout>
      )}
      <div>
        <p className="text-sm font-medium">Connect Cloudflare account (recommended)</p>
        <p className="text-xs text-muted-foreground">
          Log in on cloudflare.com and click Authorize. Nothing to copy or paste.
        </p>
      </div>

      {status === 'idle' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground" data-testid="cf-connect-prereqs">
            You&apos;ll need: a free Cloudflare account with your domain added to it. Cloudflare&apos;s page will ask
            you to pick the domain and click <strong>Authorize</strong>.
          </p>
          <p className="text-xs text-muted-foreground">No domain? Try Preview mode below.</p>
          {expired && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground" data-testid="cf-connect-expired">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>The authorization link expired - start again.</span>
            </p>
          )}
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void handleConnect()}
            data-testid="cf-connect-start"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Starting…
              </span>
            ) : (
              'Connect Cloudflare account'
            )}
          </Button>
        </div>
      )}

      {status === 'waiting' && authUrl && (
        <div className="space-y-3 rounded border border-border/60 bg-muted/20 p-3" data-testid="cf-connect-waiting">
          <p className="text-sm">
            1. Open the link below (any device works), log in, pick your domain, click <strong>Authorize</strong>:
          </p>
          <a
            href={authUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm break-all text-brand underline-offset-2 hover:underline"
            data-testid="cf-connect-auth-link"
          >
            Authorize on cloudflare.com <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
          <div className="flex items-center gap-4">
            <div className="rounded-lg border border-border bg-white p-2 shadow-sm">
              <QRCodeSVG value={authUrl} size={112} level="M" />
            </div>
            <p className="text-xs text-muted-foreground">
              Or scan with your phone. This page updates automatically once you authorize.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" /> Waiting for authorization…
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void handleCancel()}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {status === 'authorized' && (
        <div className="space-y-3 rounded border border-brand/40 bg-brand/5 p-3" data-testid="cf-connect-authorized">
          <p className="flex items-center gap-2 text-sm text-brand">
            <CheckCircle className="h-4 w-4" /> Authorized. One last thing:
          </p>
          {authorizedDomain ? (
            <div className="space-y-1.5">
              <Label htmlFor="cf-connect-subdomain" className="text-xs text-muted-foreground">
                Subdomain to publish on {authorizedDomain}
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="cf-connect-subdomain"
                  type="text"
                  placeholder="pubky"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  className="font-mono text-sm"
                  autoComplete="off"
                  data-testid="cf-connect-subdomain"
                />
                <span
                  className="shrink-0 font-mono text-sm text-muted-foreground"
                  data-testid="cf-connect-domain-suffix"
                >
                  .{authorizedDomain}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {SUBDOMAIN_SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 font-mono text-xs"
                    onClick={() => setSubdomain(suggestion)}
                    data-testid={`cf-connect-chip-${suggestion}`}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
              {subdomain.trim() !== '' && !subdomainValid && (
                <p className="text-xs text-destructive" data-testid="cf-connect-subdomain-invalid">
                  Use letters, digits and hyphens only (no dots, no leading or trailing hyphen).
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="cf-connect-hostname" className="text-xs text-muted-foreground">
                Public hostname (under the domain you just authorized)
              </Label>
              <Input
                id="cf-connect-hostname"
                type="text"
                placeholder="pubky.yourdomain.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="font-mono text-sm"
                autoComplete="off"
                data-testid="cf-connect-hostname"
              />
            </div>
          )}
          <Button
            type="button"
            size="sm"
            disabled={busy || (authorizedDomain ? !subdomainValid : !hostname.trim())}
            onClick={() => void handleComplete()}
            data-testid="cf-connect-complete"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Setting up…
              </span>
            ) : (
              'Finish setup'
            )}
          </Button>
        </div>
      )}

      {/* failure progress (success renders in the completed branch above) */}
      {steps && <StepList steps={steps} labels={STEP_LABELS} testId="cf-connect-steps" />}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive" data-testid="cf-connect-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
