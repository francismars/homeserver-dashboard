import type { AdminConfigResponse } from '@/services/admin';

export type DashboardConfigProps = {
  config: AdminConfigResponse | null;
  checksum?: string;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  isDirty: boolean;
  onSave: (configToml: string, checksum?: string) => Promise<void>;
  onReset?: () => void;
};

