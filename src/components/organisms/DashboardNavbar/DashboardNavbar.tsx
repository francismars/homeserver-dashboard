'use client';

import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/libs/utils';

interface DashboardNavbarProps {
  className?: string;
  onSettingsClick?: () => void;
}

export function DashboardNavbar({ className, onSettingsClick }: DashboardNavbarProps) {
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
        <div className="flex min-w-0 flex-1 items-center justify-end gap-8 sm:gap-10">
          <p className="hidden truncate text-sm text-muted-foreground md:max-w-xs lg:inline lg:max-w-sm">
            Manage your homeserver settings and monitor usage
          </p>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full border border-[#303034] bg-[#FFFFFF0B] p-2.5 backdrop-blur-xl text-foreground hover:bg-white/[0.08]"
            aria-label="Homeserver Configuration"
            onClick={onSettingsClick}
          >
            <Settings className="size-6" />
          </Button>
        </div>
      </nav>
    </header>
  );
}
