import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the backend URL from environment variables
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    // Redirect directly to the Railway backend OAuth endpoint
    return NextResponse.redirect(`${backendUrl}/auth/google`);
  } catch (error) {
    console.error('OAuth redirect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}
