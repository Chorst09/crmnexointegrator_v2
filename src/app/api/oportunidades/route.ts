import { NextRequest, NextResponse } from 'next/server';
import { crmService } from '@/lib/database';
import { oportunidadeSchema } from '@/lib/validations/gestao-oportunidades';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fase = searchParams.get('fase');
    const cliente_id = searchParams.get('cliente_id');
    const responsavel_id = searchParams.get('responsavel_id');

    const filters: any = {};
    if (fase) filters.fase = fase;
    if (cliente_id) filters.cliente_id = cliente_id;
    if (responsavel_id) filters.responsavel_id = responsavel_id;

    const oportunidades = await crmService.getOportunidades(filters);

    return NextResponse.json({
      success: true,
      data: oportunidades
    });
  } catch (error) {
    console.error('Erro ao buscar oportunidades:', error);
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
    const validatedData = oportunidadeSchema.parse(body);
    
    // Converter valor para número
    const valorNumerico = parseFloat(validatedData.valor_estimado.replace(/[^\d,.-]/g, '').replace(',', '.'));
    
    // Preparar dados para inserção
    const oportunidadeData = {
      numero_oportunidade: validatedData.numero_oportunidade,
      setor: validatedData.setor,
      titulo: validatedData.titulo,
      cliente_id: validatedData.cliente_id,
      valor_estimado: valorNumerico,
      fase: validatedData.fase,
      data_fechamento_prevista: new Date(validatedData.data_fechamento_prevista),
      data_vencimento: new Date(validatedData.data_vencimento),
      responsavel_id: validatedData.responsavel_id,
      probabilidade_fechamento: validatedData.probabilidade_fechamento ? parseInt(validatedData.probabilidade_fechamento) : null,
      descricao: validatedData.descricao || null,
      fornecedores: validatedData.fornecedores
    };
    
    // Criar oportunidade
    const oportunidade = await crmService.createOportunidade(oportunidadeData);

    return NextResponse.json({
      success: true,
      data: oportunidade,
      message: 'Oportunidade criada com sucesso'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar oportunidade:', error);
    
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