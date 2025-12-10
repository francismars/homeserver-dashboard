import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Homeserver Dashboard',
  description: 'Admin dashboard for Pubky homeserver',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

