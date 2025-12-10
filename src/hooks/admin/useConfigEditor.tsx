import { useCallback, useEffect, useState } from 'react';
import { AdminService } from '@/services/admin/admin';
import type { AdminConfigResponse } from '@/services/admin/admin.types';

const getService = () => {
  const baseUrl = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || '';
  const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
  // Default to mock mode if no baseUrl is provided
  const mock = process.env.NEXT_PUBLIC_ADMIN_MOCK === '1' || !baseUrl;
  return new AdminService({ baseUrl, token, mock });
};

export function useConfigEditor() {
  const [config, setConfig] = useState<AdminConfigResponse | null>(null);
  const [checksum, setChecksum] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [localConfig, setLocalConfig] = useState<string>('');

  useEffect(() => {
    const service = getService();
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    service
      .getConfig()
      .then((result) => {
        if (!cancelled) {
          setConfig(result);
          setChecksum(result.checksum);
          setLocalConfig(result.configToml);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load config'));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveConfig = useCallback(async (configToml: string, currentChecksum?: string) => {
    if (!config) return;

    const service = getService();
    setIsSaving(true);
    setError(null);

    try {
      const result = await service.saveConfig({ configToml, checksum: currentChecksum || checksum });
      setConfig(result);
      setChecksum(result.checksum);
      setLocalConfig(result.configToml);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save config'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [config, checksum]);

  const handleConfigChange = useCallback((value: string) => {
    setLocalConfig(value);
    setIsDirty(value !== config?.configToml);
  }, [config]);

  return {
    config: { ...config, configToml: localConfig } as AdminConfigResponse | null,
    checksum,
    isLoading,
    isSaving,
    isDirty,
    error,
    saveConfig,
    handleConfigChange,
  };
}
