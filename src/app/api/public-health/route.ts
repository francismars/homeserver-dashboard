import { NextRequest, NextResponse } from 'next/server';

const CHECK_TIMEOUT_MS = 8000;

/**
 * Validates that the domain is a public hostname (no localhost, no IP) to avoid SSRF.
 */
function isAllowedHostname(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (domain.startsWith('localhost') || domain.endsWith('.localhost')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return false; // IPv4
  if (domain.includes(':')) return false; // IPv6 or port
  if (!domain.includes('.')) return false; // need at least one dot for a public hostname
  return true;
}

/**
 * GET /api/public-health?domain=pubky.example.com
 * Probes https://domain to see if the public URL is reachable (e.g. behind Cloudflare Tunnel).
 * Used by the dashboard to show "Public URL reachable: yes/no".
 */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get('domain');
  if (!domain) {
    return NextResponse.json({ error: 'Missing domain' }, { status: 400 });
  }
  const normalized = domain.trim().toLowerCase();
  if (!isAllowedHostname(normalized)) {
    return NextResponse.json({ error: 'Domain not allowed' }, { status: 400 });
  }

  const url = `https://${normalized}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Pubky-Homeserver-Dashboard/1' },
    });
    clearTimeout(timeout);
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
    });
  } catch (e) {
    clearTimeout(timeout);
    const message = e instanceof Error ? e.message : 'Request failed';
    return NextResponse.json({
      ok: false,
      error: message,
    });
  }
}
