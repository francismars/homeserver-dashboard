'use client';

import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUserManagement } from '@/hooks/user';
import { Users, RefreshCw, Copy, Shield, ShieldOff, Calendar, Clock, HardDrive, FileText, Info, Key, Search, Filter, ArrowUpDown, FolderOpen, Eye, LayoutGrid, List, ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, BarChart3, X, Clipboard } from 'lucide-react';
import { copyToClipboard } from '@/libs/utils';
import { cn } from '@/libs/utils';
import { FileBrowser } from '@/components/organisms/FileBrowser';
import type { UserManagementProps } from './UserManagement.types';

// Move formatStorage outside component to avoid recreation
const formatStorage = (mb?: number): string => {
  if (mb === undefined || mb === null) return '-';
  if (mb < 1) return `${(mb * 1024).toFixed(1)} KB`;
  return `${mb.toFixed(2)} MB`;
};

// Mock data for user details (all computed from pubkey for consistency)
const getMockUserDetails = (pubkey: string) => {
  // Generate consistent mock data based on pubkey
  const hash = pubkey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const activityHash = hash % 7;
  return {
    storageUsedMB: (hash % 10000) / 100, // 0-100 MB
    fileCount: hash % 500,
    isDisabled: hash % 10 === 0, // 10% chance of being disabled
    lastActivity: activityHash === 0 ? '2 hours ago' : activityHash === 1 ? '1 day ago' : activityHash === 2 ? '3 days ago' : '1 week ago',
    lastActivityValue: activityHash, // For sorting: 0 = most recent, higher = older
    signupDate: `2024-${String((hash % 12) + 1).padStart(2, '0')}-${String((hash % 28) + 1).padStart(2, '0')}`,
    apiRequests: hash % 1000,
    sessions: hash % 5 + 1,
  };
};

const MOCK_EXPLANATION = `This section contains mock data. Storage usage, file counts, and user status require additional DAV calls or API endpoints. Currently, only the root directory is scanned to get user pubkeys. To get real data, the backend would need to expose storage/file statistics or make additional DAV calls to each user's directory.`;

type StatusFilter = 'all' | 'active' | 'disabled';
type SortField = 'pubkey' | 'storage' | 'activity' | 'status';
type SortDirection = 'asc' | 'desc';
type SortOption = { field: SortField; direction: SortDirection };

// Memoized User Card Component to prevent unnecessary re-renders
const UserCard = memo(({ 
  user, 
  mockDetails, 
  copiedPubkey, 
  onCopyPubkey, 
  onDisableClick, 
  onViewFiles,
  onViewDetails,
  isDisablingUser 
}: {
  user: { pubkey: string; displayName: string };
  mockDetails: ReturnType<typeof getMockUserDetails>;
  copiedPubkey: string | null;
  onCopyPubkey: (pubkey: string) => void;
  onDisableClick: (pubkey: string, isDisabled: boolean) => void;
  onViewFiles?: (pubkey: string) => void;
  onViewDetails?: (pubkey: string) => void;
  isDisablingUser: boolean;
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card
          className={cn(
            'relative border-dashed border-2 border-muted-foreground/30',
            'hover:border-muted-foreground/50 transition-colors cursor-help'
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <code className="text-xs font-mono truncate">{user.displayName}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyPubkey(user.pubkey);
                    }}
                    title="Copy full pubkey"
                  >
                    {copiedPubkey === user.pubkey ? (
                      <Copy className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-xs font-normal border-dashed">
                  <Info className="h-3 w-3 mr-1" />
                  Mock
                </Badge>
                {mockDetails.isDisabled ? (
                  <Badge variant="destructive" className="text-xs">Disabled</Badge>
                ) : (
                  <Badge variant="default" className="text-xs">Active</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* All User Data (Mock) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground/70 italic">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  <span>Storage:</span>
                </div>
                <span className="font-semibold">{formatStorage(mockDetails.storageUsedMB)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground/70 italic">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Files:</span>
                </div>
                <span className="font-semibold">{mockDetails.fileCount}</span>
              </div>
            </div>

            {/* Additional Mock Details */}
            <div className="pt-3 border-t border-dashed border-muted-foreground/20 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground/70 italic">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>Last Activity:</span>
                </div>
                <span>{mockDetails.lastActivity}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground/70 italic">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>Signup Date:</span>
                </div>
                <span>{mockDetails.signupDate}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground/70 italic">
                <span>API Requests:</span>
                <span>{mockDetails.apiRequests.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground/70 italic">
                <span>Active Sessions:</span>
                <span>{mockDetails.sessions}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t space-y-2">
              <div className="flex gap-2">
                {onViewFiles && (
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewFiles(user.pubkey);
                    }}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    View Files
                  </Button>
                )}
                {onViewDetails && (
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(user.pubkey);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Details
                  </Button>
                )}
              </div>
              <Button
                variant={mockDetails.isDisabled ? "outline" : "outline"}
                size="sm"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onDisableClick(user.pubkey, mockDetails.isDisabled);
                }}
                disabled={isDisablingUser}
              >
                {mockDetails.isDisabled ? (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Enable User
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4 mr-2" />
                    Disable User
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <p className="text-sm">{MOCK_EXPLANATION}</p>
      </TooltipContent>
    </Tooltip>
  );
});
UserCard.displayName = 'UserCard';

function UserManagementComponent({ onViewUserFiles, onDisableUser, isDisablingUser, onOpenInvites, onOpenStats }: UserManagementProps) {
  const { users, isLoading, error, refreshUsers } = useUserManagement();
  const [copiedPubkey, setCopiedPubkey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>({ field: 'pubkey', direction: 'asc' });
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [showFilesForUser, setShowFilesForUser] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [userToDisable, setUserToDisable] = useState<{ pubkey: string; isDisabled: boolean } | null>(null);
  const [userToViewDetails, setUserToViewDetails] = useState<{ pubkey: string; displayName: string } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      searchTimeoutRef.current = null;
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleDisableClick = useCallback((pubkey: string, isDisabled: boolean) => {
    setUserToDisable({ pubkey, isDisabled });
  }, []);

  const handleConfirmDisable = useCallback(async () => {
    if (userToDisable && onDisableUser) {
      try {
        await onDisableUser(userToDisable.pubkey);
        setUserToDisable(null);
      } catch (err) {
        // Error handled by parent
      }
    }
  }, [userToDisable, onDisableUser]);

  const handleViewFiles = useCallback((pubkey: string) => {
    // Navigate to user's /pub/ directory
    setShowFilesForUser(pubkey);
    if (onViewUserFiles) {
      onViewUserFiles(pubkey);
    }
  }, [onViewUserFiles]);

  const handleViewDetails = useCallback((pubkey: string) => {
    const user = users.find(u => u.pubkey === pubkey);
    if (user) {
      setUserToViewDetails({ pubkey: user.pubkey, displayName: user.displayName });
    }
  }, [users]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setSearchQuery(text);
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Pre-compute mock details for all users to avoid recalculating
  const usersWithMockDetails = useMemo(() => {
    return users.map(user => ({
      user,
      mockDetails: getMockUserDetails(user.pubkey),
    }));
  }, [users]);

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    // First filter
    let filtered = usersWithMockDetails.filter(({ user, mockDetails }) => {
      // Search filter
      const matchesSearch = debouncedSearchQuery === '' || 
        user.pubkey.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        user.displayName.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && !mockDetails.isDisabled) ||
        (statusFilter === 'disabled' && mockDetails.isDisabled);
      
      return matchesSearch && matchesStatus;
    });

    // Then sort (only if in list view, cards view uses default alphabetical)
    if (viewMode === 'list') {
      filtered.sort((a, b) => {
        const { mockDetails: mockA } = a;
        const { mockDetails: mockB } = b;

        let comparison = 0;
        switch (sortOption.field) {
          case 'pubkey':
            comparison = a.user.pubkey.localeCompare(b.user.pubkey);
            break;
          case 'storage':
            comparison = mockA.storageUsedMB - mockB.storageUsedMB;
            break;
          case 'activity':
            // Most recent first (lower value = more recent)
            comparison = mockA.lastActivityValue - mockB.lastActivityValue;
            break;
          case 'status':
            // Active first (false < true)
            comparison = Number(mockA.isDisabled) - Number(mockB.isDisabled);
            break;
        }
        
        return sortOption.direction === 'asc' ? comparison : -comparison;
      });
    } else {
      // Cards view: default alphabetical by pubkey
      filtered.sort((a, b) => a.user.pubkey.localeCompare(b.user.pubkey));
    }

    return filtered;
  }, [usersWithMockDetails, debouncedSearchQuery, statusFilter, sortOption, viewMode]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredAndSortedUsers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, statusFilter, sortOption]);

  // If showing files for a user, display file browser
  if (showFilesForUser) {
    const user = users.find(u => u.pubkey === showFilesForUser);
    const userFilesPath = `/${showFilesForUser}/pub/`;
    
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilesForUser(null)}
                    className="h-8 w-8 p-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5" />
                      Files for {user?.displayName || showFilesForUser.substring(0, 8)}...
                    </CardTitle>
                    <CardDescription>Browse files for this user</CardDescription>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
        <FileBrowser initialPath={userFilesPath} />
      </div>
    );
  }

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
              {onOpenStats && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenStats}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Stats
                </Button>
              )}
              {onOpenInvites && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onOpenInvites}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Invites
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters and Sort */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by pubkey..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-20"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleClearSearch}
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
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
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 rounded-r-none"
                onClick={() => setViewMode('cards')}
                title="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 rounded-l-none border-l"
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error loading users</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAndSortedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>
                {users.length === 0 
                  ? 'No users found' 
                  : `No users match your filters (${users.length} total)`}
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            <TooltipProvider>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {paginatedUsers.map(({ user, mockDetails }) => (
                  <UserCard
                    key={user.pubkey}
                    user={user}
                    mockDetails={mockDetails}
                    copiedPubkey={copiedPubkey}
                    onCopyPubkey={handleCopyPubkey}
                    onDisableClick={handleDisableClick}
                    onViewFiles={handleViewFiles}
                    onViewDetails={handleViewDetails}
                    isDisablingUser={isDisablingUser || false}
                  />
                ))}
              </div>
            </TooltipProvider>
          ) : (
            <div className="border rounded-md">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th 
                      className="text-left p-3 text-sm font-semibold cursor-pointer hover:bg-muted/70 select-none"
                      onClick={() => {
                        setSortOption(prev => 
                          prev.field === 'pubkey' 
                            ? { field: 'pubkey', direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                            : { field: 'pubkey', direction: 'asc' }
                        );
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>User</span>
                        {sortOption.field === 'pubkey' && (
                          sortOption.direction === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </th>
                    <th 
                      className="text-left p-3 text-sm font-semibold cursor-pointer hover:bg-muted/70 select-none"
                      onClick={() => {
                        setSortOption(prev => 
                          prev.field === 'status' 
                            ? { field: 'status', direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                            : { field: 'status', direction: 'asc' }
                        );
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>Status</span>
                        {sortOption.field === 'status' && (
                          sortOption.direction === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </th>
                    <th 
                      className="text-left p-3 text-sm font-semibold cursor-pointer hover:bg-muted/70 select-none"
                      onClick={() => {
                        setSortOption(prev => 
                          prev.field === 'storage' 
                            ? { field: 'storage', direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                            : { field: 'storage', direction: 'asc' }
                        );
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>Storage</span>
                        {sortOption.field === 'storage' && (
                          sortOption.direction === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </th>
                    <th className="text-left p-3 text-sm font-semibold">Files</th>
                    <th 
                      className="text-left p-3 text-sm font-semibold cursor-pointer hover:bg-muted/70 select-none"
                      onClick={() => {
                        setSortOption(prev => 
                          prev.field === 'activity' 
                            ? { field: 'activity', direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                            : { field: 'activity', direction: 'asc' }
                        );
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>Last Activity</span>
                        {sortOption.field === 'activity' && (
                          sortOption.direction === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </th>
                    <th className="text-right p-3 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map(({ user, mockDetails }) => (
                    <tr
                      key={user.pubkey}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono truncate">{user.displayName}</code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyPubkey(user.pubkey);
                                }}
                                title="Copy full pubkey"
                              >
                                {copiedPubkey === user.pubkey ? (
                                  <Copy className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">{user.pubkey}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-normal border-dashed">
                            <Info className="h-3 w-3 mr-1" />
                            Mock
                          </Badge>
                          {mockDetails.isDisabled ? (
                            <Badge variant="destructive" className="text-xs">Disabled</Badge>
                          ) : (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground italic">
                        {formatStorage(mockDetails.storageUsedMB)}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground italic">
                        {mockDetails.fileCount}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground italic">
                        {mockDetails.lastActivity}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          {onViewUserFiles && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleViewFiles(user.pubkey)}
                              title="View Files"
                            >
                              <FolderOpen className="h-4 w-4" />
                            </Button>
                          )}
                          {handleViewDetails && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleViewDetails(user.pubkey)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            onClick={() => handleDisableClick(user.pubkey, mockDetails.isDisabled)}
                            disabled={isDisablingUser}
                            title={mockDetails.isDisabled ? 'Enable User' : 'Disable User'}
                          >
                            {mockDetails.isDisabled ? (
                              <Shield className="h-4 w-4" />
                            ) : (
                              <ShieldOff className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredAndSortedUsers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
              <div className="text-sm text-muted-foreground">
                Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(endIndex, filteredAndSortedUsers.length)}</strong> of <strong>{filteredAndSortedUsers.length}</strong> users
                {filteredAndSortedUsers.length < users.length && (
                  <span> (filtered from <strong>{users.length}</strong> total)</span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Items per page:</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6</SelectItem>
                      <SelectItem value="12">12</SelectItem>
                      <SelectItem value="24">24</SelectItem>
                      <SelectItem value="48">48</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    title="First page"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    title="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage <= 2) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 1) {
                        pageNum = totalPages - 2 + i;
                      } else {
                        pageNum = currentPage - 1 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    title="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    title="Last page"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disable User Confirmation Dialog */}
      <Dialog open={!!userToDisable} onOpenChange={(open) => !open && setUserToDisable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userToDisable?.isDisabled ? 'Enable User' : 'Disable User'}
            </DialogTitle>
            <DialogDescription>
              {userToDisable?.isDisabled
                ? 'Are you sure you want to enable this user? They will be able to access the homeserver again.'
                : 'Are you sure you want to disable this user? They will not be able to access the homeserver.'}
            </DialogDescription>
          </DialogHeader>
          {userToDisable && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                <strong>User Pubkey:</strong>
              </p>
              <code className="block mt-1 rounded bg-muted px-2 py-1 font-mono text-xs break-all">
                {userToDisable.pubkey}
              </code>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserToDisable(null)}
              disabled={isDisablingUser}
            >
              Cancel
            </Button>
            <Button
              variant={userToDisable?.isDisabled ? "default" : "destructive"}
              onClick={handleConfirmDisable}
              disabled={isDisablingUser}
            >
              {isDisablingUser ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </>
              ) : (
                <>
                  {userToDisable?.isDisabled ? (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Enable User
                    </>
                  ) : (
                    <>
                      <ShieldOff className="h-4 w-4 mr-2" />
                      Disable User
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog open={!!userToViewDetails} onOpenChange={(open) => !open && setUserToViewDetails(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Detailed information about this user account
            </DialogDescription>
          </DialogHeader>
          {userToViewDetails && (() => {
            const details = getMockUserDetails(userToViewDetails.pubkey);
            return (
              <div className="space-y-6 py-4">
                {/* User Identity */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">User Identity</h3>
                  <div className="rounded-md border bg-muted/50 p-4 space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Display Name</p>
                      <p className="text-sm font-mono">{userToViewDetails.displayName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Public Key</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono break-all bg-background px-2 py-1 rounded">
                          {userToViewDetails.pubkey}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleCopyPubkey(userToViewDetails.pubkey)}
                          title="Copy pubkey"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Status */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Account Status</h3>
                  <div className="rounded-md border bg-muted/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {details.isDisabled ? (
                        <Badge variant="destructive">Disabled</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Signup Date</span>
                      <span className="text-sm font-medium">{details.signupDate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Activity</span>
                      <span className="text-sm font-medium">{details.lastActivity}</span>
                    </div>
                  </div>
                </div>

                {/* Storage Information */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Storage Information</h3>
                  <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground italic">Storage Used</span>
                      </div>
                      <span className="text-sm font-medium italic">{formatStorage(details.storageUsedMB)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground italic">File Count</span>
                      </div>
                      <span className="text-sm font-medium italic">{details.fileCount}</span>
                    </div>
                    <div className="pt-2 border-t border-dashed border-muted-foreground/20">
                      <p className="text-xs text-muted-foreground/60 italic">
                        <Info className="h-3 w-3 inline mr-1" />
                        Storage data is mock. Real data requires additional API endpoints or DAV calls.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Activity Statistics */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Activity Statistics</h3>
                  <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground italic">API Requests</span>
                      <span className="text-sm font-medium italic">{details.apiRequests.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground italic">Active Sessions</span>
                      <span className="text-sm font-medium italic">{details.sessions}</span>
                    </div>
                    <div className="pt-2 border-t border-dashed border-muted-foreground/20">
                      <p className="text-xs text-muted-foreground/60 italic">
                        <Info className="h-3 w-3 inline mr-1" />
                        Activity statistics are mock. Real data requires backend tracking.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToViewDetails(null)}>
              Close
            </Button>
            {userToViewDetails && onViewUserFiles && (
              <Button onClick={() => {
                onViewUserFiles(userToViewDetails.pubkey);
                setUserToViewDetails(null);
              }}>
                <FolderOpen className="h-4 w-4 mr-2" />
                View Files
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Memoize component to prevent rerenders when parent rerenders with same props
export const UserManagement = memo(UserManagementComponent);

