import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Tentando desabilitar RLS via API...');

    // Executar comando SQL direto para desabilitar RLS nas tabelas principais
    const queries = [
      'ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE users DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE fornecedores DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE oportunidades DISABLE ROW LEVEL SECURITY;'
    ];

    const results = [];
    for (const sql of queries) {
      try {
        const result = await query(sql);
        results.push({ query: sql, success: true });
        console.log(`✅ Executado: ${sql}`);
      } catch (error: any) {
        console.warn(`⚠️ Erro em: ${sql}`, error.message);
        results.push({ query: sql, success: false, error: error.message });
      }
    }

    console.log('✅ Comandos RLS executados');
    return NextResponse.json({
      message: 'Comandos RLS executados',
      results
    });

  } catch (error: any) {
    console.error('Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: error.message },
      { status: 500 }
    );
  }
}