'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Key,
  Server,
  RefreshCw,
  Copy,
  Check,
  Info,
  LogIn,
  LogOut,
  Settings,
  ArrowLeftRight,
  Shield,
} from 'lucide-react';
import { copyToClipboard } from '@/libs/utils';
import { cn } from '@/libs/utils';
import { Keypair, PublicKey, Client } from '@synonymdev/pubky';
import { generateKeypair } from '@/services/user/keyGenerator';

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  homeserverPubkey?: string;
}

interface UserSession {
  pubkey: string;
  displayName: string;
  secretKeyHex?: string; // Stored securely in memory only
}

interface HomeserverInfo {
  pubkey: string;
  address: string;
  version?: string;
  numUsers: number;
  numDisabledUsers: number;
  totalDiskUsedMB: number;
}

// Mock data for other homeservers (in real implementation, this would come from PKARR or user's stored list)
const MOCK_OTHER_HOMESERVERS: HomeserverInfo[] = [
  {
    pubkey: 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o',
    address: 'https://homeserver1.example.com',
    version: '0.1.0',
    numUsers: 15,
    numDisabledUsers: 2,
    totalDiskUsedMB: 1024,
  },
  {
    pubkey: 'y9nncs6ihtjauq8djhgfxfnqry9k6d0pu5lyf2tgobjfrfzt0r7p',
    address: 'https://homeserver2.example.com',
    version: '0.1.0',
    numUsers: 8,
    numDisabledUsers: 0,
    totalDiskUsedMB: 512,
  },
];

// Settings that can be synced between homeservers
type SyncableSetting = 
  | 'signup_mode'
  | 'user_storage_quota_mb'
  | 'admin_enabled'
  | 'metrics_enabled';

const SYNCABLE_SETTINGS: { key: SyncableSetting; label: string; description: string }[] = [
  {
    key: 'signup_mode',
    label: 'Signup Mode',
    description: 'Whether signup is open or requires a token',
  },
  {
    key: 'user_storage_quota_mb',
    label: 'User Storage Quota (MB)',
    description: 'Maximum storage per user (0 for unlimited)',
  },
  {
    key: 'admin_enabled',
    label: 'Admin Server Enabled',
    description: 'Enable/disable the admin API and UI',
  },
  {
    key: 'metrics_enabled',
    label: 'Metrics Server Enabled',
    description: 'Enable/disable Prometheus metrics endpoint',
  },
];

export function UserProfileDialog({
  open,
  onOpenChange,
  homeserverPubkey,
}: UserProfileDialogProps) {
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [copiedPubkey, setCopiedPubkey] = useState(false);
  const [selectedHomeserver, setSelectedHomeserver] = useState<string | null>(null);
  const [syncSettings, setSyncSettings] = useState<Record<SyncableSetting, boolean>>({
    signup_mode: false,
    user_storage_quota_mb: false,
    admin_enabled: false,
    metrics_enabled: false,
  });

  // Load session from localStorage on mount
  useMemo(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('user_session');
      if (stored) {
        try {
          const session = JSON.parse(stored);
          setUserSession(session);
          setDisplayName(session.displayName || session.pubkey.substring(0, 8) + '...');
        } catch {
          // Invalid session, ignore
        }
      }
    }
  }, []);

  const handleSignIn = useCallback(async () => {
    if (!secretKeyInput.trim()) {
      setSignInError('Please enter your secret key');
      return;
    }

    setIsSigningIn(true);
    setSignInError(null);

    try {
      // Convert hex secret key to Uint8Array
      const secretKeyHex = secretKeyInput.trim().replace(/\s/g, '');
      if (secretKeyHex.length !== 64) {
        throw new Error('Invalid secret key format. Expected 64 hex characters.');
      }

      const secretKeyBytes = new Uint8Array(
        secretKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );

      // Create keypair from secret key
      const keypair = Keypair.fromSecretKey(secretKeyBytes);
      const pubkey = keypair.publicKey().z32();

      // Verify the keypair works by creating a session (mock for now)
      // In real implementation, this would call the homeserver's /signin endpoint
      const session: UserSession = {
        pubkey,
        displayName: pubkey.substring(0, 8) + '...',
        secretKeyHex, // Store temporarily for session management
      };

      // Store session in localStorage (in production, use secure storage)
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_session', JSON.stringify({ pubkey, displayName: session.displayName }));
      }

      setUserSession(session);
      setDisplayName(session.displayName);
      setSecretKeyInput('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in';
      setSignInError(errorMessage);
    } finally {
      setIsSigningIn(false);
    }
  }, [secretKeyInput]);

  const handleSignOut = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_session');
    }
    setUserSession(null);
    setDisplayName('');
    setSecretKeyInput('');
    setSignInError(null);
  }, []);

  const handleCopyPubkey = useCallback(async () => {
    if (userSession) {
      await copyToClipboard({ text: userSession.pubkey });
      setCopiedPubkey(true);
      setTimeout(() => setCopiedPubkey(false), 2000);
    }
  }, [userSession]);

  const handleSaveProfile = useCallback(async () => {
    if (!userSession) return;

    // In real implementation, this would update the user's profile on the homeserver
    const updatedSession: UserSession = {
      ...userSession,
      displayName,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('user_session', JSON.stringify({ pubkey: userSession.pubkey, displayName }));
    }

    setUserSession(updatedSession);
  }, [userSession, displayName]);

  const handleSyncSettings = useCallback(async () => {
    if (!selectedHomeserver || !userSession) return;

    // In real implementation, this would:
    // 1. Fetch current config from this homeserver
    // 2. Fetch config from selected homeserver
    // 3. Apply synced settings to this homeserver
    // 4. Save the updated config

    const settingsToSync = Object.entries(syncSettings)
      .filter(([_, enabled]) => enabled)
      .map(([key, _]) => key as SyncableSetting);

    if (settingsToSync.length === 0) {
      alert('Please select at least one setting to sync');
      return;
    }

    // Mock implementation
    console.log('Syncing settings:', settingsToSync, 'from', selectedHomeserver);
    alert(`Syncing ${settingsToSync.length} setting(s) from selected homeserver. This is a mock implementation.`);
  }, [selectedHomeserver, userSession, syncSettings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile
          </DialogTitle>
          <DialogDescription>
            {userSession
              ? 'Manage your profile and homeserver settings'
              : 'Sign in with your keypair to access your profile'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {!userSession ? (
            // Sign In View
            <div className="space-y-4 py-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </CardTitle>
                  <CardDescription>
                    Enter your secret key (64 hex characters) to sign in to your account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="secretKey">Secret Key</Label>
                    <div className="relative">
                      <Input
                        id="secretKey"
                        type="password"
                        placeholder="Enter your 64-character hex secret key..."
                        value={secretKeyInput}
                        onChange={(e) => {
                          setSecretKeyInput(e.target.value);
                          setSignInError(null);
                        }}
                        className="font-mono text-sm pr-24"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 text-xs"
                        onClick={() => {
                          // Generate a mock keypair and use its secret key
                          const mockKeypair = generateKeypair();
                          setSecretKeyInput(mockKeypair.secretKeyHex);
                          setSignInError(null);
                        }}
                        title="Insert mock secret key for testing"
                      >
                        <Key className="h-3 w-3 mr-1" />
                        Mock Key
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your secret key is used to authenticate you. Keep it secure and never share it.
                    </p>
                  </div>
                  {signInError && (
                    <Alert variant="destructive">
                      <AlertTitle>Sign In Failed</AlertTitle>
                      <AlertDescription>{signInError}</AlertDescription>
                    </Alert>
                  )}
                  <Button onClick={handleSignIn} disabled={isSigningIn || !secretKeyInput.trim()} className="w-full">
                    {isSigningIn ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4 mr-2" />
                        Sign In
                      </>
                    )}
                  </Button>
                  <div className="text-xs text-muted-foreground pt-2 border-t border-dashed">
                    <Badge variant="outline" className="text-xs font-normal border-dashed">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                    <span className="ml-2">
                      In production, this would authenticate with the homeserver using AuthToken.
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            // Profile View
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="homeservers">My Homeservers</TabsTrigger>
                <TabsTrigger value="sync">Sync Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4 py-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Profile Information</CardTitle>
                    <CardDescription>Your account details and preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter display name..."
                      />
                      <p className="text-xs text-muted-foreground">
                        This name will be displayed in the dashboard
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Public Key</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded break-all">
                          {userSession.pubkey}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopyPubkey}
                          title="Copy pubkey"
                        >
                          {copiedPubkey ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleSaveProfile}>Save Changes</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="homeservers" className="space-y-4 py-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      Your Homeservers
                    </CardTitle>
                    <CardDescription>
                      Homeservers you own and manage
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Current Homeserver */}
                    {homeserverPubkey && (
                      <div className="p-4 border rounded-md bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="default">Current</Badge>
                            <span className="font-semibold">This Homeserver</span>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 mt-2">
                          <div className="flex items-center gap-2">
                            <Key className="h-3 w-3" />
                            <code className="text-xs font-mono">{homeserverPubkey}</code>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Other Homeservers */}
                    <div className="space-y-2">
                      <Label>Other Homeservers</Label>
                      {MOCK_OTHER_HOMESERVERS.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No other homeservers found
                        </p>
                      ) : (
                        MOCK_OTHER_HOMESERVERS.map((hs) => (
                          <div
                            key={hs.pubkey}
                            className={cn(
                              'p-4 border rounded-md cursor-pointer transition-colors',
                              selectedHomeserver === hs.pubkey
                                ? 'bg-primary/10 border-primary'
                                : 'hover:bg-muted/50'
                            )}
                            onClick={() => setSelectedHomeserver(hs.pubkey)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Server className="h-4 w-4" />
                                <span className="font-semibold">{hs.address}</span>
                              </div>
                              {selectedHomeserver === hs.pubkey && (
                                <Badge variant="default">Selected</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1 mt-2">
                              <div className="flex items-center gap-2">
                                <Key className="h-3 w-3" />
                                <code className="text-xs font-mono">{hs.pubkey}</code>
                              </div>
                              <div className="flex items-center gap-4 mt-2">
                                <span>Users: {hs.numUsers}</span>
                                <span>Disabled: {hs.numDisabledUsers}</span>
                                <span>Storage: {hs.totalDiskUsedMB} MB</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t border-dashed">
                      <Badge variant="outline" className="text-xs font-normal border-dashed">
                        <Info className="h-3 w-3 mr-1" />
                        Mock
                      </Badge>
                      <span className="ml-2">
                        In production, this would discover your homeservers via PKARR records.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sync" className="space-y-4 py-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4" />
                      Sync Settings
                    </CardTitle>
                    <CardDescription>
                      Sync configuration settings from another homeserver to this one
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedHomeserver ? (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Select a Homeserver</AlertTitle>
                        <AlertDescription>
                          Go to the "My Homeservers" tab and select a homeserver to sync settings from.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <>
                        <div className="p-3 bg-muted/50 rounded-md">
                          <p className="text-sm font-medium mb-1">Syncing from:</p>
                          <code className="text-xs font-mono">
                            {MOCK_OTHER_HOMESERVERS.find(hs => hs.pubkey === selectedHomeserver)?.address || selectedHomeserver}
                          </code>
                        </div>
                        <div className="space-y-3">
                          {SYNCABLE_SETTINGS.map((setting) => (
                            <div
                              key={setting.key}
                              className="flex items-center justify-between p-3 border rounded-md"
                            >
                              <div className="flex-1">
                                <Label className="font-medium">{setting.label}</Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {setting.description}
                                </p>
                              </div>
                              <Switch
                                checked={syncSettings[setting.key]}
                                onCheckedChange={(checked) =>
                                  setSyncSettings((prev) => ({
                                    ...prev,
                                    [setting.key]: checked,
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                        <Button
                          onClick={handleSyncSettings}
                          disabled={Object.values(syncSettings).every(v => !v)}
                          className="w-full"
                        >
                          <ArrowLeftRight className="h-4 w-4 mr-2" />
                          Sync Selected Settings
                        </Button>
                        <div className="text-xs text-muted-foreground pt-2 border-t border-dashed">
                          <Badge variant="outline" className="text-xs font-normal border-dashed">
                            <Info className="h-3 w-3 mr-1" />
                            Mock
                          </Badge>
                          <span className="ml-2">
                            In production, this would fetch and apply settings from the selected homeserver.
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter>
          {userSession ? (
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

