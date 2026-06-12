import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './usePolling';

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs fn on every interval tick', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling(fn, 1000));

    expect(fn).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('immediate: true also runs fn once at start', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling(fn, 1000, { immediate: true }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('skips ticks while a slow call is in flight (no overlap), then resumes', async () => {
    let release: () => void = () => {};
    const fn = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
      .mockResolvedValue(undefined);
    renderHook(() => usePolling(fn, 1000));

    // First tick starts the hanging call; the next three ticks are skipped.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    // Once the slow call resolves, polling picks up again on the next tick.
    await act(async () => {
      release();
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops polling on unmount', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => usePolling(fn, 1000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('enabled: false schedules nothing; toggling it starts and stops the interval', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ enabled }) => usePolling(fn, 1000, { enabled }), {
      initialProps: { enabled: false },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fn).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fn).toHaveBeenCalledTimes(2);

    rerender({ enabled: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('always calls the latest fn without resetting the interval', async () => {
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ fn }) => usePolling(fn, 1000), { initialProps: { fn: first } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ fn: second });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
