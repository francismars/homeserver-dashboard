import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'DELETE');
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  // Read from server-only environment variables (not NEXT_PUBLIC_*)
  const baseUrl = process.env.ADMIN_BASE_URL || process.env.NEXT_PUBLIC_ADMIN_BASE_URL;
  const token = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;

  if (!baseUrl || !token) {
    console.error('Missing configuration:', { baseUrl, hasToken: !!token, envKeys: Object.keys(process.env).filter(k => k.includes('ADMIN')) });
    return NextResponse.json(
      { 
        error: 'Admin API not configured. Set ADMIN_BASE_URL and ADMIN_TOKEN.',
        details: { baseUrl: baseUrl || 'missing', hasToken: !!token }
      },
      { status: 500 }
    );
  }

  const path = '/' + pathSegments.join('/');
  const url = new URL(path, baseUrl);
  
  // Forward query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  try {
    const body = method !== 'GET' && method !== 'HEAD' 
      ? await request.text() 
      : undefined;

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': token,
        // Forward other headers if needed
        ...Object.fromEntries(
          Object.entries(Object.fromEntries(request.headers.entries()))
            .filter(([key]) => 
              !['host', 'content-length'].includes(key.toLowerCase())
            )
        ),
      },
      body,
    });

    const contentType = response.headers.get('Content-Type') || 'application/json';
    const data = await response.text();
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Proxy error:', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      baseUrl,
      hasToken: !!token,
      url: url.toString(),
      method
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { 
        error: 'Failed to connect to homeserver',
        details: errorMessage,
        baseUrl,
        hasToken: !!token,
        attemptedUrl: url.toString()
      },
      { status: 500 }
    );
  }
}
