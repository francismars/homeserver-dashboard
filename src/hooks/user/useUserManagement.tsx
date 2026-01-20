'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { UserService } from '@/services/user/user';
import { WebDavService } from '@/services/webdav';
import type { User } from '@/services/user/user.types';

export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with true since we load on mount
  const [error, setError] = useState<Error | null>(null);
  const isLoadingRef = useRef(false);
  const servicesRef = useRef<{ userService: UserService } | null>(null);

  // Initialize services once
  useEffect(() => {
    if (!servicesRef.current) {
      // WebDAV service now uses API routes, so credentials are handled server-side
      // We still need to provide a baseUrl for path construction, but it's not used for actual requests
      const webdavService = new WebDavService({
        baseUrl: '/api/webdav/dav', // API route handles /dav prefix
        username: 'admin', // Not used anymore, but kept for compatibility
        password: '', // Not used anymore, but kept for compatibility
      });

      servicesRef.current = {
        userService: new UserService({
          webdavService,
        }),
      };
      console.log('[useUserManagement] Services initialized successfully');
    }
  }, []);

  const loadUsers = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      console.log('[useUserManagement] Load already in progress, skipping...');
      return;
    }

    if (!servicesRef.current) {
      const errorMsg =
        'WebDAV service not initialized. Please check ADMIN_BASE_URL and ADMIN_TOKEN environment variables on the server.';
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
        users: response.users.map((u) => u.pubkey),
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
