'use client';

import { Settings, Power, RotateCw } from 'lucide-react';
import { Logo } from '@/components/molecules/Logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/libs/utils';

interface DashboardNavbarProps {
  className?: string;
  onSettingsClick?: () => void;
  onRestartServer?: () => void;
  onShutdownServer?: () => void;
}

export function DashboardNavbar({
  className,
  onSettingsClick,
  onRestartServer,
  onShutdownServer,
}: DashboardNavbarProps) {
  return (
    <header className={cn('w-full bg-linear-to-b from-background/95 to-transparent py-6 backdrop-blur-sm', className)}>
      <div className="flex w-full flex-row flex-wrap items-center justify-between gap-4 sm:gap-6">
        <nav className="flex w-full flex-row flex-wrap items-center gap-4 sm:flex-nowrap sm:items-center sm:gap-6">
          {/* Logo and title grouped together */}
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-row items-center gap-4">
              <Logo noLink />
              <h1 className="text-2xl font-semibold">Homeserver Dashboard</h1>
            </div>
            <p className="text-sm text-muted-foreground">Manage your homeserver settings and monitor usage</p>
          </div>

          {/* Settings and User buttons on the right */}
          <div className="flex flex-row items-center justify-end gap-3">
            {/* Settings dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-12 w-12 rounded-full border bg-transparent"
                  aria-label="Settings"
                >
                  <Settings className="size-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-38">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSettingsClick}>
                  <span>Configuration</span>
                </DropdownMenuItem>
                {(onRestartServer || onShutdownServer) && (
                  <div className="flex items-center gap-0 p-1">
                    {onRestartServer && (
                      <DropdownMenuItem asChild className="flex-1 p-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestartServer();
                          }}
                          aria-label="Restart Homeserver"
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      </DropdownMenuItem>
                    )}
                    {onShutdownServer && (
                      <DropdownMenuItem asChild className="flex-1 p-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            onShutdownServer();
                          }}
                          aria-label="Shutdown Homeserver"
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </DropdownMenuItem>
                    )}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </div>
    </header>
  );
}
