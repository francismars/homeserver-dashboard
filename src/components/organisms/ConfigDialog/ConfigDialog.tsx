'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/libs/utils';

type Tab = 'config' | 'cloudflare';
type CloudflareConfig = { domain: string | null; configured: boolean; supported: boolean };
type HealthStatus = 'idle' | 'checking' | 'ok' | 'fail';

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Drives whether the Config tab exposes an Edit button. Comes from /api/capabilities. */
  writable?: boolean;
}

type SaveMessage = { type: 'success' | 'error' | 'conflict'; text: string };

export function ConfigDialog({ open, onOpenChange, writable = false }: ConfigDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>('cloudflare');
  const [isConfigTabVisible, setIsConfigTabVisible] = useState(false);

  // Config file state
  const [configValue, setConfigValue] = useState('');
  const [configChecksum, setConfigChecksum] = useState<string | null>(null);
  const [configMtime, setConfigMtime] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);

  // Cloudflare state
  const [isCloudflareTabVisible, setIsCloudflareTabVisible] = useState(false);
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
      const res = await fetch('/api/server-config', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        // Hide config tab if the file is missing/unavailable in this environment.
        if (res.status === 404) {
          setIsConfigTabVisible(false);
        }
        setConfigError(data.error || `HTTP ${res.status}`);
        setConfigValue('');
        setConfigChecksum(null);
        setConfigMtime(null);
      } else {
        setIsConfigTabVisible(true);
        setConfigValue(data.config || '');
        setEditValue(data.config || '');
        setConfigChecksum(data.checksum ?? null);
        setConfigMtime(data.mtime ?? null);
      }
    } catch {
      setConfigError('Failed to load config');
      setConfigValue('');
      setConfigChecksum(null);
      setConfigMtime(null);
    }
  };

  const handleReload = async () => {
    setIsReloading(true);
    await fetchConfig();
    setIsReloading(false);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setSaveMessage(null);
    setEditValue(configValue);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveMessage(null);
    setEditValue(configValue);
  };

  const handleSave = async () => {
    if (!configChecksum) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/server-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_toml: editValue, checksum: configChecksum }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setSaveMessage({
          type: 'conflict',
          text:
            data.error ||
            'Config has been modified by someone else. Reload to see the latest, or save again to overwrite.',
        });
        // Pull the new checksum so a re-save can be a "force save" (one more click)
        if (data.current_checksum) setConfigChecksum(data.current_checksum);
        return;
      }
      if (!res.ok) {
        setSaveMessage({ type: 'error', text: data.error || `Save failed (${res.status})` });
        return;
      }
      // Success: refresh and exit edit mode
      setConfigValue(editValue);
      setConfigChecksum(data.checksum ?? null);
      setConfigMtime(data.updated_at ?? null);
      setIsEditing(false);
      setSaveMessage({
        type: 'success',
        text:
          data.message || 'Config saved. Stop and start the Pubky Homeserver app in Umbrel for changes to take effect.',
      });
    } catch {
      setSaveMessage({ type: 'error', text: 'Request failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = isEditing && editValue !== configValue;

  // Fetch server config when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setConfigLoading(true);
    fetchConfig().finally(() => {
      if (!cancelled) setConfigLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Ensure we never stay on hidden tabs
  useEffect(() => {
    if (activeTab === 'config' && !isConfigTabVisible) {
      if (isCloudflareTabVisible) setActiveTab('cloudflare');
      return;
    }
    if (activeTab === 'cloudflare' && !isCloudflareTabVisible) {
      if (isConfigTabVisible) setActiveTab('config');
    }
  }, [activeTab, isConfigTabVisible, isCloudflareTabVisible]);

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
          setIsCloudflareTabVisible(Boolean(data.supported));
          if (data.domain) setCfDomain(data.domain);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCfConfig({ domain: null, configured: false, supported: false });
          setIsCloudflareTabVisible(false);
        }
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
      setCfConfig((c) =>
        c ? { ...c, domain: cfDomain.trim() || null, configured: !!(cfDomain.trim() && cfToken) } : c,
      );
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
    ...(isConfigTabVisible ? [{ id: 'config' as Tab, label: 'Config' }] : []),
    ...(isCloudflareTabVisible ? [{ id: 'cloudflare' as Tab, label: 'Cloudflare' }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-h-[90vh] max-w-[calc(100vw-2rem)] flex-col p-0 sm:h-[90vh] sm:max-w-[min(64rem,calc(100vw-4rem))]">
        <DialogHeader className="border-b border-border/50 px-6 py-4">
          <DialogTitle className="text-base font-semibold sm:text-lg">Settings</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
            Server configuration and public access
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {tabs.length > 0 && (
            <nav className="flex w-32 shrink-0 flex-col border-r border-border/50 py-4 pr-2 pl-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative py-2 text-left text-sm transition-colors',
                    activeTab === tab.id ? 'font-medium text-brand' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {activeTab === tab.id && (
                    <span className="absolute top-1/2 -left-4 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand" />
                  )}
                  {tab.label}
                </button>
              ))}
            </nav>
          )}

          {/* Tab content */}
          <div className="flex flex-1 flex-col overflow-hidden p-6">
            {tabs.length === 0 && (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Settings are not available in this environment.
              </div>
            )}

            {activeTab === 'config' && isConfigTabVisible && (
              <div className="flex flex-1 flex-col gap-3 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">config.toml</span>
                    <Badge variant="secondary" className="text-xs" data-testid="config-mode-badge">
                      {writable ? (isEditing ? 'Editing' : 'Editable') : 'Read-only'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {writable && !isEditing && (
                      <Button
                        size="sm"
                        className="h-7 px-3"
                        onClick={handleStartEdit}
                        disabled={configLoading || !!configError}
                        data-testid="config-edit"
                      >
                        Edit
                      </Button>
                    )}
                    {writable && isEditing && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-3"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          data-testid="config-cancel"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-3"
                          onClick={handleSave}
                          disabled={isSaving || !isDirty}
                          data-testid="config-save"
                        >
                          {isSaving ? 'Saving…' : saveMessage?.type === 'conflict' ? 'Save anyway' : 'Save'}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleReload}
                      disabled={isReloading || configLoading || isSaving}
                      data-testid="config-reload"
                      aria-label="Reload"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', (isReloading || configLoading) && 'animate-spin')} />
                    </Button>
                  </div>
                </div>

                {saveMessage && (
                  <div
                    className={cn(
                      'flex items-start gap-2 rounded border px-3 py-2 text-sm',
                      saveMessage.type === 'success' && 'border-brand/40 bg-brand/5 text-brand',
                      saveMessage.type === 'error' && 'border-destructive/40 bg-destructive/5 text-destructive',
                      saveMessage.type === 'conflict' && 'border-amber-500/40 bg-amber-500/5 text-amber-300',
                    )}
                    data-testid={`config-save-${saveMessage.type}`}
                  >
                    {saveMessage.type === 'success' ? (
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{saveMessage.text}</span>
                  </div>
                )}

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
                ) : isEditing ? (
                  <Textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className={cn('flex-1 resize-none font-mono text-xs sm:text-sm')}
                    placeholder="Configuration file content..."
                    spellCheck={false}
                    data-testid="config-editor"
                  />
                ) : (
                  <Textarea
                    value={configValue}
                    readOnly
                    className={cn('flex-1 resize-none font-mono text-xs sm:text-sm')}
                    placeholder="Configuration file content..."
                    data-testid="config-viewer"
                  />
                )}

                {writable ? (
                  <p className="text-xs text-muted-foreground/70">
                    Sensitive fields (passwords, database URL) are masked as <code>&quot;********&quot;</code> on
                    display. Leave the placeholder untouched and the real value is preserved on save. Restart the Pubky
                    Homeserver app from Umbrel to apply config changes.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/70">
                    Sensitive fields (passwords, database URL) are redacted. The config volume is read-only in this
                    environment, so editing isn&apos;t available here.
                  </p>
                )}
                {configMtime && (
                  <p className="text-[10px] text-muted-foreground/50" data-testid="config-mtime">
                    Last modified on disk: {new Date(configMtime).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'cloudflare' && isCloudflareTabVisible && (
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
                          <span className="text-sm font-medium text-brand">Configured</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Off</span>
                        )}
                      </div>

                      {cfConfig?.configured && cfConfig.domain && (
                        <div className="flex items-center justify-between gap-3">
                          <code className="truncate font-mono text-xs text-muted-foreground">{cfConfig.domain}</code>
                          <div className="flex shrink-0 items-center gap-2">
                            {healthStatus === 'ok' && <span className="text-xs text-brand">Reachable</span>}
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
                              {healthStatus === 'checking' ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Check'}
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
                          cfMessage.type === 'error' ? 'text-destructive' : 'text-brand',
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
                      Point the tunnel hostname to <code className="text-muted-foreground">http://homeserver:6286</code>
                      . Restart the app after saving.
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
