import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the backend URL from environment variables
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    // Get the query parameters from the request
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    
    // Redirect to the Railway backend callback with query parameters
    return NextResponse.redirect(`${backendUrl}/auth/google/callback?${queryString}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { error: 'Failed to complete OAuth' },
      { status: 500 }
    );
  }
}
