import { NextRequest, NextResponse } from 'next/server';
import { commissionService } from '@/lib/database';

export async function GET() {
  try {
    // Buscar todas as tabelas de comissão usando Prisma
    const [
      channelSeller,
      channelDirector,
      seller,
      channelInfluencer,
      channelIndicator
    ] = await Promise.all([
      commissionService.getChannelSeller(),
      commissionService.getChannelDirector(),
      commissionService.getSeller(),
      commissionService.getChannelInfluencer(),
      commissionService.getChannelIndicator()
    ]);

    return NextResponse.json({
      channelSeller,
      channelDirector,
      seller,
      channelInfluencer,
      channelIndicator
    });
  } catch (error) {
    console.error('Erro ao buscar comissões:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, data } = body;

    if (!table || !data) {
      return NextResponse.json(
        { error: 'Tabela e dados são obrigatórios' },
        { status: 400 }
      );
    }

    // Atualizar usando Prisma
    const result = await commissionService.updateCommissionTable(table, data.id, data);

    return NextResponse.json({ 
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}