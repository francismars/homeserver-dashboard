'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Code, Info, RefreshCw } from 'lucide-react';
import { cn } from '@/libs/utils';

// Mock config data (read-only view)
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

export function ConfigDialog({ open, onOpenChange }: ConfigDialogProps) {
  const [configValue, setConfigValue] = useState(MOCK_CONFIG);
  const [isReloading, setIsReloading] = useState(false);

  const handleReload = async () => {
    setIsReloading(true);
    // Simulate fetch delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    setConfigValue(MOCK_CONFIG);
    setIsReloading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <DialogTitle className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Homeserver Configuration
              </DialogTitle>
              <Badge variant="outline" className="text-xs font-normal border-dashed">
                <Info className="h-3 w-3 mr-1" />
                Mock
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Read-only
              </Badge>
            </div>
          </div>
          <DialogDescription>View the homeserver configuration file (TOML). Editing is disabled.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground/70 italic">
            <span>config.toml</span>
          </div>
          <Textarea
            value={configValue}
            readOnly
            className={cn('flex-1 font-mono text-sm resize-none', 'border-dashed border-2 border-muted-foreground/30')}
            placeholder="Configuration file content..."
          />
          <div className="text-xs text-muted-foreground/60 italic pt-2 border-t border-dashed border-muted-foreground/20">
            This is mock data. Backend endpoints are required to load the real config.toml.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReload} disabled={isReloading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isReloading && 'animate-spin')} />
            Reload
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



