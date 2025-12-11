'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserService } from '@/services/user/user';
import { WebDavService } from '@/services/webdav';
import type { User, UserListResponse } from '@/services/user/user.types';

export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const services = getServices();
      if (!services) {
        setError(new Error('WebDAV credentials not configured'));
        return;
      }

      const response = await services.userService.listUsers();
      setUsers(response.users);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load users'));
    } finally {
      setIsLoading(false);
    }
  }, [getServices]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const refreshUsers = useCallback(() => {
    loadUsers();
  }, [loadUsers]);

  return {
    users,
    isLoading,
    error,
    refreshUsers,
  };
}

