'use client';

import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useUserManagement } from '@/hooks/user';
import { Users, RefreshCw, Copy } from 'lucide-react';
import { copyToClipboard } from '@/libs/utils';
import { cn } from '@/libs/utils';
import type { UserManagementProps } from './UserManagement.types';

// Move formatStorage outside component to avoid recreation
const formatStorage = (mb?: number): string => {
  if (mb === undefined || mb === null) return '-';
  if (mb < 1) return `${(mb * 1024).toFixed(1)} KB`;
  return `${mb.toFixed(2)} MB`;
};

function UserManagementComponent({ onViewUserFiles }: UserManagementProps) {
  const { users, isLoading, error, refreshUsers } = useUserManagement();
  const [copiedPubkey, setCopiedPubkey] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopyPubkey = useCallback(async (pubkey: string) => {
    await copyToClipboard({ text: pubkey });
    setCopiedPubkey(pubkey);
    
    // Clear existing timeout if any
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setCopiedPubkey(null);
      timeoutRef.current = null;
    }, 2000);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Memoize formatted users to avoid recalculation on every render
  const formattedUsers = useMemo(() => {
    return users.map(user => ({
      ...user,
      formattedStorage: formatStorage(user.storageUsedMB),
    }));
  }, [users]);

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formattedUsers.map((user) => (
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
                      <TableCell>{user.formattedStorage}</TableCell>
                      <TableCell>{user.fileCount ?? '-'}</TableCell>
                      <TableCell>
                        {user.isDisabled ? (
                          <Badge variant="destructive">Disabled</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
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
    </div>
  );
}

// Memoize component to prevent rerenders when parent rerenders with same props
export const UserManagement = memo(UserManagementComponent);

