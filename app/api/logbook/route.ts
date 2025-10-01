import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Forward the request to the backend server
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? `${process.env.BACKEND_URL}/api/logbook`
      : 'http://localhost:3001/api/logbook';
    
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
    console.error('Logbook proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logbook data' },
      { status: 500 }
    );
  }
}
