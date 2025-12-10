'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminInfo, useAdminUsage, useConfigEditor, useAdminActions } from '@/hooks/admin';
import { DashboardOverview } from '@/components/organisms/DashboardOverview';
import { DashboardUsage } from '@/components/organisms/DashboardUsage';
import { DashboardConfig } from '@/components/organisms/DashboardConfig';
import { DashboardActions } from '@/components/organisms/DashboardActions';
import { InviteList } from '@/components/molecules/InviteList';

export default function DashboardPage() {
  const { data: info, isLoading: infoLoading, error: infoError } = useAdminInfo();
  const { data: usage, isLoading: usageLoading, error: usageError } = useAdminUsage();
  const {
    config,
    checksum,
    isLoading: configLoading,
    isSaving: configSaving,
    error: configError,
    isDirty: configDirty,
    saveConfig,
  } = useConfigEditor();
  const {
    deleteUrl,
    disableUser,
    generateInvite,
    isGeneratingInvite,
    isDeletingUrl,
    isDisablingUser,
    deleteUrlError,
    disableUserError,
    generatedInvites,
  } = useAdminActions();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Homeserver</p>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your homeserver settings and monitor usage</p>
        </header>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="invites">Invites</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <DashboardOverview info={info} isLoading={infoLoading} error={infoError} />
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            <DashboardUsage
              usage={usage}
              isLoading={usageLoading}
              error={usageError}
              totalDiskMB={info ? info.total_disk_used_mb * 2 : undefined}
            />
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <DashboardConfig
              config={config}
              checksum={checksum}
              isLoading={configLoading}
              isSaving={configSaving}
              error={configError}
              isDirty={configDirty}
              onSave={saveConfig}
            />
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <DashboardActions
              onDeleteUrl={deleteUrl}
              onDisableUser={disableUser}
              isDeletingUrl={isDeletingUrl}
              isDisablingUser={isDisablingUser}
              deleteUrlError={deleteUrlError}
              disableUserError={disableUserError}
            />
          </TabsContent>

          <TabsContent value="invites" className="space-y-4">
            <InviteList invites={generatedInvites} onGenerate={generateInvite} isGenerating={isGeneratingInvite} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
