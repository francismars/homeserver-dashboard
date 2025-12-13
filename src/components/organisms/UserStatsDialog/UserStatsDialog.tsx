'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { Button } from '@/components/ui/button';
import { Users, Info, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/libs/utils';
import type { AdminInfoResponse, AdminUsageResponse } from '@/services/admin/admin.types';

// Mock data
const MOCK_TOP_USERS = [
  { pubkey: 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o', storageMB: 8542.3, files: 1247, percentage: 18.9 },
  { pubkey: 'y9nncs6ihtjuaq8djhgfxwnqry9k6d0pu5lyf2tgobjfrzt0r7p', storageMB: 6234.1, files: 892, percentage: 13.8 },
  { pubkey: 'z0oodt7jiukvbr9ekihgyxorz0l7e1qv6mzg3uhpckgssau1s8q', storageMB: 5123.7, files: 654, percentage: 11.3 },
  { pubkey: 'a1ppeu8kjvlwcs0fljihzypsa1m8f2rw7nah4viqdlhhtbv2t9r', storageMB: 4231.2, files: 521, percentage: 9.4 },
  { pubkey: 'b2qqfv9lkmwxdt1gmkjiazqtb2n9g3sx8obij5wjremiuwc3u0s', storageMB: 3892.5, files: 478, percentage: 8.6 },
];

const MOCK_USERS_BY_INVITE = [
  { inviteCode: 'INV-2024-001', userCount: 23, percentage: 26.4 },
  { inviteCode: 'INV-2024-002', userCount: 18, percentage: 20.7 },
  { inviteCode: 'INV-2024-003', userCount: 15, percentage: 17.2 },
  { inviteCode: 'INV-2024-004', userCount: 12, percentage: 13.8 },
  { inviteCode: 'INV-2024-005', userCount: 8, percentage: 9.2 },
  { inviteCode: 'INV-2024-006', userCount: 5, percentage: 5.7 },
  { inviteCode: 'INV-2024-007', userCount: 3, percentage: 3.4 },
  { inviteCode: 'Other', userCount: 3, percentage: 3.4 },
];

const MOCK_STORAGE_DISTRIBUTION = [
  { range: '0-1 GB', userCount: 45, percentage: 51.7 },
  { range: '1-5 GB', userCount: 28, percentage: 32.2 },
  { range: '5-10 GB', userCount: 10, percentage: 11.5 },
  { range: '10+ GB', userCount: 4, percentage: 4.6 },
];

const MOCK_QUOTA_USERS = [
  { pubkey: 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o', quotaMB: 10240, usedMB: 8542.3, percentage: 83.4 },
  { pubkey: 'y9nncs6ihtjuaq8djhgfxwnqry9k6d0pu5lyf2tgobjfrzt0r7p', quotaMB: 10240, usedMB: 6234.1, percentage: 60.9 },
  { pubkey: 'z0oodt7jiukvbr9ekihgyxorz0l7e1qv6mzg3uhpckgssau1s8q', quotaMB: 10240, usedMB: 5123.7, percentage: 50.0 },
];

const MOCK_EXPLANATIONS = {
  topUsers: `This is mock data. Top users by storage requires the backend to provide per-user storage breakdowns. The /usage endpoint could be extended to include a sorted list of users by storage usage, or this could be calculated by aggregating WebDAV directory sizes.`,
  usersByInvite: `This is mock data. Users by invite code requires tracking which invite code was used during signup. This would need to be stored in the database when users sign up and then aggregated for reporting. The backend would need to expose this data through the /usage endpoint.`,
  storageDistribution: `This is mock data. Storage distribution requires calculating how many users fall into each storage tier. This can be derived from per-user storage data, but requires backend aggregation or frontend calculation from user storage data.`,
  quotaUtilization: `This is mock data. Quota utilization requires knowing both the quota limit per user (from config) and current usage per user. This can be calculated by comparing user storage against configured quotas, but requires backend support for quota configuration and per-user storage tracking.`,
};

interface UserStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usage?: AdminUsageResponse | null;
  info?: AdminInfoResponse | null;
}

const formatStorage = (mb: number): string => {
  if (mb < 1) return `${(mb * 1024).toFixed(1)} KB`;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
};

export function UserStatsDialog({ open, onOpenChange, usage, info }: UserStatsDialogProps) {
  if (!usage) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Statistics
          </DialogTitle>
          <DialogDescription>
            Comprehensive statistics about users, storage, and signup codes
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-2">
          {/* User Statistics Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Accounts
              </CardTitle>
              <CardDescription>User accounts and status breakdown</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Total Users */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Users:</span>
                  <span className="text-2xl font-bold">{usage.usersTotal}</span>
                </div>
                {info && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Active Users:</span>
                      <span className="font-semibold text-green-600">
                        {usage.usersTotal - (info.num_disabled_users || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Disabled Users:</span>
                      <span className="font-semibold text-destructive">
                        {info.num_disabled_users || 0}
                      </span>
                    </div>
                    {info.num_disabled_users > 0 && (
                      <ProgressBar
                        value={((info.num_disabled_users || 0) / usage.usersTotal) * 100}
                        max={100}
                        showLabel={false}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Signup Codes */}
              <div className="pt-3 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Signup Codes:</span>
                  <span className="text-lg font-semibold">{info?.num_signup_codes || usage.numUnusedSignupCodes}</span>
                </div>
                {info && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Used:</span>
                      <span className="font-semibold">
                        {(info.num_signup_codes || 0) - usage.numUnusedSignupCodes}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Unused:</span>
                      <span className="font-semibold text-muted-foreground">
                        {usage.numUnusedSignupCodes}
                      </span>
                    </div>
                    <ProgressBar
                      value={((info.num_signup_codes || 0) - usage.numUnusedSignupCodes) / (info.num_signup_codes || 1) * 100}
                      max={100}
                      showLabel={false}
                    />
                    <div className="text-xs text-muted-foreground">
                      {info.num_signup_codes > 0
                        ? `${(((info.num_signup_codes - usage.numUnusedSignupCodes) / info.num_signup_codes) * 100).toFixed(1)}% utilization`
                        : 'No signup codes'}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <TooltipProvider>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Top Users by Storage */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={cn(
                      'relative border-dashed border-2 border-muted-foreground/30',
                      'hover:border-muted-foreground/50 transition-colors cursor-help'
                    )}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Top Users by Storage
                        <Badge variant="outline" className="text-xs font-normal border-dashed">
                          <Info className="h-3 w-3 mr-1" />
                          Mock
                        </Badge>
                      </CardTitle>
                      <CardDescription>Users with highest storage usage</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">User</TableHead>
                              <TableHead>Storage</TableHead>
                              <TableHead>Files</TableHead>
                              <TableHead className="text-right">%</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {MOCK_TOP_USERS.map((user) => (
                              <TableRow key={user.pubkey}>
                                <TableCell className="font-mono text-xs text-muted-foreground/70 italic">
                                  {user.pubkey.substring(0, 12)}...
                                </TableCell>
                                <TableCell className="text-muted-foreground/70 italic">
                                  {formatStorage(user.storageMB)}
                                </TableCell>
                                <TableCell className="text-muted-foreground/70 italic">
                                  {user.files}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground/70 italic">
                                  {user.percentage}%
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/20">
                        <p className="text-xs text-muted-foreground/60 italic">
                          Hover for implementation details
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  <p className="text-sm">{MOCK_EXPLANATIONS.topUsers}</p>
                </TooltipContent>
              </Tooltip>

              {/* Users by Invite Code */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={cn(
                      'relative border-dashed border-2 border-muted-foreground/30',
                      'hover:border-muted-foreground/50 transition-colors cursor-help'
                    )}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Users by Invite Code
                        <Badge variant="outline" className="text-xs font-normal border-dashed">
                          <Info className="h-3 w-3 mr-1" />
                          Mock
                        </Badge>
                      </CardTitle>
                      <CardDescription>Signup code effectiveness</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Invite Code</TableHead>
                              <TableHead>Users</TableHead>
                              <TableHead className="text-right">%</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {MOCK_USERS_BY_INVITE.map((item) => (
                              <TableRow key={item.inviteCode}>
                                <TableCell className="font-mono text-xs text-muted-foreground/70 italic">
                                  {item.inviteCode}
                                </TableCell>
                                <TableCell className="text-muted-foreground/70 italic">
                                  {item.userCount}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground/70 italic">
                                  {item.percentage}%
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/20">
                        <p className="text-xs text-muted-foreground/60 italic">
                          Hover for implementation details
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  <p className="text-sm">{MOCK_EXPLANATIONS.usersByInvite}</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Storage Distribution */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={cn(
                      'relative border-dashed border-2 border-muted-foreground/30',
                      'hover:border-muted-foreground/50 transition-colors cursor-help'
                    )}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Storage Distribution
                        <Badge variant="outline" className="text-xs font-normal border-dashed">
                          <Info className="h-3 w-3 mr-1" />
                          Mock
                        </Badge>
                      </CardTitle>
                      <CardDescription>Users by storage tier</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {MOCK_STORAGE_DISTRIBUTION.map((tier) => (
                        <div key={tier.range} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{tier.range}</span>
                            <span className="text-muted-foreground/70 italic">
                              {tier.userCount} users ({tier.percentage}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary/50"
                              style={{ width: `${tier.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/20">
                        <p className="text-xs text-muted-foreground/60 italic">
                          Hover for implementation details
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  <p className="text-sm">{MOCK_EXPLANATIONS.storageDistribution}</p>
                </TooltipContent>
              </Tooltip>

              {/* Quota Utilization */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={cn(
                      'relative border-dashed border-2 border-muted-foreground/30',
                      'hover:border-muted-foreground/50 transition-colors cursor-help'
                    )}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Quota Utilization
                        <Badge variant="outline" className="text-xs font-normal border-dashed">
                          <Info className="h-3 w-3 mr-1" />
                          Mock
                        </Badge>
                      </CardTitle>
                      <CardDescription>Users approaching limits</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {MOCK_QUOTA_USERS.map((user) => (
                        <div key={user.pubkey} className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-muted-foreground/70 italic">
                              {user.pubkey.substring(0, 16)}...
                            </span>
                            <span className={cn(
                              'text-xs font-semibold',
                              user.percentage >= 80 ? 'text-destructive' : 
                              user.percentage >= 60 ? 'text-yellow-500' : 
                              'text-muted-foreground/70'
                            )}>
                              {user.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full transition-all',
                                user.percentage >= 80 ? 'bg-destructive' : 
                                user.percentage >= 60 ? 'bg-yellow-500' : 
                                'bg-primary/50'
                              )}
                              style={{ width: `${user.percentage}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground/60">
                            <span>{formatStorage(user.usedMB)}</span>
                            <span>/ {formatStorage(user.quotaMB)}</span>
                          </div>
                        </div>
                      ))}
                      <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/20">
                        <p className="text-xs text-muted-foreground/60 italic">
                          Hover for implementation details
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  <p className="text-sm">{MOCK_EXPLANATIONS.quotaUtilization}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
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

