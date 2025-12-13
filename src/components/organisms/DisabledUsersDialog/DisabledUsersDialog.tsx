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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, ShieldOff, Copy, Check, X as XIcon, Search, Clipboard } from 'lucide-react';
import { copyToClipboard } from '@/libs/utils';
import { cn } from '@/libs/utils';
import type { User } from '@/services/user/user.types';

interface DisabledUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  disabledUsers: User[];
  onDisableUser: (pubkey: string) => Promise<void>;
  onEnableUser: (pubkey: string) => Promise<void>;
  isDisablingUser?: boolean;
}

export function DisabledUsersDialog({
  open,
  onOpenChange,
  users,
  disabledUsers,
  onDisableUser,
  onEnableUser,
  isDisablingUser = false,
}: DisabledUsersDialogProps) {
  const [pubkeyToDisable, setPubkeyToDisable] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedPubkey, setCopiedPubkey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDisabledUsers = useMemo(() => {
    if (!searchQuery) return disabledUsers;
    const query = searchQuery.toLowerCase();
    return disabledUsers.filter(
      (user) =>
        user.pubkey.toLowerCase().includes(query) ||
        user.displayName.toLowerCase().includes(query)
    );
  }, [disabledUsers, searchQuery]);

  const handleDisableByPubkey = useCallback(async () => {
    if (!pubkeyToDisable.trim()) {
      setError('Please enter a pubkey');
      return;
    }

    // Check if user exists in the users list
    const userExists = users.some((u) => u.pubkey === pubkeyToDisable.trim());
    if (!userExists) {
      setError('User not found. Please make sure the pubkey is correct.');
      return;
    }

    // Check if already disabled
    const alreadyDisabled = disabledUsers.some((u) => u.pubkey === pubkeyToDisable.trim());
    if (alreadyDisabled) {
      setError('This user is already disabled.');
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      await onDisableUser(pubkeyToDisable.trim());
      setPubkeyToDisable('');
      // Refresh will be handled by parent
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable user');
    } finally {
      setIsProcessing(false);
    }
  }, [pubkeyToDisable, users, disabledUsers, onDisableUser]);

  const handleEnableUser = useCallback(
    async (pubkey: string) => {
      setIsProcessing(true);
      setError(null);
      try {
        await onEnableUser(pubkey);
        // Refresh will be handled by parent
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to enable user');
      } finally {
        setIsProcessing(false);
      }
    },
    [onEnableUser]
  );

  const handleCopyPubkey = useCallback(async (pubkey: string) => {
    await copyToClipboard({ text: pubkey });
    setCopiedPubkey(pubkey);
    setTimeout(() => setCopiedPubkey(null), 2000);
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPubkeyToDisable(text);
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5" />
            Disabled Users Management
          </DialogTitle>
          <DialogDescription>
            View and manage disabled users. You can disable users by entering their pubkey.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Disable User by Pubkey */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Disable User by Pubkey</CardTitle>
              <CardDescription>Enter a user's pubkey to disable their account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Input
                  placeholder="Enter pubkey to disable..."
                  value={pubkeyToDisable}
                  onChange={(e) => {
                    setPubkeyToDisable(e.target.value);
                    setError(null);
                  }}
                  className="pr-20"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                  {pubkeyToDisable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setPubkeyToDisable('');
                        setError(null);
                      }}
                      title="Clear"
                    >
                      <XIcon className="h-3.5 w-3.5" />
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
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleDisableByPubkey}
                disabled={!pubkeyToDisable.trim() || isProcessing || isDisablingUser}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Disabling...
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4 mr-2" />
                    Disable User
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Disabled Users List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Disabled Users ({disabledUsers.length})
                  </CardTitle>
                  <CardDescription>List of all disabled user accounts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Search */}
              {disabledUsers.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                  <p>
                    {disabledUsers.length === 0
                      ? 'No disabled users'
                      : 'No disabled users match your search'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDisabledUsers.map((user) => (
                    <div
                      key={user.pubkey}
                      className="flex items-center justify-between rounded-md border bg-muted/50 p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono truncate">{user.displayName}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0"
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

