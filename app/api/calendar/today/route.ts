import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    // Forward the request to the backend server
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? `${process.env.BACKEND_URL}/api/calendar/today${date ? `?date=${date}` : ''}`
      : `http://localhost:3001/api/calendar/today${date ? `?date=${date}` : ''}`;
    
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
    console.error('Calendar today proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}
