import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Forward the request to the backend server
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? `${process.env.BACKEND_URL}/api/calendar/auth-status`
      : 'http://localhost:3001/api/calendar/auth-status';
    
    // Get cookies from the original request
    const cookieHeader = request.headers.get('cookie');

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader && { 'Cookie': cookieHeader }),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Auth status proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}
