import { NextRequest } from 'next/server';
import { proxyToUpstream } from '@/lib/server/upstream-proxy';

export const dynamic = 'force-dynamic';

const ROUTE_NAME = '/api/client-proxy/[[...path]]';

// Same convention as ADMIN_BASE_URL: compose-internal hostname by default,
// overridable for non-Docker setups.
const DEFAULT_CLIENT_BASE_URL = 'http://homeserver:6286';

type RouteParams = { params: Promise<{ path?: string[] }> };

async function handle(request: NextRequest, params: RouteParams['params'], method: string) {
  const { path } = await params;
  return proxyToUpstream(request, path ?? [], method, {
    baseUrl: process.env.CLIENT_BASE_URL || DEFAULT_CLIENT_BASE_URL,
    routeName: ROUTE_NAME,
  });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return handle(request, params, 'GET');
}

export async function HEAD(request: NextRequest, { params }: RouteParams) {
  return handle(request, params, 'HEAD');
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return handle(request, params, 'POST');
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return handle(request, params, 'PUT');
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return handle(request, params, 'DELETE');
}
