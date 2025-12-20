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
    <header
      className={cn('w-full bg-linear-to-b from-background/95 to-transparent py-4 backdrop-blur-sm sm:py-6', className)}
    >
      <nav className="flex w-full min-w-0 items-center justify-between gap-1.5 sm:gap-2 md:gap-3">
        {/* Logo and title grouped together - single line, never wrap */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-1.5">
          <div className="shrink-0">
            <Logo noLink width={32} height={32} className="sm:h-10 sm:w-10" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <h1 className="truncate text-sm font-semibold whitespace-nowrap sm:text-base md:text-lg lg:text-xl xl:text-2xl">
              Pubky Homeserver Dashboard
            </h1>
            <p className="truncate text-xs whitespace-nowrap text-muted-foreground">
              Manage your homeserver settings and monitor usage
            </p>
          </div>
        </div>

        {/* Settings button on the right - always visible, never shrink */}
        <div className="flex shrink-0 items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full border bg-transparent sm:h-10 sm:w-10 md:h-12 md:w-12"
                aria-label="Settings"
              >
                <Settings className="size-4 sm:size-5 md:size-6" />
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
    </header>
  );
}
