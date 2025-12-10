'use client';

import { ConfigEditor } from '@/components/molecules/ConfigEditor';
import type { DashboardConfigProps } from './DashboardConfig.types';

export function DashboardConfig({
  config,
  checksum,
  isLoading,
  isSaving,
  error,
  isDirty,
  onSave,
  onReset,
}: DashboardConfigProps) {
  return (
    <ConfigEditor
      configToml={config?.configToml || null}
      checksum={checksum}
      isLoading={isLoading}
      isSaving={isSaving}
      error={error}
      onSave={onSave}
      onReset={onReset}
    />
  );
}

