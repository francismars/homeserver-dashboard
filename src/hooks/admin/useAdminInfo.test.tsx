import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAdminInfo } from './useAdminInfo';

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
});
