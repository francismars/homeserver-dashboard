'use client';

import { useState, useCallback } from 'react';
import { UserService } from '@/services/user/user';
import { WebDavService } from '@/services/webdav';
import type { CreateUserRequest, CreateUserResponse } from '@/services/user/user.types';

export function useCreateUser() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [createdUser, setCreatedUser] = useState<CreateUserResponse | null>(null);

  const getServices = useCallback(() => {
    const adminBaseUrl = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || '';
    const clientBaseUrl = adminBaseUrl ? adminBaseUrl.replace(':6288', ':6286') : '';
    const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

    if (!adminBaseUrl || !adminToken) {
      return null;
    }

    const webdavService = new WebDavService({
      baseUrl: `${adminBaseUrl}/dav`,
      username: 'admin',
      password: adminToken,
    });

    return {
      userService: new UserService({
        adminBaseUrl,
        clientBaseUrl,
        adminToken,
        webdavService,
      }),
    };
  }, []);

  const createUser = useCallback(async (
    request: CreateUserRequest,
    recoveryPassphrase?: string
  ): Promise<CreateUserResponse> => {
    setIsCreating(true);
    setError(null);
    setCreatedUser(null);

    try {
      const services = getServices();
      if (!services) {
        throw new Error('WebDAV credentials not configured');
      }

      const result = await services.userService.createUser(request, recoveryPassphrase);
      setCreatedUser(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create user');
      setError(error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, [getServices]);

  const reset = useCallback(() => {
    setCreatedUser(null);
    setError(null);
  }, []);

  return {
    createUser,
    isCreating,
    error,
    createdUser,
    reset,
  };
}

