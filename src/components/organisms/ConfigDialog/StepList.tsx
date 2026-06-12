'use client';

import { AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Step rows of a multi-step setup run (done/failed per step). Shared by the
 * Connect and API-token flows; each passes its own step keys, labels and
 * testid, so the rendered markup stays identical to what each flow had
 * before the extraction.
 */
export function StepList<K extends string>({
  steps,
  labels,
  testId,
}: {
  steps: ReadonlyArray<{ key: K; status: 'done' | 'failed'; detail?: string }>;
  labels: Record<K, string>;
  testId: string;
}) {
  return (
    <ul className="space-y-1" data-testid={testId}>
      {steps.map((s) => (
        <li key={s.key} className="flex items-center gap-2 text-xs">
          {s.status === 'done' ? (
            <Check className="h-3.5 w-3.5 text-brand" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className={cn(s.status === 'done' ? 'text-muted-foreground' : 'text-destructive')}>
            {labels[s.key]}
            {s.detail ? ` - ${s.detail}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}
