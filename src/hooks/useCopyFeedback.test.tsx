import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyFeedback } from './useCopyFeedback';

function stubClipboard(writeText = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

describe('useCopyFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copies the value and sets the default key, then resets after 2s', async () => {
    const writeText = stubClipboard();
    const { result } = renderHook(() => useCopyFeedback());

    await act(async () => {
      await result.current.copy('hello');
    });
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(result.current.copiedKey).toBe('copied');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.copiedKey).toBeNull();
  });

  it('a per-row key replaces the previous one and restarts the reset timer', async () => {
    stubClipboard();
    const { result } = renderHook(() => useCopyFeedback());

    await act(async () => {
      await result.current.copy('a', 'row-1');
    });
    expect(result.current.copiedKey).toBe('row-1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
      await result.current.copy('b', 'row-2');
    });
    expect(result.current.copiedKey).toBe('row-2');

    // 1.5s after the second copy the first timer would have fired; the
    // restarted timer keeps the second key alive until its own 2s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(result.current.copiedKey).toBe('row-2');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.copiedKey).toBeNull();
  });

  it('a failed copy returns false and leaves copiedKey untouched', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const { result } = renderHook(() => useCopyFeedback());

    let ok = true;
    await act(async () => {
      ok = await result.current.copy('nope');
    });
    expect(ok).toBe(false);
    expect(result.current.copiedKey).toBeNull();
  });

  it('reset clears the key and its timer immediately', async () => {
    stubClipboard();
    const { result } = renderHook(() => useCopyFeedback());

    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.copiedKey).toBe('copied');
    act(() => {
      result.current.reset();
    });
    expect(result.current.copiedKey).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('unmount clears the pending reset timer', async () => {
    stubClipboard();
    const { result, unmount } = renderHook(() => useCopyFeedback());

    await act(async () => {
      await result.current.copy('hello');
    });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
