'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { copyToClipboard } from '@/libs/utils';
import { useUserManagement } from '@/hooks/user';
import { Check, Clipboard, Copy, Info, Key, RefreshCw, Search, ShieldOff } from 'lucide-react';
import type { User } from '@/services/user/user.types';

export type DisabledUsersManagementProps = {
  onDisableUser: (pubkey: string) => Promise<void>;
  onEnableUser: (pubkey: string) => Promise<void>;
  isDisablingUser?: boolean;
  onOpenInvites?: () => void;
  numUsersTotal?: number;
  numDisabledUsers?: number;
};

const formatDisplayName = (pubkey: string): string =>
  pubkey.length >= 12 ? `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 4)}` : pubkey;

const ZBASE32 = 'ybndrfg8ejkmcpqxot1uwisza345h769';
const makeMockPubkey = (index: number): string => {
  // 52-ish chars to resemble a real pubkey length, but clearly mock.
  // "mock" prefix + 48 z-base-32 chars
  let n = index + 1;
  let s = '';
  while (s.length < 48) {
    s += ZBASE32[n % ZBASE32.length];
    n = Math.floor(n / ZBASE32.length) + index + 7;
  }
  return `mock${s}`;
};

export function DisabledUsersManagement({
  onDisableUser,
  onEnableUser,
  isDisablingUser = false,
  onOpenInvites,
  numUsersTotal,
  numDisabledUsers,
}: DisabledUsersManagementProps) {
  const { users, isLoading, error, refreshUsers } = useUserManagement();

  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [pubkeyToDisable, setPubkeyToDisable] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<'disable' | 'enable' | null>(null);
  const [copiedPubkey, setCopiedPubkey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock disabled users list (until we have an API). We intentionally use mock pubkeys only.
  const [mockDisabledPubkeys, setMockDisabledPubkeys] = useState<string[]>([]);
  const mockNextIndexRef = useRef(0);

  const usersByPubkey = useMemo(() => {
    return new Map(users.map((u) => [u.pubkey, u]));
  }, [users]);

  const targetDisabledCount = useMemo(() => {
    if (typeof numDisabledUsers === 'number') return Math.max(0, Math.floor(numDisabledUsers));
    return 3;
  }, [numDisabledUsers]);

  // Keep the mock list sized to match the real num_disabled_users.
  useEffect(() => {
    mockNextIndexRef.current = targetDisabledCount;
    setMockDisabledPubkeys(Array.from({ length: targetDisabledCount }, (_, i) => makeMockPubkey(i)));
  }, [targetDisabledCount]);

  const disabledUsers: User[] = useMemo(() => {
    return mockDisabledPubkeys.map((pubkey) => ({
      pubkey,
      displayName: formatDisplayName(pubkey),
    }));
  }, [mockDisabledPubkeys]);

  const filteredDisabledUsers = useMemo(() => {
    if (!searchQuery) return disabledUsers;
    const q = searchQuery.toLowerCase();
    return disabledUsers.filter((u) => u.pubkey.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q));
  }, [disabledUsers, searchQuery]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPubkeyToDisable(text);
      setLocalError(null);
    } catch {
      setLocalError('Failed to read clipboard');
    }
  }, []);

  const handleCopyPubkey = useCallback(async (pubkey: string) => {
    await copyToClipboard({ text: pubkey });
    setCopiedPubkey(pubkey);
    setTimeout(() => setCopiedPubkey(null), 2000);
  }, []);

  const handleDisableByPubkey = useCallback(async () => {
    const pubkey = pubkeyToDisable.trim();
    if (!pubkey) {
      setLocalError('Please enter a pubkey');
      return;
    }

    // If we have a user list, validate against it to catch obvious mistakes early.
    if (users.length > 0 && !usersByPubkey.has(pubkey)) {
      setLocalError('User not found. Please make sure the pubkey is correct.');
      return;
    }

    setProcessingAction('disable');
    setLocalError(null);
    try {
      await onDisableUser(pubkey);
      setPubkeyToDisable('');
      setIsAccessDialogOpen(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to disable user');
    } finally {
      setProcessingAction(null);
    }
  }, [pubkeyToDisable, users.length, usersByPubkey, onDisableUser]);

  const handleEnableByPubkey = useCallback(async () => {
    const pubkey = pubkeyToDisable.trim();
    if (!pubkey) {
      setLocalError('Please enter a pubkey');
      return;
    }

    // If we have a user list, validate against it to catch obvious mistakes early.
    if (users.length > 0 && !usersByPubkey.has(pubkey)) {
      setLocalError('User not found. Please make sure the pubkey is correct.');
      return;
    }

    setProcessingAction('enable');
    setLocalError(null);
    try {
      await onEnableUser(pubkey);
      setPubkeyToDisable('');
      setIsAccessDialogOpen(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to enable user');
    } finally {
      setProcessingAction(null);
    }
  }, [pubkeyToDisable, users.length, usersByPubkey, onEnableUser]);

  const handleEnableUser = useCallback(
    async (pubkey: string) => {
      setProcessingAction('enable');
      setLocalError(null);
      try {
        // This list is mock, so we don't call the backend with mock pubkeys.
        // Instead, we rotate the mock list while preserving the real count.
        setMockDisabledPubkeys((prev) => {
          const next = prev.filter((p) => p !== pubkey);
          while (next.length < targetDisabledCount) {
            next.push(makeMockPubkey(mockNextIndexRef.current++));
          }
          return next.slice(0, targetDisabledCount);
        });
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Failed to enable user');
      } finally {
        setProcessingAction(null);
      }
    },
    [targetDisabledCount],
  );

  const isProcessing = processingAction !== null;

  return (
    <>
      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">Users</CardTitle>
              <CardDescription>Manage invites and user access</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {typeof numUsersTotal === 'number' && (
                <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                  Users: {numUsersTotal}
                </Badge>
              )}
              {onOpenInvites && (
                <Button variant="outline" size="sm" onClick={onOpenInvites} title="Invites" aria-label="Invites">
                  <Key className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshUsers}
                disabled={isLoading}
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {/* Disabled Users */}
          <div>
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">Disabled Users</div>
                  <Badge variant="outline" className="border-dashed text-xs font-normal">
                    <Info className="mr-1 h-3 w-3" />
                    Soon
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">List of disabled users</div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="shrink-0">
                  Disabled: {typeof numDisabledUsers === 'number' ? numDisabledUsers : disabledUsers.length}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLocalError(null);
                    setPubkeyToDisable('');
                    setIsAccessDialogOpen(true);
                  }}
                  title="Disable / Enable User"
                  aria-label="Disable / Enable User"
                >
                  <ShieldOff className="h-4 w-4" />
                </Button>
              </div>
            </div>

          <div className="space-y-3">
            {disabledUsers.length > 0 && (
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search disabled users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-20"
                />
                <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setSearchQuery('')}
                      title="Clear"
                    >
                      <span className="sr-only">Clear</span>✕
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        setSearchQuery(text);
                      } catch {
                        // Handle clipboard error silently
                      }
                    }}
                    title="Paste from clipboard"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {filteredDisabledUsers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <ShieldOff className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>{disabledUsers.length === 0 ? 'No disabled users' : 'No matches'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDisabledUsers.map((user) => (
                  <div key={user.pubkey} className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="truncate font-mono text-sm">{user.displayName}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 shrink-0 p-0"
                          onClick={() => handleCopyPubkey(user.pubkey)}
                          title="Copy full pubkey"
                        >
                          {copiedPubkey === user.pubkey ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{user.pubkey}</p>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleEnableUser(user.pubkey)}
                      disabled={isProcessing || isDisablingUser}
                    >
                      Enable
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isAccessDialogOpen}
        onOpenChange={(open) => {
          setIsAccessDialogOpen(open);
          if (!open) {
            setLocalError(null);
            setPubkeyToDisable('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable / Enable User</DialogTitle>
            <DialogDescription>Enter a user pubkey to disable or enable their account</DialogDescription>
          </DialogHeader>

          {localError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{localError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <div className="relative">
              <Input
                placeholder="Enter pubkey..."
                value={pubkeyToDisable}
                onChange={(e) => {
                  setPubkeyToDisable(e.target.value);
                  setLocalError(null);
                }}
                className="pr-20"
              />
              <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
                {pubkeyToDisable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setPubkeyToDisable('');
                      setLocalError(null);
                    }}
                    title="Clear"
                  >
                    <span className="sr-only">Clear</span>✕
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handlePaste}
                  title="Paste from clipboard"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                onClick={handleDisableByPubkey}
                disabled={!pubkeyToDisable.trim() || isProcessing || isDisablingUser}
                className="w-full"
                variant="destructive"
              >
                {processingAction === 'disable' ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Disabling...
                  </>
                ) : (
                  'Disable'
                )}
              </Button>
                <Button
                  onClick={handleEnableByPubkey}
                  disabled={!pubkeyToDisable.trim() || isProcessing || isDisablingUser}
                  className="w-full"
                  variant="outline"
                >
                  {processingAction === 'enable' ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Enabling...
                    </>
                  ) : (
                    'Enable'
                  )}
                </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAccessDialogOpen(false)} disabled={isProcessing}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
