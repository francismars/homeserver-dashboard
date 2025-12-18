import { useCallback, useState } from 'react';
import { AdminService } from '@/services/admin/admin';

const getService = () => {
  const baseUrl = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || '';
  const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
  return new AdminService({ baseUrl, token });
};

export function useAdminActions() {
  const [isDeletingUrl, setIsDeletingUrl] = useState(false);
  const [isDisablingUser, setIsDisablingUser] = useState(false);
  const [isEnablingUser, setIsEnablingUser] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [deleteUrlError, setDeleteUrlError] = useState<Error | null>(null);
  const [disableUserError, setDisableUserError] = useState<Error | null>(null);
  const [enableUserError, setEnableUserError] = useState<Error | null>(null);
  const [generateInviteError, setGenerateInviteError] = useState<Error | null>(null);
  const [generatedInvites, setGeneratedInvites] = useState<string[]>([]);

  const deleteUrl = useCallback(async (path: string) => {
    const service = getService();
    setIsDeletingUrl(true);
    setDeleteUrlError(null);

    try {
      await service.deleteUrl({ path });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete URL');
      setDeleteUrlError(error);
      throw error;
    } finally {
      setIsDeletingUrl(false);
    }
  }, []);

  const disableUser = useCallback(async (pubkey: string) => {
    const service = getService();
    setIsDisablingUser(true);
    setDisableUserError(null);

    try {
      await service.disableUser({ pubkey });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to disable user');
      setDisableUserError(error);
      throw error;
    } finally {
      setIsDisablingUser(false);
    }
  }, []);

  const enableUser = useCallback(async (pubkey: string) => {
    const service = getService();
    setIsEnablingUser(true);
    setEnableUserError(null);

    try {
      await service.enableUser({ pubkey });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to enable user');
      setEnableUserError(error);
      throw error;
    } finally {
      setIsEnablingUser(false);
    }
  }, []);

  const generateInvite = useCallback(async () => {
    const service = getService();
    setIsGeneratingInvite(true);
    setGenerateInviteError(null);

    try {
      const result = await service.generateInvite();
      setGeneratedInvites((prev) => [result.token, ...prev].slice(0, 10)); // Keep last 10
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate invite');
      setGenerateInviteError(error);
      throw error;
    } finally {
      setIsGeneratingInvite(false);
    }
  }, []);

  return {
    deleteUrl,
    disableUser,
    enableUser,
    generateInvite,
    isDeletingUrl,
    isDisablingUser,
    isEnablingUser,
    isGeneratingInvite,
    deleteUrlError,
    disableUserError,
    enableUserError,
    generateInviteError,
    generatedInvites,
  };
}
