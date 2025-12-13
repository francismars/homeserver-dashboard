'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminInfo, useAdminUsage, useAdminActions } from '@/hooks/admin';
import { DashboardNavbar } from '@/components/organisms/DashboardNavbar';
import { DashboardOverview } from '@/components/organisms/DashboardOverview';
import { DashboardUsage } from '@/components/organisms/DashboardUsage';
import { ApiExplorer } from '@/components/organisms/ApiExplorer';
import { FileBrowser } from '@/components/organisms/FileBrowser';
import { UserManagement } from '@/components/organisms/UserManagement';
import { ConfigDialog } from '@/components/organisms/ConfigDialog';
import { InvitesDialog } from '@/components/organisms/InvitesDialog';

export default function DashboardPage() {
  const { data: info, isLoading: infoLoading, error: infoError } = useAdminInfo();
  const { data: usage, isLoading: usageLoading, error: usageError } = useAdminUsage();
  const {
    disableUser,
    generateInvite,
    isGeneratingInvite,
    isDisablingUser,
    disableUserError,
    generatedInvites,
  } = useAdminActions();

  // Memoize callback to prevent UserManagement rerenders
  const handleViewUserFiles = useCallback((pubkey: string) => {
    // This will be handled by UserManagement component internally
    // by navigating to the user's /pub/ directory
  }, []);

  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isInvitesDialogOpen, setIsInvitesDialogOpen] = useState(false);

  const handleSettingsClick = useCallback(() => {
    setIsConfigDialogOpen(true);
  }, []);

  const handleUserClick = useCallback(() => {
    // TODO: Implement user account menu/dialog
    console.log('User account clicked');
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
          <DashboardNavbar
            avatarInitial="A"
            onSettingsClick={handleSettingsClick}
            onUserClick={handleUserClick}
          />

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <DashboardOverview info={info} isLoading={infoLoading} error={infoError} />
          </TabsContent>

                  <TabsContent value="usage" className="space-y-4">
                    <DashboardUsage
                      usage={usage}
                      isLoading={usageLoading}
                      error={usageError}
                      info={info}
                    />
                  </TabsContent>

                  <TabsContent value="users" className="space-y-4">
                    <UserManagement 
                      onViewUserFiles={handleViewUserFiles}
                      onDisableUser={disableUser}
                      isDisablingUser={isDisablingUser}
                      onOpenInvites={() => setIsInvitesDialogOpen(true)}
                    />
                  </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <ApiExplorer
              adminBaseUrl={process.env.NEXT_PUBLIC_ADMIN_BASE_URL || 'http://127.0.0.1:6288'}
              clientBaseUrl={process.env.NEXT_PUBLIC_ADMIN_BASE_URL?.replace(':6288', ':6286') || 'http://127.0.0.1:6286'}
              metricsBaseUrl={process.env.NEXT_PUBLIC_ADMIN_BASE_URL?.replace(':6288', ':6289') || 'http://127.0.0.1:6289'}
              adminToken={process.env.NEXT_PUBLIC_ADMIN_TOKEN}
            />
          </TabsContent>
        </Tabs>

        {/* Config Dialog */}
        <ConfigDialog
          open={isConfigDialogOpen}
          onOpenChange={setIsConfigDialogOpen}
        />

        {/* Invites Dialog */}
        <InvitesDialog
          open={isInvitesDialogOpen}
          onOpenChange={setIsInvitesDialogOpen}
          invites={generatedInvites}
          onGenerate={generateInvite}
          isGenerating={isGeneratingInvite}
        />
      </div>
    </main>
  </div>
);
}
