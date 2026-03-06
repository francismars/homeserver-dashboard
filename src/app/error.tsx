'use client';

import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The dashboard hit an unexpected error. Try again, and if this keeps happening check server logs with
          request details.
        </p>
        {error.digest ? (
          <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">Error ID: {error.digest}</p>
        ) : null}
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
