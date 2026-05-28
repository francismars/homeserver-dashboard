import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Liveness probe. Returns 200 as long as the Next.js process can serve a
 * request. Does NOT consult downstream services (homeserver, Cloudflare,
 * filesystem) - those are separate concerns. Use this in the Dockerfile
 * HEALTHCHECK directive, the docker-compose healthcheck, and any
 * orchestrator (Umbrel, Kubernetes) probe.
 *
 * For a "can we reach a public hostname?" probe, see /api/public-health.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
