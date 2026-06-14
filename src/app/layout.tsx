import type { ReactNode } from 'react';
import './globals.css';
import { getPlatform } from '@/lib/server/platform';
import { PlatformProvider } from '@/components/providers/PlatformProvider';

// PLATFORM is a runtime env var (Docker images are built once with it unset,
// then run on Umbrel with PLATFORM=umbrel). Without this, Next prerenders the
// layout at build time and freezes getPlatform()'s value ('standalone') into
// the static RSC payload, so an Umbrel deployment would hydrate as standalone
// and hide the Cloudflare UI. Force per-request rendering so the live env wins.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Homeserver Dashboard',
  description: 'Admin dashboard for Pubky homeserver',
  icons: {
    icon: '/pubky-favicon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PlatformProvider platform={getPlatform()}>{children}</PlatformProvider>
      </body>
    </html>
  );
}
