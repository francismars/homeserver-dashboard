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
 * file fingerprints in the config dir. Since every persistent tier now runs
 * as one locally-managed tunnel (config.yml + credentials.json), `mode` is
 * really the setup METHOD (which the UI badges), not what runs:
 *   - token:   a non-empty token file next to a real public domain. The
 *     API-token and manual paste flows write that token purely as a
 *     setup-method marker (no container reads it); they ALSO write
 *     config.yml + credentials.json, which is what actually runs.
 *   - connect: config.yml + credentials.json with no token marker (the
 *     browser-auth flow truncates the token file to empty).
 *   - preview: testdrive.env marker
 *   - off:     none of the above
 *
 * Precedence is token > connect > preview. The token marker is checked first
 * because every token-tier setup now ALSO has config.yml: the marker is what
 * distinguishes "set up via token/API" from "set up via Connect" for the
 * badge. Preview comes last: every real setup tears preview down on
 * completion, so a surviving marker next to real credentials is residue.
 */
export async function detectCloudflareMode(): Promise<CloudflareModeInfo> {
  const domain = await fs
    .readFile(DOMAIN_PATH(), 'utf-8')
    .then((s) => s.trim() || null)
    .catch(() => null);
  const token = await fs
    .readFile(TOKEN_PATH(), 'utf-8')
    .then((s) => s.trim())
    .catch(() => '');
  // A localhost or trycloudflare domain next to a token is preview/disconnect
  // residue, never a configured token setup.
  const lower = domain?.toLowerCase();
  const realDomain = lower !== undefined && !lower.startsWith('localhost') && !lower.endsWith('.trycloudflare.com');
  if (token && realDomain) return { mode: 'token', domain };
  if ((await fileExists(LOCAL_CONFIG_PATH())) && (await fileExists(CREDENTIALS_PATH()))) {
    return { mode: 'connect', domain };
  }
  if (await fileExists(PREVIEW_ENV())) return { mode: 'preview', domain };
  return { mode: 'off', domain };
}
