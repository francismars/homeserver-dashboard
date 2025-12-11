'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatCard } from '@/components/atoms/StatCard';
import { EnvInfo } from '@/components/molecules/EnvInfo';
import { Users, HardDrive, Shield, Key, Server } from 'lucide-react';
import type { DashboardOverviewProps } from './DashboardOverview.types';

export function DashboardOverview({ info, isLoading, error }: DashboardOverviewProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading server info</AlertTitle>
        <AlertDescription>{error.message || 'Failed to load server information'}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!info) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={info.num_users.toString()} icon={Users} intent="default" />
        <StatCard
          label="Disabled Users"
          value={info.num_disabled_users.toString()}
          icon={Shield}
          intent={info.num_disabled_users > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Disk Used" value={`${info.total_disk_used_mb} MB`} icon={HardDrive} intent="default" />
        <StatCard label="Signup Codes" value={info.num_signup_codes.toString()} icon={Key} intent="default" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Server Information</CardTitle>
            <CardDescription>Basic homeserver details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Address:</span>
              <span className="text-sm font-mono">{info.address || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Version:</span>
              <span className="text-sm">{info.version || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Pubkey:</span>
              <span className="text-sm font-mono text-xs">{info.pubkey || 'N/A'}</span>
            </div>
          </CardContent>
        </Card>

        <EnvInfo />
      </div>
    </div>
  );
}

