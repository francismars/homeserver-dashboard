import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Read from server-only environment variables
  const baseUrl = process.env.ADMIN_BASE_URL || process.env.NEXT_PUBLIC_ADMIN_BASE_URL;
  const token = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;

  if (!baseUrl || !token) {
    return NextResponse.json(
      { error: 'Admin API not configured. Set ADMIN_BASE_URL and ADMIN_TOKEN.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${baseUrl}/generate_signup_token`, {
      method: 'GET',
      headers: {
        'X-Admin-Password': token,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to generate invite: ${response.status}` },
        { status: response.status }
      );
    }

    const text = await response.text();
    return NextResponse.json({ token: text });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to homeserver' },
      { status: 500 }
    );
  }
}
