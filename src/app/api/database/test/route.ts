import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Teste de query simples
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    
    return NextResponse.json({
      success: true,
      message: 'Conexão com PostgreSQL estabelecida',
      database: 'PostgreSQL via Prisma',
      timestamp: new Date().toISOString(),
      testResult: result
    });
  } catch (error: any) {
    console.error('Erro no teste do banco:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        database: 'PostgreSQL via Prisma',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
