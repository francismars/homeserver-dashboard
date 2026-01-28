'use client';

import { Settings, Power, RotateCw } from 'lucide-react';
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
      className={cn('w-full bg-background pb-2 pt-4 sm:pb-3 sm:pt-5', className)}
    >
      <nav className="flex w-full min-w-0 items-center justify-between gap-4 sm:gap-6">
        {/* Left: Pubky Homeserver logo */}
        <div className="flex min-w-0 shrink-0 items-center">
          <img
            src="/PubkyHomeserver.svg"
            alt="Pubky Homeserver"
            className="h-8 w-auto sm:h-9"
            width={262}
            height={36}
          />
        </div>

        {/* Right: tagline + settings button */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-4 sm:gap-6">
          <p className="hidden truncate text-sm text-muted-foreground md:max-w-xs lg:inline lg:max-w-sm">
            Manage your homeserver settings and monitor usage
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full border border-border bg-secondary/80 text-foreground hover:bg-secondary sm:h-10 sm:w-10"
                aria-label="Settings"
              >
                <Settings className="size-4 sm:size-5" />
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
