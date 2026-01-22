import { NextRequest } from 'next/server';
import { proxyWebDavRequest } from './utils';

// Handle root WebDAV requests (/api/webdav without trailing slash)
// Forward to the catch-all route handler with empty path array
export async function GET(request: NextRequest) {
  return proxyWebDavRequest(request, Promise.resolve({ path: [] }), 'GET');
}

export async function POST(request: NextRequest) {
  return proxyWebDavRequest(request, Promise.resolve({ path: [] }), 'POST');
}

export async function PUT(request: NextRequest) {
  return proxyWebDavRequest(request, Promise.resolve({ path: [] }), 'PUT');
}

export async function DELETE(request: NextRequest) {
  return proxyWebDavRequest(request, Promise.resolve({ path: [] }), 'DELETE');
}
