import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { BOOT_STAMP_PATH, detectRestartPending } from './restart-pending';

describe('detectRestartPending', () => {
  const originalEnv = { ...process.env };
  let configDir: string;
  let hsDir: string;

  beforeEach(async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'restart-pending-test-'));
    configDir = path.join(root, 'cloudflare-config');
    hsDir = path.join(root, 'homeserver-data');
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(hsDir, { recursive: true });
    process.env.CLOUDFLARE_CONFIG_DIR = configDir;
    process.env.HOMESERVER_CONFIG_PATH = path.join(hsDir, 'config.toml');
  });

  afterEach(async () => {
    const root = path.dirname(configDir);
    process.env = { ...originalEnv };
    await fs.rm(root, { recursive: true, force: true });
  });

  /** Sets a path's mtime to a deterministic offset from now. */
  const ageTo = async (p: string, secondsAgo: number) => {
    const t = new Date(Date.now() - secondsAgo * 1000);
    await fs.utimes(p, t, t);
  };
  const writeAged = async (p: string, secondsAgo: number, contents = 'x') => {
    await fs.writeFile(p, contents, 'utf-8');
    await ageTo(p, secondsAgo);
  };
  const writeStamp = async (secondsAgo: number) => {
    await writeAged(BOOT_STAMP_PATH(), secondsAgo, String(Math.floor(Date.now() / 1000) - secondsAgo));
  };
  const inConfig = (name: string) => path.join(configDir, name);

  it('no boot stamp (old wrapper, dev env): unknown', async () => {
    await writeAged(inConfig('token'), 10);
    expect(await detectRestartPending()).toEqual({ restart_pending: null, restart_reason: null });
  });

  it('stamp newer than everything: false', async () => {
    await writeAged(inConfig('token'), 100);
    await writeAged(inConfig('domain'), 100);
    await writeAged(process.env.HOMESERVER_CONFIG_PATH!, 100);
    await ageTo(configDir, 100);
    await writeStamp(50);
    expect(await detectRestartPending()).toEqual({ restart_pending: false, restart_reason: null });
  });

  it('stamp present but no state files at all: false', async () => {
    await ageTo(configDir, 100);
    await writeStamp(50);
    expect(await detectRestartPending()).toEqual({ restart_pending: false, restart_reason: null });
  });

  it.each([['token'], ['domain'], ['config.yml'], ['credentials.json']])(
    '%s newer than the stamp: setup_changed',
    async (file) => {
      await writeStamp(50);
      await writeAged(inConfig(file), 10);
      await ageTo(configDir, 100);
      expect(await detectRestartPending()).toEqual({ restart_pending: true, restart_reason: 'setup_changed' });
    },
  );

  it('testdrive.env newer than the stamp: preview_changed', async () => {
    await writeStamp(50);
    await writeAged(inConfig('testdrive.env'), 10);
    await ageTo(configDir, 100);
    expect(await detectRestartPending()).toEqual({ restart_pending: true, restart_reason: 'preview_changed' });
  });

  it('config.toml newer than the stamp: config_changed', async () => {
    await writeStamp(50);
    await writeAged(process.env.HOMESERVER_CONFIG_PATH!, 10);
    await ageTo(configDir, 100);
    expect(await detectRestartPending()).toEqual({ restart_pending: true, restart_reason: 'config_changed' });
  });

  it('deletion case: a teardown leaves fewer files but bumps the dir mtime', async () => {
    await writeAged(inConfig('testdrive.env'), 100);
    await writeStamp(50);
    // Teardown after the boot: the marker disappears, only the directory
    // mtime carries the change.
    await fs.rm(inConfig('testdrive.env'));
    expect(await detectRestartPending()).toEqual({ restart_pending: true, restart_reason: 'setup_changed' });
  });

  it('newest change wins the reason: config.toml edited after the setup', async () => {
    await writeStamp(50);
    await writeAged(inConfig('token'), 20);
    await writeAged(process.env.HOMESERVER_CONFIG_PATH!, 5);
    await ageTo(configDir, 100);
    expect(await detectRestartPending()).toEqual({ restart_pending: true, restart_reason: 'config_changed' });
  });

  it('newest change wins the reason: setup completed after a config edit', async () => {
    await writeStamp(50);
    await writeAged(process.env.HOMESERVER_CONFIG_PATH!, 20);
    await writeAged(inConfig('token'), 5);
    await ageTo(configDir, 100);
    expect(await detectRestartPending()).toEqual({ restart_pending: true, restart_reason: 'setup_changed' });
  });

  it('missing config dir with a fresh stamp: false', async () => {
    process.env.CLOUDFLARE_CONFIG_DIR = path.join(configDir, 'does-not-exist');
    await writeStamp(50);
    expect(await detectRestartPending()).toEqual({ restart_pending: false, restart_reason: null });
  });
});
