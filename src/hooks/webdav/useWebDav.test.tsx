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

    let outcome: Awaited<ReturnType<typeof result.current.listDirectory>> | null = null;
    await act(async () => {
      outcome = await result.current.listDirectory('/');
    });

    expect(outcome).toEqual({ directory: { path: '/', files: [] } });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it('stores error state on failed listDirectory', async () => {
    vi.spyOn(WebDavService.prototype, 'listDirectory').mockRejectedValue(new Error('WebDAV failed'));

    const { result } = renderHook(() => useWebDav());

    let outcome: Awaited<ReturnType<typeof result.current.listDirectory>> | null = null;
    await act(async () => {
      outcome = await result.current.listDirectory('/');
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toContain('WebDAV failed');
    // The error is also returned inline so callers can distinguish a listing
    // failure from a later action failure without consulting the shared state.
    expect(outcome).toMatchObject({ error: { message: expect.stringContaining('WebDAV failed') } });
  });
});
