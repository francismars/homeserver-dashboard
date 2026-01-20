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
import { InvitesDialog } from '@/components/organisms/InvitesDialog';
import { ServerControlDialog } from '@/components/organisms/ServerControlDialog';
import { ExternalLink, Github, BookOpen, HelpCircle } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: info, isLoading: infoLoading, error: infoError, refetch: refetchInfo } = useAdminInfo();
  const { disableUser, enableUser, generateInvite, isGeneratingInvite, isDisablingUser, generatedInvites } =
    useAdminActions();

  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isInvitesDialogOpen, setIsInvitesDialogOpen] = useState(false);
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
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10">
          <DashboardNavbar
            onSettingsClick={handleSettingsClick}
            onRestartServer={handleRestartServer}
            onShutdownServer={handleShutdownServer}
          />

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="flex w-full flex-nowrap gap-1 overflow-x-auto md:grid md:grid-cols-5 md:gap-0">
              <TabsTrigger value="overview" className="shrink-0 text-xs whitespace-nowrap sm:text-sm md:shrink">
                Overview
              </TabsTrigger>
              <TabsTrigger value="users" className="shrink-0 text-xs whitespace-nowrap sm:text-sm md:shrink">
                Users
              </TabsTrigger>
              <TabsTrigger value="files" className="shrink-0 text-xs whitespace-nowrap sm:text-sm md:shrink">
                Files
              </TabsTrigger>
              <TabsTrigger value="logs" className="shrink-0 text-xs whitespace-nowrap sm:text-sm md:shrink">
                Logs
              </TabsTrigger>
              <TabsTrigger value="api" className="shrink-0 text-xs whitespace-nowrap sm:text-sm md:shrink">
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
                onOpenInvites={() => setIsInvitesDialogOpen(true)}
                numUsersTotal={info?.num_users}
                numDisabledUsers={info?.num_disabled_users}
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

          {/* Invites Dialog */}
          <InvitesDialog
            open={isInvitesDialogOpen}
            onOpenChange={setIsInvitesDialogOpen}
            invites={generatedInvites}
            onGenerate={handleGenerateInvite}
            isGenerating={isGeneratingInvite}
            signupCodesTotal={info?.num_signup_codes}
            signupCodesUnused={info?.num_unused_signup_codes}
            isStatsLoading={infoLoading}
            homeserverPubkey={info?.public_key ?? info?.pubkey}
          />

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
                <span>Powered by Pubky</span>
                <span>© {new Date().getFullYear()} Synonym Software Ltd.</span>
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:justify-end sm:gap-6">
              <Link
                href="https://github.com/synonymdev/pubky"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Github className="h-3.5 w-3.5" />
                <span>GitHub</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://docs.pubky.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Documentation</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/synonymdev/pubky/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Support</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
