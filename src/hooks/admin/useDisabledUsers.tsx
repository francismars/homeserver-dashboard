import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminService } from '@/services/admin/admin';
import type { DisabledUser } from '@/services/admin/admin.types';

const getService = () => new AdminService({ baseUrl: '', token: '' });
const PAGE_SIZE = 20;

export function useDisabledUsers() {
  const [items, setItems] = useState<DisabledUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const service = getService();
    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await service.getDisabledUsers(PAGE_SIZE);
      if (!isMountedRef.current || fetchId !== fetchIdRef.current) return;
      setItems(response.items);
      setNextCursor(response.next_cursor);
    } catch (err) {
      if (!isMountedRef.current || fetchId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to load disabled users'));
    } finally {
      if (!isMountedRef.current || fetchId !== fetchIdRef.current) return;
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    const service = getService();
    setIsLoadingMore(true);
    setError(null);
    try {
      const response = await service.getDisabledUsers(PAGE_SIZE, nextCursor);
      if (!isMountedRef.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((u) => u.pubkey));
        const merged = [...prev];
        for (const user of response.items) {
          if (!seen.has(user.pubkey)) merged.push(user);
        }
        return merged;
      });
      setNextCursor(response.next_cursor);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to load more disabled users'));
    } finally {
      if (!isMountedRef.current) return;
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextCursor]);

  const removeDisabledUserLocally = useCallback((pubkey: string) => {
    setItems((prev) => prev.filter((user) => user.pubkey !== pubkey));
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadFirstPage();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadFirstPage]);

  return {
    items,
    nextCursor,
    isLoading,
    isLoadingMore,
    error,
    refetch: loadFirstPage,
    loadMore,
    removeDisabledUserLocally,
  };
}
