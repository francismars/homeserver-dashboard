'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Logo } from '@/components/molecules/Logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
}

export function DashboardNavbar({
  className,
  avatarImage,
  avatarInitial = 'A',
  onSettingsClick,
  onUserClick,
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
                <DropdownMenuItem onClick={onSettingsClick}>
                  Configuration
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Preferences
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Appearance
                </DropdownMenuItem>
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

