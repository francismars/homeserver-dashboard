'use client';

import { useState } from 'react';
import { Settings, Info, Power, RotateCw } from 'lucide-react';
import { Logo } from '@/components/molecules/Logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  avatarImage?: string;
  avatarInitial?: string;
  onSettingsClick?: () => void;
  onUserClick?: () => void;
  onRestartServer?: () => void;
  onShutdownServer?: () => void;
}

export function DashboardNavbar({
  className,
  avatarImage,
  avatarInitial = 'A',
  onSettingsClick,
  onUserClick,
  onRestartServer,
  onShutdownServer,
}: DashboardNavbarProps) {
  return (
    <header
      className={cn(
        'w-full bg-linear-to-b from-background/95 to-transparent py-6 backdrop-blur-sm',
        className
      )}
    >
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
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSettingsClick} className="flex items-center justify-between">
                  <span>Configuration</span>
                  <Badge variant="outline" className="text-xs font-normal border-dashed ml-2">
                    <Info className="h-3 w-3 mr-1" />
                    Mock
                  </Badge>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Preferences
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Appearance
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {onRestartServer && (
                  <DropdownMenuItem onClick={onRestartServer} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RotateCw className="h-4 w-4" />
                      <span>Restart Homeserver</span>
                    </div>
                    <Badge variant="outline" className="text-xs font-normal border-dashed ml-2">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </DropdownMenuItem>
                )}
                {onShutdownServer && (
                  <DropdownMenuItem 
                    onClick={onShutdownServer} 
                    className="flex items-center justify-between text-destructive focus:text-destructive"
                  >
                    <div className="flex items-center gap-2">
                      <Power className="h-4 w-4" />
                      <span>Shutdown Homeserver</span>
                    </div>
                    <Badge variant="outline" className="text-xs font-normal border-dashed ml-2">
                      <Info className="h-3 w-3 mr-1" />
                      Mock
                    </Badge>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  About
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User avatar button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 p-0"
              onClick={onUserClick}
              aria-label="User account"
            >
              <Avatar className="h-12 w-12 cursor-pointer">
                <AvatarImage src={avatarImage} alt="User" />
                <AvatarFallback>{avatarInitial}</AvatarFallback>
              </Avatar>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}

