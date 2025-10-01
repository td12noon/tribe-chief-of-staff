import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Forward the request to the backend server
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? `${process.env.BACKEND_URL}/auth/google`
      : 'http://localhost:3001/auth/google';
    
    // Get cookies from the original request
    const cookieHeader = request.headers.get('cookie');

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader && { 'Cookie': cookieHeader }),
      },
      redirect: 'manual', // Don't follow redirects automatically
    });

    // If it's a redirect response, redirect the user
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('location');
      if (location) {
        return NextResponse.redirect(location);
      }
    }

    // If it's not a redirect, return the response
    const data = await response.text();
    return new NextResponse(data, { status: response.status });
  } catch (error) {
    console.error('OAuth redirect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}
