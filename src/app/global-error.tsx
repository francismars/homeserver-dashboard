'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h1 className="text-xl font-semibold">Dashboard failed to render</h1>
            <p className="text-sm text-muted-foreground">
              A critical rendering error occurred. Retry now, or reload the page if the issue persists.
            </p>
            {error.digest ? (
              <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                Error ID: {error.digest}
              </p>
            ) : null}
            <Button onClick={reset}>Retry render</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
