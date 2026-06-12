import { promises as fs } from 'fs';
import {
  CREDENTIALS_PATH,
  DOMAIN_PATH,
  LOCAL_CONFIG_PATH,
  PREVIEW_ENV,
  TOKEN_PATH,
  fileExists,
} from './cloudflared-process';

export type CloudflareMode = 'connect' | 'token' | 'preview' | 'off';

export interface CloudflareModeInfo {
  mode: CloudflareMode;
  /** Trimmed contents of the domain file, or null when absent/empty. */
  domain: string | null;
}

/**
 * Single source of truth for which Cloudflare setup is active, derived from
 * file fingerprints in the config dir:
 *   - connect: config.yml + credentials.json (locally-managed tunnel)
 *   - token:   non-empty token + a real public domain. The API-token and
 *     manual flows write the same two files, so they are one fingerprint.
 *   - preview: testdrive.env marker
 *   - off:     none of the above
 *
 * Precedence over contradictory leftovers is connect > token > preview,
 * matching what actually runs: config.yml pins the hostname the local tunnel
 * serves regardless of the token file (and the wrapper publishes the domain
 * file, which connect owns while its config exists), while every real setup
 * tears preview down on completion - so a surviving preview marker next to
 * real credentials is residue, never the active mode.
 */
export async function detectCloudflareMode(): Promise<CloudflareModeInfo> {
  const domain = await fs
    .readFile(DOMAIN_PATH(), 'utf-8')
    .then((s) => s.trim() || null)
    .catch(() => null);
  if ((await fileExists(LOCAL_CONFIG_PATH())) && (await fileExists(CREDENTIALS_PATH()))) {
    return { mode: 'connect', domain };
  }
  const token = await fs
    .readFile(TOKEN_PATH(), 'utf-8')
    .then((s) => s.trim())
    .catch(() => '');
  // A localhost or trycloudflare domain next to a token is preview/disconnect
  // residue, never a configured token setup.
  const lower = domain?.toLowerCase();
  const realDomain = lower !== undefined && !lower.startsWith('localhost') && !lower.endsWith('.trycloudflare.com');
  if (token && realDomain) return { mode: 'token', domain };
  if (await fileExists(PREVIEW_ENV())) return { mode: 'preview', domain };
  return { mode: 'off', domain };
}
