import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const VALID_CONFIG = [
  '[general]',
  'database_url = "postgres://localhost:5432/pubky_homeserver"',
  'signup_mode = "token_required"',
  '',
  '[drive]',
  'pubky_listen_socket = "127.0.0.1:6287"',
  'icann_listen_socket = "127.0.0.1:6286"',
  '',
  '[admin]',
  'enabled = true',
  'listen_socket = "127.0.0.1:6288"',
  'admin_password = "real-admin-password"',
  '',
  '[storage]',
  'type = "file_system"',
  '',
].join('\n');

function sha256(s: string): string {
  return 'sha256:' + createHash('sha256').update(s).digest('hex');
}

describe('server-config route', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;
  let configPath: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'srv-config-test-'));
    configPath = path.join(tmpDir, 'config.toml');
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function loadRoute() {
    process.env.HOMESERVER_CONFIG_PATH = configPath;
    const mod = await import('./route');
    return mod;
  }

  function postRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost:8080/api/server-config', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
  }

  describe('GET', () => {
    it('returns 404 when the config file does not exist', async () => {
      const { GET } = await loadRoute();
      const response = await GET();
      const payload = await response.json();
      expect(response.status).toBe(404);
      expect(payload.type).toBe('not_found');
    });

    it('returns config + checksum + mtime + writable', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { GET } = await loadRoute();
      const response = await GET();
      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload).toMatchObject({
        config: expect.stringContaining('[general]'),
        checksum: sha256(VALID_CONFIG),
        writable: true,
      });
      expect(typeof payload.mtime).toBe('string');
      expect(new Date(payload.mtime).getTime()).not.toBeNaN();
    });

    it('redacts admin_password and database_url', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { GET } = await loadRoute();
      const payload = await (await GET()).json();
      expect(payload.config).not.toContain('real-admin-password');
      expect(payload.config).not.toContain('postgres://localhost:5432');
      expect(payload.config).toContain('"********"');
    });

    it('returns writable:false on a read-only config file', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      await fs.chmod(configPath, 0o444);
      const { GET } = await loadRoute();
      const payload = await (await GET()).json();
      expect(payload.writable).toBe(false);
    });

    it('returns 500 internal_error on unexpected fs failure', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { GET } = await loadRoute();
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('EACCES'));
      const response = await GET();
      const payload = await response.json();
      expect(response.status).toBe(500);
      expect(payload.type).toBe('internal_error');
      expect(payload).not.toHaveProperty('details');
    });
  });

  describe('POST', () => {
    it('rejects invalid JSON body with 400', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { POST } = await loadRoute();
      const response = await POST(postRequest('{not-json'));
      const payload = await response.json();
      expect(response.status).toBe(400);
      expect(payload.type).toBe('bad_request');
    });

    it('rejects missing config_toml with 400', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { POST } = await loadRoute();
      const response = await POST(postRequest({ checksum: 'sha256:abc' }));
      expect(response.status).toBe(400);
    });

    it('rejects missing checksum with 400', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { POST } = await loadRoute();
      const response = await POST(postRequest({ config_toml: VALID_CONFIG }));
      expect(response.status).toBe(400);
    });

    it('returns 404 when the config file does not exist', async () => {
      const { POST } = await loadRoute();
      const response = await POST(postRequest({ config_toml: VALID_CONFIG, checksum: 'sha256:abc' }));
      const payload = await response.json();
      expect(response.status).toBe(404);
      expect(payload.type).toBe('not_found');
    });

    it('returns 409 on checksum mismatch with current_checksum in body', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { POST } = await loadRoute();
      const response = await POST(
        postRequest({
          config_toml: VALID_CONFIG.replace('token_required', 'open'),
          checksum: 'sha256:wrong',
        }),
      );
      const payload = await response.json();
      expect(response.status).toBe(409);
      expect(payload.type).toBe('conflict');
      expect(payload.current_checksum).toBe(sha256(VALID_CONFIG));
    });

    it('rejects invalid TOML with 400', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { POST } = await loadRoute();
      const response = await POST(
        postRequest({
          config_toml: 'this is not toml [[[',
          checksum: sha256(VALID_CONFIG),
        }),
      );
      const payload = await response.json();
      expect(response.status).toBe(400);
      expect(payload.error).toContain('Invalid TOML');
    });

    it('rejects config missing a required section with 400', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { POST } = await loadRoute();
      // No [storage] section
      const broken = ['[general]', '[drive]', '[admin]', 'admin_password = "real-admin-password"'].join('\n');
      const response = await POST(postRequest({ config_toml: broken, checksum: sha256(VALID_CONFIG) }));
      const payload = await response.json();
      expect(response.status).toBe(400);
      expect(payload.error).toContain('storage');
    });

    it('writes the new config atomically and returns the new checksum', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const updated = VALID_CONFIG.replace('token_required', 'open');
      const { POST } = await loadRoute();
      const response = await POST(postRequest({ config_toml: updated, checksum: sha256(VALID_CONFIG) }));
      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.checksum).toBe(sha256(updated));
      expect(await fs.readFile(configPath, 'utf-8')).toBe(updated);
    });

    it('redaction roundtrip: "********" in payload preserves the real on-disk secret', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { GET, POST } = await loadRoute();
      // What the UI would see in GET — admin_password is masked
      const redactedView = (await (await GET()).json()).config as string;
      expect(redactedView).toContain('admin_password = "********"');
      expect(redactedView).not.toContain('real-admin-password');

      // User edits an unrelated line and POSTs the redacted view back
      const userEdit = redactedView.replace('token_required', 'open');
      const response = await POST(postRequest({ config_toml: userEdit, checksum: sha256(VALID_CONFIG) }));
      expect(response.status).toBe(200);

      // The file on disk must still have the real secret, not the "********"
      const onDisk = await fs.readFile(configPath, 'utf-8');
      expect(onDisk).toContain('admin_password = "real-admin-password"');
      expect(onDisk).not.toContain('admin_password = "********"');
      // And the unrelated edit did take effect
      expect(onDisk).toContain('signup_mode = "open"');
    });

    it('accepts a real new value for a sensitive key (not the placeholder)', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { POST } = await loadRoute();
      const newConfig = VALID_CONFIG.replace(
        'admin_password = "real-admin-password"',
        'admin_password = "new-password-xyz"',
      );
      const response = await POST(postRequest({ config_toml: newConfig, checksum: sha256(VALID_CONFIG) }));
      expect(response.status).toBe(200);
      const onDisk = await fs.readFile(configPath, 'utf-8');
      expect(onDisk).toContain('admin_password = "new-password-xyz"');
    });

    it('atomic write: original file unchanged if rename fails mid-write', async () => {
      await fs.writeFile(configPath, VALID_CONFIG, 'utf-8');
      const { POST } = await loadRoute();
      const renameSpy = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('ENOSPC'));
      const response = await POST(
        postRequest({
          config_toml: VALID_CONFIG.replace('token_required', 'open'),
          checksum: sha256(VALID_CONFIG),
        }),
      );
      expect(response.status).toBe(500);
      // Original file content preserved
      expect(await fs.readFile(configPath, 'utf-8')).toBe(VALID_CONFIG);
      renameSpy.mockRestore();
    });
  });
});
