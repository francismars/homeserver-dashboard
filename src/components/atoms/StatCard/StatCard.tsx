import type { StatCardProps } from './StatCard.types';
import { cn } from '@/libs/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function StatCard({ label, value, helper, icon: Icon, intent = 'default' }: StatCardProps) {
  const intentColors = {
    default: 'text-foreground',
    warning: 'text-yellow-500',
    error: 'text-destructive',
    success: 'text-green-500',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn('h-4 w-4', intentColors[intent])} />}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
      </CardContent>
    </Card>
  );
}

