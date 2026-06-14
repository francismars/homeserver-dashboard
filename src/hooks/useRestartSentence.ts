import { usePlatform } from '@/components/providers/PlatformProvider';
import { restartAppSentence } from '@/lib/restart-copy';

/** The platform-aware restart instruction for client components. */
export function useRestartSentence(): string {
  return restartAppSentence(usePlatform());
}
