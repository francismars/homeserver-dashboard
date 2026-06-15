import { cn } from '@/lib/utils';

/** The small inline spinner shown inside a button while its action runs.
 * Pass `className="mr-2"` when it sits before button text. */
export function ButtonSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} />
  );
}
