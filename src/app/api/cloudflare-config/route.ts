import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_DIR = process.env.CLOUDFLARE_CONFIG_DIR || '/app/cloudflare-config';
const TOKEN_FILE = path.join(CONFIG_DIR, 'token');
const DOMAIN_FILE = path.join(CONFIG_DIR, 'domain');

function isAllowedHostname(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (domain.startsWith('localhost') || domain.endsWith('.localhost')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return false;
  if (domain.includes(':')) return false;
  if (!domain.includes('.')) return false;
  return true;
}

/**
 * GET /api/cloudflare-config
 * Returns current Cloudflare domain (if set). Token is never returned.
 */
export async function GET() {
  try {
    const domain = await fs.readFile(DOMAIN_FILE, 'utf-8').then((s) => s.trim()).catch(() => null);
    const hasToken = await fs
      .readFile(TOKEN_FILE, 'utf-8')
      .then((s) => s.trim().length > 0)
      .catch(() => false);
    return NextResponse.json({
      domain: domain || null,
      configured: !!(domain && hasToken),
    });
  } catch {
    return NextResponse.json({ domain: null, configured: false });
  }
}

/**
 * POST /api/cloudflare-config
 * Body: { token?: string, domain?: string }
 * Writes to mounted volume so homeserver and cloudflared pick up after restart.
 */
export async function POST(request: NextRequest) {
  let body: { token?: string; domain?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const domain = typeof body.domain === 'string' ? body.domain.trim() : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (domain && !isAllowedHostname(domain)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
  }

  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (e) {
    console.error('Cloudflare config mkdir failed:', e);
    return NextResponse.json(
      { error: 'Config directory unavailable (mount missing?)' },
      { status: 503 }
    );
  }

  try {
    if (body.domain !== undefined) {
      await fs.writeFile(DOMAIN_FILE, domain, 'utf-8');
    }
    if (body.token !== undefined) {
      await fs.writeFile(TOKEN_FILE, token, 'utf-8');
    }
    return NextResponse.json({
      ok: true,
      message: 'Saved. Restart the app from Umbrel for the tunnel to connect.',
    });
  } catch (e) {
    console.error('Cloudflare config write failed:', e);
    return NextResponse.json({ error: 'Failed to write config' }, { status: 500 });
  }
}
