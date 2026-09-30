import { NextRequest, NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  console.log('🧪 GET /api/proposals-test called');
  return NextResponse.json({ message: 'GET working', timestamp: new Date().toISOString() });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🧪 POST /api/proposals-test called');
    const body = await request.json();
    console.log('📋 Body received:', body);
    
    return NextResponse.json({ 
      message: 'POST working', 
      receivedData: body,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('❌ Error in POST:', error);
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 });
  }
}