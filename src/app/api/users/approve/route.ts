import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verificar se o usuário está autenticado e é admin
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = await getCurrentUser(token);

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, action } = body; // action: 'approve' ou 'reject'

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'userId e action são obrigatórios' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action deve ser "approve" ou "reject"' },
        { status: 400 }
      );
    }

    // Buscar o usuário atual para verificar o role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar status da conta e role se necessário
    const updateData: any = {
      account_status: action === 'approve' ? 'approved' : 'rejected'
    };

    // Se estiver aprovando e o role for 'pending', mudar para 'user'
    if (action === 'approve' && user.profile?.role === 'pending') {
      // Atualizar o role no profile
      await prisma.profile.update({
        where: { id: userId },
        data: { role: 'user' }
      });
    }

    // Se estiver rejeitando, manter como 'pending' ou mudar para 'rejected'
    if (action === 'reject' && user.profile?.role === 'pending') {
      await prisma.profile.update({
        where: { id: userId },
        data: { role: 'pending' } // Manter como pending para poder aprovar depois
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        profile: true
      }
    });

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'Usuário aprovado com sucesso' : 'Usuário rejeitado',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        full_name: updatedUser.profile?.full_name,
        account_status: updatedUser.account_status
      }
    });
  } catch (error) {
    console.error('Erro ao aprovar/rejeitar usuário:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
