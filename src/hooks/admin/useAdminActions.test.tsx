import { act, renderHook } from '@testing-library/react';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminActions } from './useAdminActions';

const jsonHeaders = { 'Content-Type': 'application/json' };

describe('useAdminActions', () => {
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, 'fetch') as unknown as Mock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generateInvite prepends new invites and clears the busy flag', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'INV-1' }), { status: 200, headers: jsonHeaders }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'INV-2' }), { status: 200, headers: jsonHeaders }));
    const { result } = renderHook(() => useAdminActions());

    await act(async () => {
      await result.current.generateInvite();
    });
    await act(async () => {
      await result.current.generateInvite();
    });

    expect(result.current.generatedInvites).toEqual(['INV-2', 'INV-1']);
    expect(result.current.isGeneratingInvite).toBe(false);
    expect(result.current.generateInviteError).toBeNull();
  });

  it('generateInvite keeps only the last 10 invites', async () => {
    let n = 0;
    fetchMock.mockImplementation(async () => {
      n += 1;
      return new Response(JSON.stringify({ token: `INV-${n}` }), { status: 200, headers: jsonHeaders });
    });
    const { result } = renderHook(() => useAdminActions());

    for (let i = 0; i < 12; i++) {
      await act(async () => {
        await result.current.generateInvite();
      });
    }

    expect(result.current.generatedInvites).toHaveLength(10);
    expect(result.current.generatedInvites[0]).toBe('INV-12');
    expect(result.current.generatedInvites[9]).toBe('INV-3');
  });

  it('generateInvite failure sets the error state and rethrows', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'No invites left' }), { status: 429, headers: jsonHeaders }),
    );
    const { result } = renderHook(() => useAdminActions());

    await act(async () => {
      await expect(result.current.generateInvite()).rejects.toThrow('No invites left');
    });

    expect(result.current.generateInviteError?.message).toBe('No invites left');
    expect(result.current.isGeneratingInvite).toBe(false);
    expect(result.current.generatedInvites).toEqual([]);
  });

  it('deleteUrl proxies the path and resets the busy flag', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { result } = renderHook(() => useAdminActions());

    await act(async () => {
      await result.current.deleteUrl('pub/files/a.txt');
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/webdav/pub/files/a.txt');
    expect(init.method).toBe('DELETE');
    expect(result.current.isDeletingUrl).toBe(false);
    expect(result.current.deleteUrlError).toBeNull();
  });

  it('deleteUrl failure surfaces the error and rethrows', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: jsonHeaders }),
    );
    const { result } = renderHook(() => useAdminActions());

    await act(async () => {
      await expect(result.current.deleteUrl('missing.txt')).rejects.toThrow('Not found');
    });

    expect(result.current.deleteUrlError?.message).toBe('Not found');
    expect(result.current.isDeletingUrl).toBe(false);
  });

  it('disableUser and enableUser hit their endpoints and track errors independently', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { result } = renderHook(() => useAdminActions());

    await act(async () => {
      await result.current.disableUser('pk1');
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/users/pk1/disable');
    expect(result.current.disableUserError).toBeNull();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'User not disabled' }), { status: 409, headers: jsonHeaders }),
    );
    await act(async () => {
      await expect(result.current.enableUser('pk1')).rejects.toThrow('User not disabled');
    });
    expect(result.current.enableUserError?.message).toBe('User not disabled');
    expect(result.current.disableUserError).toBeNull();
    expect(result.current.isEnablingUser).toBe(false);
  });
});
