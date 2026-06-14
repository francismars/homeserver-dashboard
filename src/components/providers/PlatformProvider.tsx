'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Platform } from '@/lib/server/platform';

// Default 'umbrel' so any component rendered outside a provider keeps today's
// behavior (the real value is injected by the server root layout).
const PlatformContext = createContext<Platform>('umbrel');

export function PlatformProvider({ platform, children }: { platform: Platform; children: ReactNode }) {
  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): Platform {
  return useContext(PlatformContext);
}
