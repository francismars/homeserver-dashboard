'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { copyToClipboard } from '@/libs/utils';
import { useUserManagement } from '@/hooks/user';
import { Check, Clipboard, Copy, Info, RefreshCw, Search, Shield, ShieldOff, Users } from 'lucide-react';
import type { User } from '@/services/user/user.types';

export type DisabledUsersManagementProps = {
  onDisableUser: (pubkey: string) => Promise<void>;
  onEnableUser: (pubkey: string) => Promise<void>;
  isDisablingUser?: boolean;
  onOpenInvites?: () => void;
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
  numDisabledUsers,
}: DisabledUsersManagementProps) {
  const { users, isLoading, error, refreshUsers } = useUserManagement();

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
    return disabledUsers.filter(
      (u) => u.pubkey.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)
    );
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
    [targetDisabledCount]
  );

  const isProcessing = processingAction !== null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Users
              </CardTitle>
              <CardDescription>Manage invites and user access</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refreshUsers} disabled={isLoading}>
                <RefreshCw className={isLoading ? 'h-4 w-4 mr-2 animate-spin' : 'h-4 w-4 mr-2'} />
                Refresh
              </Button>
              {onOpenInvites && (
                <Button variant="default" size="sm" onClick={onOpenInvites}>
                  Invites
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {(error || localError) && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{localError || error?.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disable / Enable User</CardTitle>
          <CardDescription>Enter a user pubkey to disable or enable their account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Input
              placeholder="Enter pubkey to disable..."
              value={pubkeyToDisable}
              onChange={(e) => {
                setPubkeyToDisable(e.target.value);
                setLocalError(null);
              }}
              className="pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
                  <span className="sr-only">Clear</span>
                  ✕
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePaste} title="Paste from clipboard">
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
                <>
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Disable
                </>
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
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Enable
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Disabled Users
                <Badge variant="outline" className="text-xs font-normal border-dashed">
                  <Info className="h-3 w-3 mr-1" />
                  Mock
                </Badge>
              </CardTitle>
              <CardDescription>List of disabled users (API pending)</CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0">
              Total: {typeof numDisabledUsers === 'number' ? numDisabledUsers : disabledUsers.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {disabledUsers.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search disabled users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {filteredDisabledUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{disabledUsers.length === 0 ? 'No disabled users' : 'No matches'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDisabledUsers.map((user) => (
                <div key={user.pubkey} className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono truncate">{user.displayName}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 shrink-0"
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
                    <p className="text-xs text-muted-foreground mt-1 truncate">{user.pubkey}</p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleEnableUser(user.pubkey)}
                    disabled={isProcessing || isDisablingUser}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Enable
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


