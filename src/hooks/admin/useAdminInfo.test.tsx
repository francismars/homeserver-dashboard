import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAdminInfo } from './useAdminInfo';

const okBody = JSON.stringify({
  version: '1.0.0',
  pubkey: 'pubkey',
  num_users: 1,
  num_disabled_users: 0,
  num_signup_codes: 1,
  num_unused_signup_codes: 1,
  total_disk_used_mb: 10,
});
const jsonHeaders = { 'Content-Type': 'application/json' };

describe('useAdminInfo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads admin info and updates state', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          version: '1.0.0',
          pubkey: 'pubkey',
          num_users: 1,
          num_disabled_users: 0,
          num_signup_codes: 1,
          num_unused_signup_codes: 1,
          total_disk_used_mb: 10,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { result } = renderHook(() => useAdminInfo());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data?.version).toBe('1.0.0');
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/info', expect.any(Object));
  });

  it('captures error state when request fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Boom' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useAdminInfo());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error?.message).toContain('Boom');
  });

  it('retries in the background while errored and stops once recovered', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'starting' }), { status: 502, headers: jsonHeaders }),
        )
        .mockResolvedValue(new Response(okBody, { status: 200, headers: jsonHeaders }));

      const { result } = renderHook(() => useAdminInfo());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.error?.message).toContain('starting');
      expect(result.current.isLoading).toBe(false);

      // first background retry recovers, without flipping isLoading
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(result.current.error).toBeNull();
      expect(result.current.data?.version).toBe('1.0.0');
      expect(result.current.isLoading).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // recovered: back to one-shot semantics, no further polling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps showing the error (no skeleton flash) while retries keep failing', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ error: 'down' }), { status: 500, headers: jsonHeaders }));

      const { result } = renderHook(() => useAdminInfo());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.error).toBeTruthy();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('refresh updates data without flipping isLoading', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(okBody, { status: 200, headers: jsonHeaders }));

    const { result } = renderHook(() => useAdminInfo());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...JSON.parse(okBody), num_unused_signup_codes: 0 }), {
        status: 200,
        headers: jsonHeaders,
      }),
    );
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data?.num_unused_signup_codes).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('a failing refresh leaves the good data and does not raise a connection error', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(okBody, { status: 200, headers: jsonHeaders }));

    const { result } = renderHook(() => useAdminInfo());
    await waitFor(() => expect(result.current.data).not.toBeNull());

    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'blip' }), { status: 502, headers: jsonHeaders }));
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data?.version).toBe('1.0.0');
  });

  // A watch poll landing on top of a manual refetch used to strand isLoading at
  // true, leaving skeletons over the whole page until the next manual fetch.
  it('a refresh during an in-flight refetch is skipped, and isLoading still clears', async () => {
    let releaseSlowFetch: (() => void) | undefined;
    const slowResponse = new Promise<Response>((resolve) => {
      releaseSlowFetch = () => resolve(new Response(okBody, { status: 200, headers: jsonHeaders }));
    });
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(okBody, { status: 200, headers: jsonHeaders }));

    const { result } = renderHook(() => useAdminInfo());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    fetchMock.mockReturnValueOnce(slowResponse);
    const callsBefore = fetchMock.mock.calls.length;
    let refetchDone: Promise<void> | undefined;
    act(() => {
      refetchDone = result.current.refetch();
    });
    expect(result.current.isLoading).toBe(true);

    // The 3s watch poll lands while the manual refetch is still in the air.
    await act(async () => {
      await result.current.refresh();
    });
    expect(fetchMock.mock.calls.length).toBe(callsBefore + 1);

    await act(async () => {
      releaseSlowFetch?.();
      await refetchDone;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('never stacks requests: a hanging fetch suppresses further retries', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));

      renderHook(() => useAdminInfo());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
