import { NextRequest, NextResponse } from 'next/server';

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

// Handle PROPFIND and other WebDAV methods via POST with X-HTTP-Method-Override header
export async function proxyWebDavRequest(
  request: NextRequest,
  paramsPromise: Promise<{ path: string[] }>,
  method: string
) {
  const { path } = await paramsPromise;
  
  // Read from server-only environment variables
  const adminBaseUrl = process.env.ADMIN_BASE_URL || '';
  const adminToken = process.env.ADMIN_TOKEN || '';

  if (!adminBaseUrl || !adminToken) {
    console.error('WebDAV proxy error: Missing configuration:', {
      adminBaseUrl: adminBaseUrl || 'missing',
      hasToken: !!adminToken,
    });
    return NextResponse.json(
      {
        error: 'WebDAV not configured. Set ADMIN_BASE_URL and ADMIN_TOKEN.',
        details: { adminBaseUrl: adminBaseUrl || 'missing', hasToken: !!adminToken },
      },
      { status: 500 }
    );
  }

  // Construct WebDAV URL: /dav + path segments
  const pathSegments = path.join('/');
  // For root path (empty), use /dav/, otherwise /dav/path/segments
  const webdavPath = pathSegments ? `/dav/${pathSegments}` : '/dav/';
  const url = new URL(webdavPath, adminBaseUrl);

  // Forward query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  try {
    // Get the actual HTTP method from headers (for PROPFIND, MKCOL, MOVE, etc.)
    const actualMethod = request.headers.get('X-HTTP-Method-Override') || method;
    
    console.log('[WebDAV Proxy]', {
      method: actualMethod,
      pathSegments: pathSegments || '(root)',
      webdavPath,
      targetUrl: url.toString(),
      adminBaseUrl,
    });
    
    // Get request body if present (for POST with override, or PUT/DELETE)
    let body: string | undefined;
    if (method === 'POST' || method === 'PUT') {
      body = await request.text();
    }

    // Get headers to forward
    const headers: HeadersInit = {
      'Authorization': `Basic ${btoa(`admin:${adminToken}`)}`,
    };

    // Forward Depth header for PROPFIND
    const depth = request.headers.get('Depth');
    if (depth) {
      headers['Depth'] = depth;
    }

    // Forward Content-Type
    const contentType = request.headers.get('Content-Type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    // Forward Destination header for MOVE/COPY
    const destination = request.headers.get('Destination');
    if (destination) {
      headers['Destination'] = destination;
    }

    const response = await fetch(url.toString(), {
      method: actualMethod,
      headers,
      body,
    });

    const responseText = await response.text();
    const responseContentType = response.headers.get('Content-Type') || 'application/xml';

    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'Content-Type': responseContentType,
      },
    });
  } catch (error) {
    console.error('WebDAV proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: 'Failed to connect to homeserver WebDAV',
        details: errorMessage,
        adminBaseUrl,
        hasToken: !!adminToken,
      },
      { status: 500 }
    );
  }
}
