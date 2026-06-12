// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { detectCloudflareMode } from './cloudflare-mode';

const TOKEN = 'a'.repeat(48);

describe('detectCloudflareMode', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-mode-test-'));
    process.env.CLOUDFLARE_CONFIG_DIR = tmpDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const write = (name: string, contents: string) => fs.writeFile(path.join(tmpDir, name), contents, 'utf-8');
  const seedConnect = async () => {
    await write('config.yml', 'tunnel: x');
    await write('credentials.json', '{}');
  };

  it('empty dir is off', async () => {
    expect(await detectCloudflareMode()).toEqual({ mode: 'off', domain: null });
  });

  it('missing dir is off', async () => {
    process.env.CLOUDFLARE_CONFIG_DIR = path.join(tmpDir, 'does-not-exist');
    expect(await detectCloudflareMode()).toEqual({ mode: 'off', domain: null });
  });

  it('config.yml + credentials.json is connect, with the domain file as hostname', async () => {
    await seedConnect();
    await write('domain', 'pubky.example.com\n');
    expect(await detectCloudflareMode()).toEqual({ mode: 'connect', domain: 'pubky.example.com' });
  });

  it('connect does not require a domain file', async () => {
    await seedConnect();
    expect(await detectCloudflareMode()).toEqual({ mode: 'connect', domain: null });
  });

  it('non-empty token + domain is token', async () => {
    await write('token', TOKEN);
    await write('domain', 'pubky.example.com');
    expect(await detectCloudflareMode()).toEqual({ mode: 'token', domain: 'pubky.example.com' });
  });

  it('testdrive.env marker is preview', async () => {
    await write('testdrive.env', 'TUNNEL_URL=http://homeserver:6286\n');
    expect((await detectCloudflareMode()).mode).toBe('preview');
  });

  // Contradictory leftovers: precedence is connect > token > preview.
  it('config.yml without credentials.json is not connect (falls through to token)', async () => {
    await write('config.yml', 'tunnel: x');
    await write('token', TOKEN);
    await write('domain', 'pubky.example.com');
    expect((await detectCloudflareMode()).mode).toBe('token');
  });

  it('credentials.json without config.yml is not connect', async () => {
    await write('credentials.json', '{}');
    expect((await detectCloudflareMode()).mode).toBe('off');
  });

  it('connect files win over a token setup', async () => {
    await seedConnect();
    await write('token', TOKEN);
    await write('domain', 'pubky.example.com');
    expect((await detectCloudflareMode()).mode).toBe('connect');
  });

  it('connect files win over a preview marker', async () => {
    await seedConnect();
    await write('testdrive.env', '');
    expect((await detectCloudflareMode()).mode).toBe('connect');
  });

  it('a token setup wins over a preview marker', async () => {
    await write('token', TOKEN);
    await write('domain', 'pubky.example.com');
    await write('testdrive.env', '');
    expect((await detectCloudflareMode()).mode).toBe('token');
  });

  it('all three fingerprints at once resolve to connect', async () => {
    await seedConnect();
    await write('token', TOKEN);
    await write('domain', 'pubky.example.com');
    await write('testdrive.env', '');
    expect((await detectCloudflareMode()).mode).toBe('connect');
  });

  it('token without a domain is off', async () => {
    await write('token', TOKEN);
    expect((await detectCloudflareMode()).mode).toBe('off');
  });

  it('domain without a token is off, but the domain is still reported', async () => {
    await write('domain', 'pubky.example.com');
    expect(await detectCloudflareMode()).toEqual({ mode: 'off', domain: 'pubky.example.com' });
  });

  it.each([
    ['empty token file', '', 'pubky.example.com'],
    ['whitespace-only token', '   \n', 'pubky.example.com'],
    ['localhost domain', TOKEN, 'localhost'],
    ['localhost domain with port', TOKEN, 'localhost:6286'],
    ['trycloudflare residue domain', TOKEN, 'random.trycloudflare.com'],
  ])('%s is not a token setup (falls through to preview when marked)', async (_label, token, domain) => {
    await write('token', token);
    await write('domain', domain);
    expect((await detectCloudflareMode()).mode).toBe('off');
    await write('testdrive.env', '');
    expect((await detectCloudflareMode()).mode).toBe('preview');
  });
});
