import type { LucideIcon } from 'lucide-react';

export type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon?: LucideIcon;
  intent?: 'default' | 'warning' | 'error' | 'success';
};

