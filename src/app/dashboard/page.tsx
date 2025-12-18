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
import { UserProfileDialog } from '@/components/organisms/UserProfileDialog';
import { ExternalLink, Github, BookOpen, HelpCircle } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: info, isLoading: infoLoading, error: infoError } = useAdminInfo();
  const {
    disableUser,
    enableUser,
    generateInvite,
    isGeneratingInvite,
    isDisablingUser,
    generatedInvites,
  } = useAdminActions();

  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isInvitesDialogOpen, setIsInvitesDialogOpen] = useState(false);
  const [isUserProfileDialogOpen, setIsUserProfileDialogOpen] = useState(false);
  const [serverControlAction, setServerControlAction] = useState<'restart' | 'shutdown' | null>(null);

  const handleSettingsClick = useCallback(() => {
    setIsConfigDialogOpen(true);
  }, []);

  const handleUserClick = useCallback(() => {
    setIsUserProfileDialogOpen(true);
  }, []);

  const handleRestartServer = useCallback(() => {
    setServerControlAction('restart');
  }, []);

  const handleShutdownServer = useCallback(() => {
    setServerControlAction('shutdown');
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
          <DashboardNavbar
            avatarInitial="A"
            onSettingsClick={handleSettingsClick}
            onUserClick={handleUserClick}
            onRestartServer={handleRestartServer}
            onShutdownServer={handleShutdownServer}
          />

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
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
                      numDisabledUsers={info?.num_disabled_users}
                    />
                  </TabsContent>

                  <TabsContent value="files" className="space-y-4">
                    <FileBrowser initialPath="/" />
                  </TabsContent>

                  <TabsContent value="logs" className="space-y-4">
                    <DashboardLogs isLoading={infoLoading} error={infoError} />
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

        {/* Server Control Dialog */}
        <ServerControlDialog
          open={!!serverControlAction}
          onOpenChange={(open) => !open && setServerControlAction(null)}
          action={serverControlAction}
        />

        {/* User Profile Dialog */}
        <UserProfileDialog
          open={isUserProfileDialogOpen}
          onOpenChange={setIsUserProfileDialogOpen}
          homeserverPubkey={info?.pubkey}
        />
      </div>
      
      {/* Footer */}
      <footer className="mt-6 pt-4 pb-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 text-sm text-muted-foreground">
          {/* Copyright and version */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <span>Homeserver Dashboard</span>
              <span className="text-xs">
                {info?.version ? `v${info.version}` : 'v0.1.0-dev'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span>Powered by Pubky</span>
              <span>© {new Date().getFullYear()} Synonym Software Ltd.</span>
            </div>
          </div>
          
          {/* Links */}
          <div className="flex flex-wrap items-center justify-end gap-6 text-xs">
            <Link
              href="https://github.com/synonymdev/pubky"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              <span>GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="https://docs.pubky.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Documentation</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="https://github.com/synonymdev/pubky/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
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
