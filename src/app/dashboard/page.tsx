'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminInfo, useAdminActions } from '@/hooks/admin';
import { DashboardNavbar } from '@/components/organisms/DashboardNavbar';
import { DashboardOverview } from '@/components/organisms/DashboardOverview';
import { DashboardLogs } from '@/components/organisms/DashboardLogs';
import { ApiExplorer } from '@/components/organisms/ApiExplorer';
import { FileBrowser } from '@/components/organisms/FileBrowser';
import { DisabledUsersManagement } from '@/components/organisms/DisabledUsersManagement';
import { ConfigDialog } from '@/components/organisms/ConfigDialog';
import { InviteManagement } from '@/components/organisms/InviteManagement';
import { ServerControlDialog } from '@/components/organisms/ServerControlDialog';
import { ExternalLink, Github, BookOpen, HelpCircle, Home, Users, Files, Activity, Plug, Gift } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: info, isLoading: infoLoading, error: infoError, refetch: refetchInfo } = useAdminInfo();
  const { disableUser, enableUser, generateInvite, isGeneratingInvite, isDisablingUser, generatedInvites } =
    useAdminActions();

  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [serverControlAction, setServerControlAction] = useState<'restart' | 'shutdown' | null>(null);

  const handleSettingsClick = useCallback(() => {
    setIsConfigDialogOpen(true);
  }, []);

  const handleRestartServer = useCallback(() => {
    setServerControlAction('restart');
  }, []);

  const handleShutdownServer = useCallback(() => {
    setServerControlAction('shutdown');
  }, []);

  const handleGenerateInvite = useCallback(async () => {
    await generateInvite();
    await refetchInfo();
  }, [generateInvite, refetchInfo]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 sm:gap-3 sm:px-6 sm:py-10">
          <DashboardNavbar onSettingsClick={handleSettingsClick} />

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="flex w-full flex-nowrap overflow-x-auto scrollbar-none md:grid md:grid-cols-6">
              <TabsTrigger value="overview" className="shrink-0 gap-2 text-xs sm:text-sm [&_svg]:size-4">
                <Home className="shrink-0" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="users" className="shrink-0 gap-2 text-xs sm:text-sm [&_svg]:size-4">
                <Users className="shrink-0" />
                Users
              </TabsTrigger>
              <TabsTrigger value="invites" className="shrink-0 gap-2 text-xs sm:text-sm [&_svg]:size-4">
                <Gift className="shrink-0" />
                Invites
              </TabsTrigger>
              <TabsTrigger value="files" className="shrink-0 gap-2 text-xs sm:text-sm [&_svg]:size-4">
                <Files className="shrink-0" />
                Files
              </TabsTrigger>
              <TabsTrigger value="logs" className="shrink-0 gap-2 text-xs sm:text-sm [&_svg]:size-4">
                <Activity className="shrink-0" />
                Logs
              </TabsTrigger>
              <TabsTrigger value="api" className="shrink-0 gap-2 text-xs sm:text-sm [&_svg]:size-4">
                <Plug className="shrink-0" />
                API
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <DashboardOverview info={info} isLoading={infoLoading} error={infoError} />
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <DisabledUsersManagement
                onDisableUser={disableUser}
                onEnableUser={enableUser}
                isDisablingUser={isDisablingUser}
                numUsersTotal={info?.num_users}
                numDisabledUsers={info?.num_disabled_users}
              />
            </TabsContent>

            <TabsContent value="invites" className="space-y-4">
              <InviteManagement
                invites={generatedInvites}
                onGenerate={handleGenerateInvite}
                isGenerating={isGeneratingInvite}
                signupCodesTotal={info?.num_signup_codes}
                signupCodesUnused={info?.num_unused_signup_codes}
                isStatsLoading={infoLoading}
                homeserverPubkey={info?.public_key ?? info?.pubkey}
              />
            </TabsContent>

            <TabsContent value="files" className="space-y-4">
              <FileBrowser initialPath="/" diskUsedMB={info?.total_disk_used_mb} />
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <DashboardLogs isLoading={infoLoading} error={infoError} />
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <ApiExplorer
                adminBaseUrl="/api/admin"
                clientBaseUrl="http://homeserver:6286"
                metricsBaseUrl="http://homeserver:6289"
                adminToken=""
              />
            </TabsContent>
          </Tabs>

          {/* Config Dialog */}
          <ConfigDialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen} />

          {/* Server Control Dialog */}
          <ServerControlDialog
            open={!!serverControlAction}
            onOpenChange={(open) => !open && setServerControlAction(null)}
            action={serverControlAction}
          />
        </div>

        {/* Footer */}
        <footer className="mt-6 pt-4 pb-6 sm:pb-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 text-sm text-muted-foreground sm:px-6">
            {/* Copyright and version */}
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row sm:gap-4">
              <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left">
                <span className="text-xs sm:text-sm">Homeserver Dashboard</span>
                <span className="text-xs">{info?.version ? `v${info.version}` : 'v0.1.0-dev'}</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-center text-xs sm:flex-row sm:gap-4 sm:text-left">
                <span>
                  Synonym Software, S.A. DE C.V. ©{new Date().getFullYear()}. All rights reserved.
                </span>
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:justify-end sm:gap-6">
              <Link
                href="https://github.com/pubky/pubky-core/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Github className="h-3.5 w-3.5" />
                <span>GitHub</span>
              </Link>
              <Link
                href="https://docs.pubky.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Documentation</span>
              </Link>
              <Link
                href="https://docs.pubky.org/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Support</span>
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
