export type ActionPanelProps = {
  title: string;
  description: string;
  actionLabel: string;
  confirmLabel?: string;
  confirmMessage?: string;
  placeholder: string;
  inputType?: 'text' | 'url';
  isLoading?: boolean;
  error?: Error | null;
  onAction: (value: string) => Promise<void>;
  className?: string;
  destructive?: boolean;
};

