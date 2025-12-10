'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import type { DashboardUsageProps } from './DashboardUsage.types';

export function DashboardUsage({ usage, isLoading, error, totalDiskMB }: DashboardUsageProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading usage data</AlertTitle>
        <AlertDescription>{error.message || 'Failed to load usage information'}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!usage) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>User Statistics</CardTitle>
          <CardDescription>Total users and signup codes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Users:</span>
            <span className="text-sm font-semibold">{usage.usersTotal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Unused Signup Codes:</span>
            <span className="text-sm font-semibold">{usage.numUnusedSignupCodes}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>Disk usage information</CardDescription>
        </CardHeader>
        <CardContent>
          <ProgressBar
            value={usage.totalDiskUsedMB}
            max={totalDiskMB || usage.totalDiskUsedMB * 2}
            showLabel={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}

