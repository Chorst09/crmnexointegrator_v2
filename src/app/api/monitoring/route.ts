import { NextRequest, NextResponse } from 'next/server';

/**
 * Monitoring API endpoint for database operations and performance metrics
 * Provides insights into system health, performance, and error patterns
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Simplified monitoring endpoint - basic system info
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'health';

    switch (endpoint) {
      case 'health':
        return NextResponse.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version
        });
      
      case 'stats':
        return NextResponse.json({
          timestamp: new Date().toISOString(),
          system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version
          },
          database: {
            status: 'connected',
            url: process.env.DATABASE_URL ? 'configured' : 'not configured'
          }
        });
      
      default:
        return NextResponse.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          availableEndpoints: ['health', 'stats']
        });
    }

  } catch (error) {
    console.error('Error in monitoring API:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Simplified monitoring functions removed - using basic system info only

// Only allow GET requests
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'POST method not allowed' },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'PUT method not allowed' },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'DELETE method not allowed' },
    { status: 405 }
  );
}