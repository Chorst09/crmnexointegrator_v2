import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      message: 'API funcionando corretamente',
      timestamp: new Date().toISOString(),
      status: 'healthy'
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        status: 'unhealthy'
      },
      { status: 500 }
    );
  }
}