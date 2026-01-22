import { NextRequest } from 'next/server';
import { proxyWebDavRequest } from '../utils';

// Handle all HTTP methods for WebDAV
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyWebDavRequest(request, params, 'GET');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyWebDavRequest(request, params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyWebDavRequest(request, params, 'DELETE');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyWebDavRequest(request, params, 'POST');
}
