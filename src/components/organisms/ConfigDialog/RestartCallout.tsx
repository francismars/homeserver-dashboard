'use client';

import { RotateCw } from 'lucide-react';
import { useRestartSentence } from '@/hooks/useRestartSentence';

/**
 * Loud restart instruction. Users skim past muted helper text and then
 * wonder why their change "did nothing" - this one is deliberately bright.
 * Without children it renders the canonical restart sentence.
 */
export function RestartCallout({ children }: { children?: React.ReactNode }) {
  const restartSentence = useRestartSentence();
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2.5"
      data-testid="restart-callout"
    >
      <RotateCw className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <p className="text-sm font-medium text-amber-300">{children ?? restartSentence}</p>
    </div>
  );
}
