import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '@/lib/utils';

const RESET_MS = 2000;

/**
 * Copy-to-clipboard with transient "Copied" feedback.
 *
 * `copy(value, key?)` writes `value` to the clipboard (with the shared
 * execCommand fallback for insecure contexts) and sets `copiedKey` to `key`
 * (default 'copied') for 2 seconds. Lists pass a per-row key and compare it
 * against `copiedKey`; single buttons just check `copiedKey !== null`.
 * The reset timer is cleared on unmount and on every new copy, and a copy
 * failure (clipboard unavailable) leaves the state untouched.
 */
export function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(async (value: string, key = 'copied'): Promise<boolean> => {
    try {
      await copyToClipboard({ text: value });
    } catch {
      return false;
    }
    if (!mountedRef.current) return true;
    setCopiedKey(key);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setCopiedKey(null);
    }, RESET_MS);
    return true;
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCopiedKey(null);
  }, []);

  return { copiedKey, copy, reset };
}
