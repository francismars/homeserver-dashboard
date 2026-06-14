'use client';

import { AlertCircle, ExternalLink } from 'lucide-react';

export type SetupErrorLink = { href: string; label: string };

/**
 * The error row shared by every Cloudflare setup card (Connect, API-token,
 * Preview). An optional `link` renders a deep link to the exact Cloudflare
 * dashboard page where the operator can fix the cause (a clashing DNS record,
 * a leftover tunnel), indented under the message.
 */
export function SetupError({
  message,
  link,
  testId,
}: {
  message: string;
  link?: SetupErrorLink | null;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm text-destructive" data-testid={testId}>
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{message}</span>
      </div>
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-[1.375rem] inline-flex items-center gap-1 self-start text-brand underline-offset-2 hover:underline"
          data-testid={`${testId}-link`}
        >
          {link.label} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
