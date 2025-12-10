import { cn } from '@/libs/utils';
import type { ProgressBarProps } from './ProgressBar.types';

export function ProgressBar({ value, max = 100, className, showLabel = true }: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const isHigh = percentage >= 80;
  const isMedium = percentage >= 50 && percentage < 80;

  return (
    <div className={cn('w-full space-y-2', className)}>
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Used</span>
          <span className="font-medium">
            {value.toLocaleString()} / {max.toLocaleString()} ({percentage.toFixed(1)}%)
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all duration-300 ease-in-out',
            isHigh ? 'bg-destructive' : isMedium ? 'bg-yellow-500' : 'bg-primary',
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={`${percentage.toFixed(1)}% used`}
        />
      </div>
    </div>
  );
}

