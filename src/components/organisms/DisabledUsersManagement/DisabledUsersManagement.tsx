'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { copyToClipboard } from '@/libs/utils';
import { Check, ClipboardPaste, Copy, Info, Search, ShieldBan } from 'lucide-react';
import type { User } from '@/services/user/user.types';

export type DisabledUsersManagementProps = {
  onDisableUser: (pubkey: string) => Promise<void>;
  onEnableUser: (pubkey: string) => Promise<void>;
  isDisablingUser?: boolean;
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
  numUsersTotal,
  numDisabledUsers,
}: DisabledUsersManagementProps) {
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [pubkeyToDisable, setPubkeyToDisable] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<'disable' | 'enable' | null>(null);
  const [copiedPubkey, setCopiedPubkey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock disabled users list (until we have an API). We intentionally use mock pubkeys only.
  const [mockDisabledPubkeys, setMockDisabledPubkeys] = useState<string[]>([]);
  const mockNextIndexRef = useRef(0);

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
  }, [pubkeyToDisable, onDisableUser]);

  const handleEnableByPubkey = useCallback(async () => {
    const pubkey = pubkeyToDisable.trim();
    if (!pubkey) {
      setLocalError('Please enter a pubkey');
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
  }, [pubkeyToDisable, onEnableUser]);

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
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">Users</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Manage invites and user access</CardDescription>
            </div>
            {typeof numUsersTotal === 'number' && (
              <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                Users: {numUsersTotal}
              </Badge>
            )}
          </div>
        </CardHeader>

        {/* Inset separator between the header and the content (lighter than a full divider) */}
        <div className="mx-6 h-px bg-border/60" />

        <CardContent className="space-y-6 pt-4">
          {/* Disabled Users */}
          <div>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium">Disabled Users</div>
                  <Badge variant="outline" className="border-dashed text-xs font-normal">
                    <Info className="mr-1 h-3 w-3" />
                    Soon
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">List of disabled users</div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary" className="shrink-0 text-xs">
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
                  title="Disable or enable user"
                  aria-label="Disable or enable user"
                >
                  <ShieldBan className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {disabledUsers.length > 0 && (
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search disabled users"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-20 pl-9"
                  />
                  <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
                    {searchQuery ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setSearchQuery('')}
                        title="Clear"
                      >
                        <span className="sr-only">Clear</span>✕
                      </Button>
                    ) : (
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
                        <ClipboardPaste className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {filteredDisabledUsers.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <ShieldBan className="mx-auto mb-2 h-12 w-12 opacity-50" />
                  <p>{disabledUsers.length === 0 ? 'No disabled users' : 'No matches'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDisabledUsers.map((user) => (
                    <div
                      key={user.pubkey}
                      className="flex flex-col gap-3 rounded-md border bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="truncate font-mono text-xs sm:text-sm">{user.displayName}</code>
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
                        <p className="mt-1 truncate text-xs break-all text-muted-foreground sm:break-normal">
                          {user.pubkey}
                        </p>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleEnableUser(user.pubkey)}
                        disabled={isProcessing || isDisablingUser}
                        className="w-full shrink-0 sm:w-auto"
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
        <DialogContent className="space-y-2 sm:space-y-3 pt-5 pb-4 sm:pt-6 sm:pb-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold sm:text-2xl">
              Disable or enable user
            </DialogTitle>
            <DialogDescription className="text-sm">
              Enter a user pubky to disable or enable their account
            </DialogDescription>
          </DialogHeader>

          {localError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{localError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3 sm:space-y-4">
            {/* Pubkey field */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                User pubky
              </div>
              <div className="flex items-center rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2.5">
                <Input
                  placeholder="Enter pubky"
                  value={pubkeyToDisable}
                  onChange={(e) => {
                    setPubkeyToDisable(e.target.value);
                    setLocalError(null);
                  }}
                  className="border-0 bg-transparent px-0 py-0 text-sm shadow-none ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <div className="ml-2 flex items-center gap-1">
                  {pubkeyToDisable ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full bg-transparent text-muted-foreground hover:bg-muted/30"
                      onClick={() => {
                        setPubkeyToDisable('');
                        setLocalError(null);
                      }}
                      title="Clear"
                    >
                      <span className="sr-only">Clear</span>✕
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full bg-transparent text-muted-foreground hover:bg-muted/30"
                      onClick={handlePaste}
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                onClick={handleDisableByPubkey}
                disabled={!pubkeyToDisable.trim() || isProcessing || isDisablingUser}
                className="w-full justify-center"
                size="lg"
                variant="destructive"
              >
                {processingAction === 'disable' ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span className="hidden sm:inline">Disabling...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  'Disable'
                )}
              </Button>
              <Button
                onClick={handleEnableByPubkey}
                disabled={!pubkeyToDisable.trim() || isProcessing || isDisablingUser}
                className="w-full justify-center"
                size="lg"
                variant="default"
              >
                {processingAction === 'enable' ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span className="hidden sm:inline">Enabling...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  'Enable'
                )}
              </Button>
            </div>
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
}
