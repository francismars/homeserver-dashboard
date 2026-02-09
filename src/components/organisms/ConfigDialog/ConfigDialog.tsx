'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/libs/utils';

type Tab = 'config' | 'cloudflare';
type CloudflareConfig = { domain: string | null; configured: boolean };
type HealthStatus = 'idle' | 'checking' | 'ok' | 'fail';

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConfigDialog({ open, onOpenChange }: ConfigDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>('config');

  // Config file state
  const [configValue, setConfigValue] = useState('');
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  // Cloudflare state
  const [cfConfig, setCfConfig] = useState<CloudflareConfig | null>(null);
  const [cfLoading, setCfLoading] = useState(true);
  const [cfSaving, setCfSaving] = useState(false);
  const [cfDomain, setCfDomain] = useState('');
  const [cfToken, setCfToken] = useState('');
  const [cfMessage, setCfMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle');
  const [healthError, setHealthError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setConfigError(null);
    try {
      const res = await fetch('/api/server-config');
      const data = await res.json();
      if (!res.ok) {
        setConfigError(data.error || `HTTP ${res.status}`);
        setConfigValue('');
      } else {
        setConfigValue(data.config || '');
      }
    } catch {
      setConfigError('Failed to load config');
      setConfigValue('');
    }
  };

  const handleReload = async () => {
    setIsReloading(true);
    await fetchConfig();
    setIsReloading(false);
  };

  // Fetch server config when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setConfigLoading(true);
    fetchConfig().finally(() => {
      if (!cancelled) setConfigLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  // Fetch Cloudflare config when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCfLoading(true);
    fetch('/api/cloudflare-config')
      .then((res) => res.json())
      .then((data: CloudflareConfig) => {
        if (!cancelled) {
          setCfConfig(data);
          if (data.domain) setCfDomain(data.domain);
        }
      })
      .catch(() => {
        if (!cancelled) setCfConfig({ domain: null, configured: false });
      })
      .finally(() => {
        if (!cancelled) setCfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleCfSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setCfMessage(null);
    setCfSaving(true);
    try {
      const res = await fetch('/api/cloudflare-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cfDomain.trim() || undefined, token: cfToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCfMessage({ type: 'error', text: data.error || 'Failed to save' });
        return;
      }
      setCfMessage({
        type: 'success',
        text: data.message || 'Saved. Restart the app from Umbrel for the tunnel to connect.',
      });
      setCfConfig((c) => (c ? { ...c, domain: cfDomain.trim() || null, configured: !!(cfDomain.trim() && cfToken) } : c));
      setHealthStatus('idle'); // Reset health check after save
    } catch {
      setCfMessage({ type: 'error', text: 'Request failed' });
    } finally {
      setCfSaving(false);
    }
  };

  const checkHealth = async (domain: string) => {
    setHealthStatus('checking');
    setHealthError(null);
    try {
      const res = await fetch(`/api/public-health?domain=${encodeURIComponent(domain)}`);
      const data = await res.json();
      if (data.ok) {
        setHealthStatus('ok');
      } else {
        setHealthStatus('fail');
        setHealthError(data.error || `HTTP ${data.status ?? res.status}`);
      }
    } catch {
      setHealthStatus('fail');
      setHealthError('Request failed');
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'config', label: 'Config' },
    { id: 'cloudflare', label: 'Cloudflare' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-h-[90vh] max-w-[calc(100vw-2rem)] flex-col p-0 sm:h-[90vh] sm:max-w-[min(64rem,calc(100vw-4rem))]">
        <DialogHeader className="border-b border-border/50 px-6 py-4">
          <DialogTitle className="text-base font-semibold sm:text-lg">
            Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
            Server configuration and public access
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Minimal vertical tabs */}
          <nav className="flex w-32 shrink-0 flex-col border-r border-border/50 py-4 pl-4 pr-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative py-2 text-left text-sm transition-colors',
                  activeTab === tab.id
                    ? 'font-medium text-brand'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {activeTab === tab.id && (
                  <span className="absolute -left-4 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand" />
                )}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="flex flex-1 flex-col overflow-hidden p-6">
            {activeTab === 'config' && (
              <div className="flex flex-1 flex-col gap-3 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">config.toml</span>
                    <Badge variant="secondary" className="text-xs">
                      Read-only
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleReload} disabled={isReloading || configLoading}>
                    <RefreshCw className={cn('h-3.5 w-3.5', (isReloading || configLoading) && 'animate-spin')} />
                  </Button>
                </div>

                {configLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading…</span>
                  </div>
                ) : configError ? (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{configError}</span>
                  </div>
                ) : (
                  <Textarea
                    value={configValue}
                    readOnly
                    className={cn(
                      'flex-1 resize-none font-mono text-xs sm:text-sm'
                    )}
                    placeholder="Configuration file content..."
                  />
                )}

                <p className="text-xs text-muted-foreground/70">
                  Sensitive fields (passwords, database URL) are redacted. Restart the app from Umbrel to apply config changes.
                </p>
              </div>
            )}

            {activeTab === 'cloudflare' && (
              <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
                {cfLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading…</span>
                  </div>
                ) : (
                  <>
                    {/* Status section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Status</span>
                        {cfConfig?.configured ? (
                          <span className="text-sm text-brand font-medium">Configured</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Off</span>
                        )}
                      </div>

                      {cfConfig?.configured && cfConfig.domain && (
                        <div className="flex items-center justify-between gap-3">
                          <code className="text-xs text-muted-foreground font-mono truncate">
                            {cfConfig.domain}
                          </code>
                          <div className="flex items-center gap-2 shrink-0">
                            {healthStatus === 'ok' && (
                              <span className="text-xs text-brand">Reachable</span>
                            )}
                            {healthStatus === 'fail' && (
                              <span className="text-xs text-destructive">
                                Not reachable{healthError ? ` (${healthError})` : ''}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={healthStatus === 'checking'}
                              onClick={() => checkHealth(cfConfig.domain!)}
                            >
                              {healthStatus === 'checking' ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                'Check'
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-border/50" />

                    {/* Save feedback */}
                    {cfMessage && (
                      <div
                        className={cn(
                          'flex items-center gap-2 text-sm',
                          cfMessage.type === 'error' ? 'text-destructive' : 'text-brand'
                        )}
                      >
                        {cfMessage.type === 'error' ? (
                          <AlertCircle className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5" />
                        )}
                        <span>{cfMessage.text}</span>
                      </div>
                    )}

                    {/* Configuration form */}
                    <form onSubmit={handleCfSave} className="space-y-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="cf-domain" className="text-xs text-muted-foreground">
                          Domain
                        </Label>
                        <Input
                          id="cf-domain"
                          type="text"
                          placeholder="pubky.yourdomain.com"
                          value={cfDomain}
                          onChange={(e) => setCfDomain(e.target.value)}
                          className="font-mono text-sm"
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cf-token" className="text-xs text-muted-foreground">
                          Tunnel token
                        </Label>
                        <Input
                          id="cf-token"
                          type="password"
                          placeholder="Paste token from Cloudflare Zero Trust"
                          value={cfToken}
                          onChange={(e) => setCfToken(e.target.value)}
                          className="font-mono text-sm"
                          autoComplete="off"
                        />
                      </div>
                      <Button type="submit" disabled={cfSaving} size="sm">
                        {cfSaving ? 'Saving…' : 'Save'}
                      </Button>
                    </form>

                    <p className="text-xs text-muted-foreground/70">
                      Point the tunnel hostname to <code className="text-muted-foreground">http://homeserver:6286</code>.
                      Restart the app after saving.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
