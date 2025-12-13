'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, Save, X, Code, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { cn } from '@/libs/utils';

// Mock config data
const MOCK_CONFIG = `[general]
database_url = "postgres://localhost:5432/pubky_homeserver"
signup_mode = "token_required"
user_storage_quota_mb = 0

[drive]
pubky_listen_socket = "127.0.0.1:6287"
icann_listen_socket = "127.0.0.1:6286"

[storage]
type = "file_system"

[admin]
enabled = true
listen_socket = "127.0.0.1:6288"
admin_password = "admin"

# [metrics]
# enabled = true
# listen_socket = "127.0.0.1:6289"

# [pkdns]
# public_ip = "127.0.0.1"
# public_pubky_tls_port = 6287
# public_icann_http_port = 80
# icann_domain = "localhost"
# user_keys_republisher_interval = 14400
# dht_bootstrap_nodes = [
#     "router.bittorrent.com:6881",
#     "dht.transmissionbt.com:6881",
#     "dht.libtorrent.org:25401",
#     "relay.pkarr.org:6881",
# ]
# dht_relay_nodes = ["https://pkarr.pubky.app", "https://pkarr.pubky.org"]
# dht_request_timeout_ms = 2000

# [logging]
# level = "info"
# module_levels = ["pubky_homeserver=debug", "tower_http=debug"]
`;

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Simple TOML parser for basic key-value pairs (not full TOML support)
function parseConfigToml(toml: string): Record<string, any> {
  const config: Record<string, any> = {};
  let currentSection = '';
  
  const lines = toml.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Section header
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1);
      if (!config[currentSection]) {
        config[currentSection] = {};
      }
      continue;
    }
    
    // Key-value pair
    const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (match && currentSection) {
      const key = match[1];
      let value = match[2].trim();
      
      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Parse boolean
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      // Parse number
      else if (/^\d+$/.test(value)) value = parseInt(value, 10);
      
      config[currentSection][key] = value;
    }
  }
  
  return config;
}

// Convert config object back to TOML (simplified)
function configToToml(config: Record<string, any>): string {
  const sections: string[] = [];
  
  for (const [section, values] of Object.entries(config)) {
    if (Object.keys(values).length === 0) continue;
    
    sections.push(`[${section}]`);
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null) continue;
      
      let formattedValue: string;
      if (typeof value === 'boolean') {
        formattedValue = value.toString();
      } else if (typeof value === 'number') {
        formattedValue = value.toString();
      } else {
        formattedValue = `"${value}"`;
      }
      
      sections.push(`${key} = ${formattedValue}`);
    }
    sections.push('');
  }
  
  return sections.join('\n');
}

export function ConfigDialog({ open, onOpenChange }: ConfigDialogProps) {
  const [configValue, setConfigValue] = useState(MOCK_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [viewMode, setViewMode] = useState<'ui' | 'toml'>('ui');

  // Parse config for UI
  const config = useMemo(() => parseConfigToml(configValue), [configValue]);
  
  // Form state
  const [formData, setFormData] = useState({
    general: {
      database_url: config.general?.database_url || '',
      signup_mode: config.general?.signup_mode || 'token_required',
      user_storage_quota_mb: config.general?.user_storage_quota_mb || 0,
    },
    drive: {
      pubky_listen_socket: config.drive?.pubky_listen_socket || '',
      icann_listen_socket: config.drive?.icann_listen_socket || '',
    },
    storage: {
      type: config.storage?.type || 'file_system',
    },
    admin: {
      enabled: config.admin?.enabled !== false,
      listen_socket: config.admin?.listen_socket || '',
      admin_password: config.admin?.admin_password || '',
    },
    metrics: {
      enabled: config.metrics?.enabled || false,
      listen_socket: config.metrics?.listen_socket || '127.0.0.1:6289',
    },
  });

  const handleFormChange = (section: string, key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleConfigChange = (value: string) => {
    setConfigValue(value);
    setHasChanges(value !== MOCK_CONFIG);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    setHasChanges(false);
    // In real implementation, this would call the save API
  };

  const handleReset = () => {
    setConfigValue(MOCK_CONFIG);
    setFormData({
      general: {
        database_url: 'postgres://localhost:5432/pubky_homeserver',
        signup_mode: 'token_required',
        user_storage_quota_mb: 0,
      },
      drive: {
        pubky_listen_socket: '127.0.0.1:6287',
        icann_listen_socket: '127.0.0.1:6286',
      },
      storage: {
        type: 'file_system',
      },
      admin: {
        enabled: true,
        listen_socket: '127.0.0.1:6288',
        admin_password: 'admin',
      },
      metrics: {
        enabled: false,
        listen_socket: '127.0.0.1:6289',
      },
    });
    setHasChanges(false);
  };

  const handleReload = async () => {
    // In real implementation, this would fetch from the backend
    // For now, just reset to mock config (simulating a reload)
    if (hasChanges && !confirm('You have unsaved changes. Reloading will discard them. Continue?')) {
      return;
    }
    // Simulate API call to fetch fresh config
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Reset to initial state (fresh from server)
    setConfigValue(MOCK_CONFIG);
    setFormData({
      general: {
        database_url: 'postgres://localhost:5432/pubky_homeserver',
        signup_mode: 'token_required',
        user_storage_quota_mb: 0,
      },
      drive: {
        pubky_listen_socket: '127.0.0.1:6287',
        icann_listen_socket: '127.0.0.1:6286',
      },
      storage: {
        type: 'file_system',
      },
      admin: {
        enabled: true,
        listen_socket: '127.0.0.1:6288',
        admin_password: 'admin',
      },
      metrics: {
        enabled: false,
        listen_socket: '127.0.0.1:6289',
      },
    });
    setHasChanges(false);
  };

  // Sync form data to config when switching to TOML view
  const handleViewModeChange = (mode: 'ui' | 'toml') => {
    if (mode === 'toml' && hasChanges) {
      // Convert form data to TOML
      const updatedConfig = {
        general: formData.general,
        drive: formData.drive,
        storage: formData.storage,
        admin: formData.admin,
        ...(formData.metrics.enabled && { metrics: formData.metrics }),
      };
      setConfigValue(configToToml(updatedConfig));
    }
    setViewMode(mode);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <DialogTitle>Homeserver Configuration</DialogTitle>
              <Badge variant="outline" className="text-xs font-normal border-dashed">
                <Info className="h-3 w-3 mr-1" />
                Mock
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'ui' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleViewModeChange('ui')}
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                UI View
              </Button>
              <Button
                variant={viewMode === 'toml' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleViewModeChange('toml')}
              >
                <Code className="h-4 w-4 mr-2" />
                TOML View
              </Button>
            </div>
          </div>
          <DialogDescription>
            Edit the homeserver configuration file. Changes will require a restart to take effect.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-2">
          {viewMode === 'ui' ? (
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {/* General Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Basic homeserver configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="database_url">Database URL</Label>
                    <Input
                      id="database_url"
                      value={formData.general.database_url}
                      onChange={(e) => handleFormChange('general', 'database_url', e.target.value)}
                      placeholder="postgres://localhost:5432/pubky_homeserver"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup_mode">Signup Mode</Label>
                    <Select
                      value={formData.general.signup_mode}
                      onValueChange={(value) => handleFormChange('general', 'signup_mode', value)}
                    >
                      <SelectTrigger id="signup_mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open - Anyone can signup</SelectItem>
                        <SelectItem value="token_required">Token Required - Signup token needed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user_storage_quota_mb">User Storage Quota (MB)</Label>
                    <Input
                      id="user_storage_quota_mb"
                      type="number"
                      value={formData.general.user_storage_quota_mb}
                      onChange={(e) => handleFormChange('general', 'user_storage_quota_mb', parseInt(e.target.value) || 0)}
                      placeholder="0 for unlimited"
                    />
                    <p className="text-xs text-muted-foreground">Set to 0 for unlimited storage</p>
                  </div>
                </CardContent>
              </Card>

              {/* Drive Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Drive Settings</CardTitle>
                  <CardDescription>Network and API configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pubky_listen_socket">Pubky Listen Socket</Label>
                    <Input
                      id="pubky_listen_socket"
                      value={formData.drive.pubky_listen_socket}
                      onChange={(e) => handleFormChange('drive', 'pubky_listen_socket', e.target.value)}
                      placeholder="127.0.0.1:6287"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icann_listen_socket">ICANN Listen Socket</Label>
                    <Input
                      id="icann_listen_socket"
                      value={formData.drive.icann_listen_socket}
                      onChange={(e) => handleFormChange('drive', 'icann_listen_socket', e.target.value)}
                      placeholder="127.0.0.1:6286"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Storage Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Storage Settings</CardTitle>
                  <CardDescription>File storage configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="storage_type">Storage Type</Label>
                    <Select
                      value={formData.storage.type}
                      onValueChange={(value) => handleFormChange('storage', 'type', value)}
                    >
                      <SelectTrigger id="storage_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="file_system">File System</SelectItem>
                        <SelectItem value="google_bucket">Google Cloud Bucket</SelectItem>
                        <SelectItem value="in_memory">In Memory (Testing Only)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Admin Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Admin Settings</CardTitle>
                  <CardDescription>Administrative API configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="admin_enabled">Enable Admin Server</Label>
                      <p className="text-xs text-muted-foreground">Enable the admin API and UI</p>
                    </div>
                    <Button
                      id="admin_enabled"
                      variant={formData.admin.enabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleFormChange('admin', 'enabled', !formData.admin.enabled)}
                    >
                      {formData.admin.enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                  {formData.admin.enabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="admin_listen_socket">Admin Listen Socket</Label>
                        <Input
                          id="admin_listen_socket"
                          value={formData.admin.listen_socket}
                          onChange={(e) => handleFormChange('admin', 'listen_socket', e.target.value)}
                          placeholder="127.0.0.1:6288"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin_password">Admin Password</Label>
                        <Input
                          id="admin_password"
                          type="password"
                          value={formData.admin.admin_password}
                          onChange={(e) => handleFormChange('admin', 'admin_password', e.target.value)}
                          placeholder="admin"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Metrics Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Metrics Settings</CardTitle>
                  <CardDescription>Prometheus metrics configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="metrics_enabled">Enable Metrics Server</Label>
                      <p className="text-xs text-muted-foreground">Expose Prometheus metrics endpoint</p>
                    </div>
                    <Button
                      id="metrics_enabled"
                      variant={formData.metrics.enabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleFormChange('metrics', 'enabled', !formData.metrics.enabled)}
                    >
                      {formData.metrics.enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                  {formData.metrics.enabled && (
                    <div className="space-y-2">
                      <Label htmlFor="metrics_listen_socket">Metrics Listen Socket</Label>
                      <Input
                        id="metrics_listen_socket"
                        value={formData.metrics.listen_socket}
                        onChange={(e) => handleFormChange('metrics', 'listen_socket', e.target.value)}
                        placeholder="127.0.0.1:6289"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="text-xs text-muted-foreground/60 italic pt-2 border-t border-dashed border-muted-foreground/20">
                Advanced settings (rate limits, pkdns, logging) are available in TOML view. This is mock data. The configuration editor requires backend endpoints to load and save the actual config.toml file.
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground/70 italic">
                <span>config.toml</span>
                {hasChanges && (
                  <span className="text-yellow-600">Unsaved changes</span>
                )}
              </div>
              <Textarea
                value={configValue}
                onChange={(e) => handleConfigChange(e.target.value)}
                className={cn(
                  'flex-1 font-mono text-sm resize-none',
                  'border-dashed border-2 border-muted-foreground/30'
                )}
                placeholder="Configuration file content..."
              />
              <div className="text-xs text-muted-foreground/60 italic pt-2 border-t border-dashed border-muted-foreground/20">
                This is mock data. The configuration editor requires backend endpoints to load and save the actual config.toml file.
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReload} disabled={isSaving}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
