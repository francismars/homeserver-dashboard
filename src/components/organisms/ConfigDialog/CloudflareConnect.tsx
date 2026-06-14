'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeSVG } from 'qrcode.react';
import { usePolling } from '@/hooks/usePolling';
import { StepList } from './StepList';
import { SetupError, type SetupErrorLink } from './SetupError';

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
  /** Called with the configured hostname (and the route's own restart
   * message, when present) after a successful completion. */
  onConfigured: (hostname: string, message?: string) => void;
}

/**
 * "Connect Cloudflare account": zero-copy-paste setup. The user clicks the
 * auth link (or scans the QR with a phone), logs in on cloudflare.com, picks
 * their domain, clicks Authorize. The dashboard detects the authorization
 * and asks only for the hostname to publish.
 *
 * This card is a pure setup action: a setup completed in an earlier session
 * renders as the idle action again. The Status surface in the dialog is the
 * only place that asserts "connected"; the success branch here is in-session
 * completion feedback only.
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
  const [errorLink, setErrorLink] = useState<SetupErrorLink | null>(null);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [doneHostname, setDoneHostname] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch('/api/cloudflare-connect', { cache: 'no-store' });
      const data = await res.json();
      setSupported(Boolean(data.supported));
      // A pre-existing completed setup renders as the pure idle action; only
      // a completion performed through this card shows success feedback.
      setStatus(data.status === 'completed' ? 'idle' : data.status);
      setAuthorizedDomain(data.authorized_domain ?? null);
      setExpired(Boolean(data.expired));
      if (data.auth_url) setAuthUrl(data.auth_url);
    } catch {
      // transient; next poll retries
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Poll while waiting for the user to authorize on cloudflare.com.
  usePolling(refresh, 3000, { enabled: status === 'waiting' });

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    setErrorLink(null);
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
        setErrorLink(
          data.dashboard_url
            ? { href: data.dashboard_url, label: data.dashboard_label || 'Open Cloudflare dashboard' }
            : null,
        );
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
      // A setup that completed elsewhere (another tab) surfaces as success
      // feedback rather than a dead button.
      if (data.status === 'completed' && data.hostname) setDoneHostname(data.hostname);
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
      onConfigured(data.hostname, typeof data.message === 'string' ? data.message : undefined);
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

  // In-session completion feedback only; the persistent "connected" state
  // lives on the dialog's Status surface.
  if (status === 'completed') {
    return (
      <div className="space-y-3" data-testid="cf-connect-success">
        <div className="flex items-center gap-2 text-sm font-medium text-brand">
          <CheckCircle className="h-4 w-4" />
          <span>Cloudflare account connected{doneHostname ? ` - ${doneHostname}` : ''}</span>
        </div>
        {steps && <StepList steps={steps} labels={STEP_LABELS} testId="cf-connect-steps" />}
        <p className="text-xs text-muted-foreground">The Status section above tracks this setup from here on.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="cf-connect">
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
            Open the link below (any device works), log in, pick your domain, click <strong>Authorize</strong>:
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
                Public address (under the domain you just authorized)
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

      {error && <SetupError message={error} link={errorLink} testId="cf-connect-error" />}
    </div>
  );
}
