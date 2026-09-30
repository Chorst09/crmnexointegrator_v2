import { NextRequest, NextResponse } from 'next/server';
import { crmService } from '@/lib/database';
import { clienteSchema } from '@/lib/validations/gestao-oportunidades';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const clientes = await crmService.getClientes(status || undefined);

    return NextResponse.json({
      success: true,
      data: clientes
    });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar dados
    const validatedData = clienteSchema.parse(body);
    
    // Criar cliente
    const cliente = await crmService.createCliente(validatedData);

    return NextResponse.json({
      success: true,
      data: cliente,
      message: 'Cliente criado com sucesso'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar cliente:', error);
    
    if (error.errors) {
      // Erros de validação do Zod
      return NextResponse.json(
        { 
          success: false, 
          error: 'Dados inválidos',
          details: error.errors
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}