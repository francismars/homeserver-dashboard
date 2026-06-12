'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StepList } from './StepList';

/**
 * Pre-filled Cloudflare token-creation link (officially supported template
 * URL). Keys resolved from the dashboard's permission groups: `argotunnel`
 * (Account > Cloudflare Tunnel) and `dns` (Zone > DNS). If Cloudflare ever
 * changes the keys the form simply opens unfilled, which is why the UI also
 * spells out the two permissions in text.
 */
const TOKEN_TEMPLATE_URL =
  'https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=' +
  encodeURIComponent(
    JSON.stringify([
      { key: 'argotunnel', type: 'edit' },
      { key: 'dns', type: 'edit' },
      // Zone Read covers GET /zones(/:id); DNS Edit alone may not grant zone
      // detail reads, and without it the flow could never proceed past
      // "Load domains" on some accounts.
      { key: 'zone', type: 'read' },
    ]),
  ) +
  '&name=' +
  encodeURIComponent('Pubky Homeserver Setup') +
  // Pre-select "all accounts" / "all zones" so the form is submittable as
  // opened; the user can narrow the zone scope before creating if they wish.
  '&accountId=*&zoneId=all';

type Zone = { id: string; name: string; status: string; account_id: string };
type Step = {
  key: 'tunnel' | 'ingress' | 'dns' | 'credentials';
  status: 'done' | 'failed';
  detail?: string;
};
type ConflictRecord = { type: string; content: string };

const STEP_LABELS: Record<Step['key'], string> = {
  tunnel: 'Tunnel',
  ingress: 'Route traffic to the homeserver',
  dns: 'DNS record',
  credentials: 'Save credentials',
};

interface CloudflareAutoSetupProps {
  /** Called with the configured hostname (and the route's own restart
   * message, when present) after a successful run. */
  onConfigured: (hostname: string, message?: string) => void;
}

export function CloudflareAutoSetup({ onConfigured }: CloudflareAutoSetupProps) {
  const [apiToken, setApiToken] = useState('');
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zoneId, setZoneId] = useState('');
  const [subdomain, setSubdomain] = useState('pubky');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictRecord[] | null>(null);
  const [doneHostname, setDoneHostname] = useState<string | null>(null);

  const selectedZone = zones?.find((z) => z.id === zoneId) ?? null;
  const hostnamePreview = selectedZone ? (subdomain ? `${subdomain}.${selectedZone.name}` : selectedZone.name) : null;

  const loadZones = async () => {
    setZonesLoading(true);
    setError(null);
    setZones(null);
    setZoneId('');
    try {
      const res = await fetch('/api/cloudflare-auto-setup/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_token: apiToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to load domains (${res.status})`);
      if (!data.zones?.length) throw new Error('The token works, but no domains are visible to it.');
      setZones(data.zones);
      const firstActive = data.zones.find((z: Zone) => z.status === 'active');
      if (firstActive) setZoneId(firstActive.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domains');
    } finally {
      setZonesLoading(false);
    }
  };

  /** Any change to what would be created invalidates a pending conflict
   * prompt; "Replace record" must never act on a hostname whose records the
   * user has not seen. */
  const resetRunState = () => {
    setConflict(null);
    setSteps(null);
    setError(null);
  };

  const run = async (overwriteDns: boolean) => {
    setRunning(true);
    setError(null);
    setConflict(null);
    setSteps(null);
    try {
      const res = await fetch('/api/cloudflare-auto-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_token: apiToken,
          zone_id: zoneId,
          subdomain: subdomain || undefined,
          overwrite_dns: overwriteDns,
        }),
      });
      const data = await res.json().catch(() => ({}) as Record<string, never>);
      setSteps(data.steps ?? null);
      if (res.status === 409 && data.type === 'dns_conflict') {
        setConflict(data.existing_records ?? []);
        return;
      }
      if (!res.ok) throw new Error(data.error || `Setup failed (${res.status})`);
      setDoneHostname(data.hostname);
      // The API token was used server-side for this request only and is
      // discarded there; clear it from the form as well.
      setApiToken('');
      onConfigured(data.hostname, typeof data.message === 'string' ? data.message : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setRunning(false);
    }
  };

  // In-session completion feedback only; the persistent state (and the
  // restart callout) lives on the dialog's Status surface.
  if (doneHostname) {
    return (
      <div className="space-y-3" data-testid="cf-auto-success">
        <div className="flex items-center gap-2 text-sm font-medium text-brand">
          <CheckCircle className="h-4 w-4" />
          <span>Tunnel configured for {doneHostname}</span>
        </div>
        {steps && <StepList steps={steps} labels={STEP_LABELS} testId="cf-auto-steps" />}
        <p className="text-xs text-muted-foreground">The Status section above tracks this setup from here on.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="cf-auto-setup">
      <div>
        <p className="text-sm font-medium">Automatic setup</p>
        <p className="text-xs text-muted-foreground">
          Creates the tunnel, routes it to your homeserver, and sets up DNS. You only need a Cloudflare API token.
        </p>
      </div>

      {/* Step 1: token */}
      <div className="space-y-1.5">
        <Label htmlFor="cf-api-token" className="text-xs text-muted-foreground">
          1. Cloudflare API token
        </Label>
        <div className="flex gap-2">
          <Input
            id="cf-api-token"
            type="password"
            placeholder="Paste API token"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            className="font-mono text-sm"
            autoComplete="off"
            data-testid="cf-auto-token"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0"
            disabled={apiToken.trim().length < 20 || zonesLoading}
            onClick={() => void loadZones()}
            data-testid="cf-auto-load-zones"
          >
            {zonesLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Load domains'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground/70">
          <a
            href={TOKEN_TEMPLATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline"
          >
            Create one with the pre-filled link <ExternalLink className="h-3 w-3" />
          </a>{' '}
          or any token with <code className="text-muted-foreground">Account &gt; Cloudflare Tunnel &gt; Edit</code>,{' '}
          <code className="text-muted-foreground">Zone &gt; DNS &gt; Edit</code> and{' '}
          <code className="text-muted-foreground">Zone &gt; Zone &gt; Read</code>. The token is only used during setup
          and is not stored.
        </p>
      </div>

      {/* Step 2: domain + subdomain */}
      {zones && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">2. Domain</Label>
            <Select
              value={zoneId}
              onValueChange={(v) => {
                setZoneId(v);
                resetRunState();
              }}
            >
              <SelectTrigger className="font-mono text-sm" data-testid="cf-auto-zone">
                <SelectValue placeholder="Pick a domain" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem
                    key={z.id}
                    value={z.id}
                    disabled={z.status !== 'active'}
                    data-testid={`cf-auto-zone-${z.name}`}
                  >
                    {z.name}
                    {z.status !== 'active' ? ' (not active on Cloudflare yet)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-auto-subdomain" className="text-xs text-muted-foreground">
              3. Subdomain (empty = use the domain itself)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="cf-auto-subdomain"
                type="text"
                placeholder="pubky"
                value={subdomain}
                onChange={(e) => {
                  setSubdomain(e.target.value.trim().toLowerCase());
                  resetRunState();
                }}
                className="max-w-[10rem] font-mono text-sm"
                autoComplete="off"
                data-testid="cf-auto-subdomain"
              />
              {selectedZone && (
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {subdomain ? `.${selectedZone.name}` : selectedZone.name}
                </span>
              )}
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={running || !zoneId}
            onClick={() => void run(false)}
            data-testid="cf-auto-create"
          >
            {running ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Setting up {hostnamePreview}…
              </span>
            ) : (
              `Create tunnel${hostnamePreview ? ` for ${hostnamePreview}` : ''}`
            )}
          </Button>
        </div>
      )}

      {/* Progress of a failed run */}
      {steps && !conflict && <StepList steps={steps} labels={STEP_LABELS} testId="cf-auto-steps" />}

      {/* DNS conflict confirmation */}
      {conflict && (
        <div className="space-y-2 rounded border border-amber-500/40 bg-amber-500/5 p-3" data-testid="cf-auto-conflict">
          <p className="text-sm text-amber-300">
            A DNS record already exists at <code className="font-mono">{hostnamePreview}</code>:
          </p>
          <ul className="space-y-1">
            {conflict.map((r, i) => (
              <li key={i} className="font-mono text-xs text-muted-foreground">
                {r.type} → {r.content}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Replacing it will break whatever currently uses this hostname.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={running}
              onClick={() => void run(true)}
              data-testid="cf-auto-overwrite"
            >
              Replace record
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={running} onClick={() => setConflict(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive" data-testid="cf-auto-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
