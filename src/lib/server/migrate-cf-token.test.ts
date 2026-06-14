// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
// Import the real migration module the container runs (a self-contained .mjs).
import { migrate, tokenToCredentials } from '../../../scripts/migrate-cf-token.mjs';
import { tokenToCredentials as tsTokenToCredentials } from './tunnel-credentials';

const TID = '2043373f-18dd-4616-b30e-7f9d0e9d8bc6';
const mkToken = (tid = TID) =>
  Buffer.from(JSON.stringify({ a: 'acct', s: Buffer.alloc(32, 9).toString('base64'), t: tid }), 'utf-8').toString(
    'base64',
  );

describe('migrate-cf-token', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-migrate-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const write = (f: string, c: string) => fs.writeFile(path.join(dir, f), c, 'utf-8');
  const read = (f: string) => fs.readFile(path.join(dir, f), 'utf-8');
  const exists = (f: string) =>
    fs
      .access(path.join(dir, f))
      .then(() => true)
      .catch(() => false);

  it('converts a legacy token-mode install into credentials.json + config.yml', async () => {
    await write('token', mkToken());
    await write('domain', 'pubky.example.com');
    const r = await migrate(dir);
    expect(r.migrated).toBe(true);
    expect(r.tunnelId).toBe(TID);
    expect(JSON.parse(await read('credentials.json')).TunnelID).toBe(TID);
    const yml = await read('config.yml');
    expect(yml).toContain(`tunnel: ${TID}`);
    expect(yml).toContain('hostname: pubky.example.com');
    expect(yml).toContain('credentials-file: /etc/cloudflared-config/credentials.json');
    expect(yml).toContain('service: http://homeserver:6286');
  });

  it('its decode agrees byte-for-byte with the app-side tokenToCredentials', async () => {
    const token = mkToken();
    expect(tokenToCredentials(token)).toEqual(tsTokenToCredentials(token));
  });

  it('is idempotent: a no-op when config.yml already exists', async () => {
    await write('token', mkToken());
    await write('domain', 'pubky.example.com');
    await write('config.yml', 'tunnel: existing');
    const r = await migrate(dir);
    expect(r.migrated).toBe(false);
    expect(await read('config.yml')).toBe('tunnel: existing'); // untouched
  });

  it.each([
    ['no token file', async () => write('domain', 'pubky.example.com')],
    ['empty token', async () => Promise.all([write('token', ''), write('domain', 'pubky.example.com')])],
    ['localhost domain', async () => Promise.all([write('token', mkToken()), write('domain', 'localhost:6286')])],
    [
      'trycloudflare domain',
      async () => Promise.all([write('token', mkToken()), write('domain', 'x.trycloudflare.com')]),
    ],
    ['no domain', async () => write('token', mkToken())],
    [
      'undecodable token',
      async () => Promise.all([write('token', 'not-a-token'), write('domain', 'pubky.example.com')]),
    ],
  ])('does not migrate: %s', async (_label, setup) => {
    await setup();
    const r = await migrate(dir);
    expect(r.migrated).toBe(false);
    expect(await exists('config.yml')).toBe(false);
    expect(await exists('credentials.json')).toBe(false);
  });

  it('runs correctly as a CLI exactly as the container invokes it', async () => {
    await write('token', mkToken());
    await write('domain', 'pubky.example.com');
    const script = fileURLToPath(new URL('../../../scripts/migrate-cf-token.mjs', import.meta.url));
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const { stdout } = await promisify(execFile)('node', [script], {
      env: { ...process.env, CLOUDFLARE_CONFIG_DIR: dir },
    });
    expect(stdout).toContain('converted token-mode tunnel');
    expect(JSON.parse(await read('credentials.json')).TunnelID).toBe(TID);
  });
});
