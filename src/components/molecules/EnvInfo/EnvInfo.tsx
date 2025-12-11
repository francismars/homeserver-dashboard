'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Server, Lock, Globe } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function EnvInfo() {
  const adminBaseUrl = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || '';
  const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
  const adminMock = process.env.NEXT_PUBLIC_ADMIN_MOCK === '1';
  
  // Determine if mock mode is active
  const isMockMode = adminMock || !adminBaseUrl;
  
  // Determine connection status
  const hasConfig = adminBaseUrl && adminToken;
  const isConfigured = hasConfig && !isMockMode;
  
  // Derive other URLs
  const clientBaseUrl = adminBaseUrl ? adminBaseUrl.replace(':6288', ':6286') : '';
  const metricsBaseUrl = adminBaseUrl ? adminBaseUrl.replace(':6288', ':6289') : '';
  const webdavBaseUrl = adminBaseUrl ? `${adminBaseUrl}/dav` : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Environment Configuration
        </CardTitle>
        <CardDescription>Current dashboard configuration and connection status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection Status</span>
          {isConfigured ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : isMockMode ? (
            <Badge variant="secondary">
              <Server className="h-3 w-3 mr-1" />
              Mock Mode
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              Not Configured
            </Badge>
          )}
        </div>

        {/* Admin Base URL */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Admin Base URL</span>
            {adminBaseUrl ? (
              <code className="text-xs bg-muted px-2 py-1 rounded">{adminBaseUrl}</code>
            ) : (
              <span className="text-xs text-muted-foreground italic">Not set</span>
            )}
          </div>
        </div>

        {/* Admin Token */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Admin Token
            </span>
            {adminToken ? (
              <Badge variant="outline" className="text-xs">
                Configured
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground italic">Not set</span>
            )}
          </div>
        </div>

        {/* Derived URLs */}
        {adminBaseUrl && (
          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground">Derived Endpoints</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Client Server:</span>
                <code className="bg-muted px-2 py-0.5 rounded">{clientBaseUrl}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Metrics Server:</span>
                <code className="bg-muted px-2 py-0.5 rounded">{metricsBaseUrl}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">WebDAV:</span>
                <code className="bg-muted px-2 py-0.5 rounded">{webdavBaseUrl}</code>
              </div>
            </div>
          </div>
        )}

        {/* Warnings */}
        {isMockMode && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Dashboard is running in <strong>mock mode</strong>. Set <code>NEXT_PUBLIC_ADMIN_BASE_URL</code> and{' '}
              <code>NEXT_PUBLIC_ADMIN_TOKEN</code> in your <code>.env.local</code> file to connect to a real homeserver.
            </AlertDescription>
          </Alert>
        )}

        {!isMockMode && !hasConfig && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Missing required environment variables. Please configure <code>NEXT_PUBLIC_ADMIN_BASE_URL</code> and{' '}
              <code>NEXT_PUBLIC_ADMIN_TOKEN</code> in your <code>.env.local</code> file.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

