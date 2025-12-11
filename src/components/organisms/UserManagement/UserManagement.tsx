'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useUserManagement } from '@/hooks/user';
import { useCreateUser } from '@/hooks/user/useCreateUser';
import { useAdminActions } from '@/hooks/admin';
import { useAdminInfo } from '@/hooks/admin';
import { Users, UserPlus, RefreshCw, Copy, Shield, ShieldOff, FolderOpen } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { copyToClipboard } from '@/libs/utils';
import { cn } from '@/libs/utils';
import type { User } from '@/services/user/user.types';
import type { UserManagementProps } from './UserManagement.types';

export function UserManagement({ onViewUserFiles }: UserManagementProps) {
  const { users, isLoading, error, refreshUsers } = useUserManagement();
  const { data: adminInfo } = useAdminInfo();
  const { disableUser, enableUser, isDisablingUser, isEnablingUser, disableUserError, enableUserError, generateInvite, isGeneratingInvite, generatedInvites } = useAdminActions();
  const { createUser, isCreating, error: createError, createdUser, reset: resetCreateUser } = useCreateUser();
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [signupToken, setSignupToken] = useState('');
  const [homeserverPubkey, setHomeserverPubkey] = useState('');
  const [recoveryPassphrase, setRecoveryPassphrase] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [copiedPubkey, setCopiedPubkey] = useState<string | null>(null);
  const [copiedSecretKey, setCopiedSecretKey] = useState(false);

  const handleGenerateInvite = async () => {
    try {
      await generateInvite();
      if (generatedInvites.length > 0) {
        setSignupToken(generatedInvites[0]);
        setShowSignupDialog(true);
      }
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleDisableUser = async (user: User) => {
    setSelectedUser(user);
    setShowDisableDialog(true);
  };

  const confirmDisableUser = async () => {
    if (!selectedUser) return;
    try {
      await disableUser(selectedUser.pubkey);
      setShowDisableDialog(false);
      setSelectedUser(null);
      await refreshUsers();
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleEnableUser = async (user: User) => {
    try {
      await enableUser(user.pubkey);
      setShowDisableDialog(false);
      setSelectedUser(null);
      await refreshUsers();
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleCopyPubkey = async (pubkey: string) => {
    await copyToClipboard({ text: pubkey });
    setCopiedPubkey(pubkey);
    setTimeout(() => setCopiedPubkey(null), 2000);
  };

  const formatStorage = (mb?: number): string => {
    if (mb === undefined || mb === null) return '-';
    if (mb < 1) return `${(mb * 1024).toFixed(1)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>Manage users and their accounts</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshUsers}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateInvite}
                disabled={isGeneratingInvite}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Generate Invite
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  // Auto-create user directly (no pubkey needed for local/testnet)
                  try {
                    await createUser(
                      {
                        homeserverPubkey: adminInfo?.pubkey, // Optional - only needed for mainnet
                        signupToken: undefined, // Try without token first
                      },
                      undefined // No recovery passphrase by default
                    );
                    // Show success dialog
                    setShowCreateUserDialog(true);
                    if (adminInfo?.pubkey) {
                      setHomeserverPubkey(adminInfo.pubkey);
                    }
                  } catch (err: any) {
                    // If it fails due to missing token, show dialog
                    if (err.message?.includes('token') || err.message?.includes('Token')) {
                      setShowCreateUserDialog(true);
                      if (adminInfo?.pubkey) {
                        setHomeserverPubkey(adminInfo.pubkey);
                      }
                    } else {
                      // Other error - show dialog with error
                      setShowCreateUserDialog(true);
                      if (adminInfo?.pubkey) {
                        setHomeserverPubkey(adminInfo.pubkey);
                      }
                    }
                  }
                }}
                disabled={isCreating}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {isCreating ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error loading users</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {disableUserError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{disableUserError.message}</AlertDescription>
            </Alert>
          )}

          {enableUserError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{enableUserError.message}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No users found</p>
              <p className="text-sm mt-1">Click "Add User" to generate a signup code</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pubkey</TableHead>
                    <TableHead>Storage Used</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.pubkey}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono">{user.displayName}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleCopyPubkey(user.pubkey)}
                            title="Copy full pubkey"
                          >
                            {copiedPubkey === user.pubkey ? (
                              <Copy className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{formatStorage(user.storageUsedMB)}</TableCell>
                      <TableCell>{user.fileCount ?? '-'}</TableCell>
                      <TableCell>
                        {user.isDisabled ? (
                          <Badge variant="destructive">Disabled</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {onViewUserFiles && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewUserFiles(user.pubkey)}
                              className="h-7"
                            >
                              <FolderOpen className="h-3 w-3 mr-1" />
                              Files
                            </Button>
                          )}
                          {user.isDisabled ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEnableUser(user)}
                              disabled={isEnablingUser}
                              className="h-7"
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              {isEnablingUser ? 'Enabling...' : 'Enable'}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisableUser(user)}
                              disabled={isDisablingUser}
                              className="h-7 text-destructive hover:text-destructive"
                            >
                              <ShieldOff className="h-3 w-3 mr-1" />
                              Disable
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {users.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Total users: <strong>{users.length}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signup Dialog */}
      <Dialog open={showSignupDialog} onOpenChange={setShowSignupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Generate a signup code for a new user. Share this code with them to sign up.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Signup Code</Label>
              <div className="flex gap-2">
                <Input
                  value={signupToken}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard({ text: signupToken })}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Alert>
              <AlertDescription className="text-sm">
                <strong>How to use:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Share this code with the new user</li>
                  <li>They can use it to sign up via Franky or the client API</li>
                  <li>The code will be marked as used after first signup</li>
                </ol>
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertDescription className="text-sm">
                <strong>API Example:</strong>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
{`curl -X POST \\
  "${process.env.NEXT_PUBLIC_ADMIN_BASE_URL?.replace(':6288', ':6286') || 'http://127.0.0.1:6286'}/signup?signup_token=${signupToken}" \\
  -H "Content-Type: application/octet-stream" \\
  --data-binary @auth_token.bin`}
                </pre>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignupDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable User Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable User</DialogTitle>
            <DialogDescription>
              Are you sure you want to disable <strong>{selectedUser?.displayName}</strong>?
              They will not be able to access the homeserver until re-enabled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDisableUser} disabled={isDisablingUser}>
              {isDisablingUser ? 'Disabling...' : 'Disable User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateUserDialog} onOpenChange={(open) => {
        setShowCreateUserDialog(open);
        if (!open) {
          resetCreateUser();
          setHomeserverPubkey('');
          setRecoveryPassphrase('');
          setSignupToken('');
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Generate a new keypair and add the user to the homeserver. Save the keys securely!
            </DialogDescription>
          </DialogHeader>
          
          {createError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{createError.message}</AlertDescription>
            </Alert>
          )}

          {createdUser ? (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>User Created Successfully!</AlertTitle>
                <AlertDescription>
                  The user has been created and signed up to the homeserver. Save these keys securely.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Public Key (Pubkey)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={createdUser.pubkey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        copyToClipboard({ text: createdUser.pubkey });
                        setCopiedPubkey(createdUser.pubkey);
                        setTimeout(() => setCopiedPubkey(null), 2000);
                      }}
                    >
                      {copiedPubkey === createdUser.pubkey ? 'Copied!' : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Secret Key (Hex) - Keep this secure!</Label>
                  <div className="flex gap-2">
                    <Input
                      value={createdUser.secretKeyHex}
                      readOnly
                      type="password"
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        copyToClipboard({ text: createdUser.secretKeyHex });
                        setCopiedSecretKey(true);
                        setTimeout(() => setCopiedSecretKey(false), 2000);
                      }}
                    >
                      {copiedSecretKey ? 'Copied!' : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Save this secret key securely. You won't be able to recover it later.
                  </p>
                </div>

                {createdUser.recoveryFile && (
                  <Alert>
                    <AlertTitle>Recovery File Generated</AlertTitle>
                    <AlertDescription>
                      A recovery file has been created. You can download it using the SDK.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  {adminInfo?.pubkey 
                    ? '✓ Homeserver pubkey detected. For local/testnet homeservers, this is optional - the dashboard will connect directly.'
                    : 'For local/testnet homeservers, you don\'t need to enter the pubkey - the dashboard will connect directly. Only required for mainnet.'}
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="homeserverPubkey">
                  Homeserver Pubkey (Optional - only needed for mainnet)
                </Label>
                <Input
                  id="homeserverPubkey"
                  value={homeserverPubkey || adminInfo?.pubkey || ''}
                  onChange={(e) => setHomeserverPubkey(e.target.value)}
                  placeholder="Leave empty for local/testnet homeservers"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Only required for mainnet homeservers. Local/testnet homeservers connect directly without this.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signupToken">Signup Token (Optional)</Label>
                <Input
                  id="signupToken"
                  value={signupToken}
                  onChange={(e) => setSignupToken(e.target.value)}
                  placeholder="Leave empty if signup tokens not required"
                />
                <p className="text-xs text-muted-foreground">
                  Only needed if your homeserver requires signup tokens. Generate one from the "Invites" tab.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recoveryPassphrase">Recovery Passphrase (Optional)</Label>
                <Input
                  id="recoveryPassphrase"
                  type="password"
                  value={recoveryPassphrase}
                  onChange={(e) => setRecoveryPassphrase(e.target.value)}
                  placeholder="Optional: Create encrypted recovery file"
                />
                <p className="text-xs text-muted-foreground">
                  If provided, a recovery file will be generated encrypted with this passphrase.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {createdUser ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateUserDialog(false);
                    resetCreateUser();
                    refreshUsers();
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    resetCreateUser();
                    setHomeserverPubkey('');
                    setRecoveryPassphrase('');
                    setSignupToken('');
                  }}
                >
                  Create Another
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    const pubkey = homeserverPubkey.trim() || adminInfo?.pubkey || '';
                    if (!pubkey) {
                      return;
                    }
                    try {
                      await createUser(
                        {
                          homeserverPubkey: pubkey,
                          signupToken: signupToken.trim() || undefined,
                        },
                        recoveryPassphrase.trim() || undefined
                      );
                    } catch (err) {
                      // Error handled by hook
                    }
                  }}
                  disabled={isCreating || false}
                >
                  {isCreating ? 'Creating...' : 'Create User'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

