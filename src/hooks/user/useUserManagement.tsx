'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { UserService } from '@/services/user/user';
import { WebDavService } from '@/services/webdav';
import type { User, UserListResponse } from '@/services/user/user.types';

export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with true since we load on mount
  const [error, setError] = useState<Error | null>(null);
  const isLoadingRef = useRef(false);
  const servicesRef = useRef<{ userService: UserService } | null>(null);

  // Initialize services once
  useEffect(() => {
    if (!servicesRef.current) {
      const adminBaseUrl = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || '';
      const clientBaseUrl = adminBaseUrl ? adminBaseUrl.replace(':6288', ':6286') : '';
      const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

      console.log('[useUserManagement] Initializing services...', {
        hasAdminBaseUrl: !!adminBaseUrl,
        hasAdminToken: !!adminToken,
        adminBaseUrl,
        clientBaseUrl,
      });

      if (adminBaseUrl && adminToken) {
        const webdavService = new WebDavService({
          baseUrl: `${adminBaseUrl}/dav`,
          username: 'admin',
          password: adminToken,
        });

        servicesRef.current = {
          userService: new UserService({
            adminBaseUrl,
            clientBaseUrl,
            adminToken,
            webdavService,
          }),
        };
        console.log('[useUserManagement] Services initialized successfully');
      } else {
        console.error('[useUserManagement] Missing configuration:', {
          adminBaseUrl: adminBaseUrl || 'MISSING',
          adminToken: adminToken ? 'SET' : 'MISSING',
        });
        const errorMsg = 'WebDAV credentials not configured. Please check NEXT_PUBLIC_ADMIN_BASE_URL and NEXT_PUBLIC_ADMIN_TOKEN environment variables.';
        setError(new Error(errorMsg));
        setIsLoading(false);
      }
    }
  }, []);

  const loadUsers = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      console.log('[useUserManagement] Load already in progress, skipping...');
      return;
    }

    if (!servicesRef.current) {
      const errorMsg = 'WebDAV credentials not configured. Please check NEXT_PUBLIC_ADMIN_BASE_URL and NEXT_PUBLIC_ADMIN_TOKEN environment variables.';
      console.error('[useUserManagement]', errorMsg);
      setError(new Error(errorMsg));
      setIsLoading(false);
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    console.log('[useUserManagement] Loading users...');

    try {
      const response = await servicesRef.current.userService.listUsers();
      console.log('[useUserManagement] Users loaded successfully:', {
        count: response.users.length,
        users: response.users.map(u => u.pubkey),
      });
      setUsers(response.users);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
      console.error('[useUserManagement] Failed to load users:', err);
      setError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  // Load users after services are initialized
  useEffect(() => {
    // Wait a tick to ensure services are initialized
    const timer = setTimeout(() => {
      if (servicesRef.current) {
        loadUsers();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const refreshUsers = useCallback(() => {
    console.log('[useUserManagement] Manual refresh requested');
    loadUsers();
  }, [loadUsers]);

  return {
    users,
    isLoading,
    error,
    refreshUsers,
  };
}
