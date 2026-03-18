import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebDavService } from '@/services/webdav';
import { useWebDav } from './useWebDav';

describe('useWebDav', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns directory listing on success', async () => {
    vi.spyOn(WebDavService.prototype, 'listDirectory').mockResolvedValue({
      path: '/',
      files: [],
    });

    const { result } = renderHook(() => useWebDav());

    let directory = null;
    await act(async () => {
      directory = await result.current.listDirectory('/');
    });

    expect(directory).toEqual({ path: '/', files: [] });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it('stores error state on failed listDirectory', async () => {
    vi.spyOn(WebDavService.prototype, 'listDirectory').mockRejectedValue(new Error('WebDAV failed'));

    const { result } = renderHook(() => useWebDav());

    await act(async () => {
      await result.current.listDirectory('/');
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toContain('WebDAV failed');
  });
});
