import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDisabledUsers } from './useDisabledUsers';

describe('useDisabledUsers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads first page of disabled users', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ pubkey: 'abc123' }],
          next_cursor: null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { result } = renderHook(() => useDisabledUsers());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].pubkey).toBe('abc123');
  });

  it('loads more users and deduplicates by pubkey', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ pubkey: 'abc123' }],
            next_cursor: 'cursor-1',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ pubkey: 'abc123' }, { pubkey: 'def456' }],
            next_cursor: null,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const { result } = renderHook(() => useDisabledUsers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.map((item) => item.pubkey)).toEqual(['abc123', 'def456']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
