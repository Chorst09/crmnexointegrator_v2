import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';

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
    const { userId, newPassword } = body;

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'userId e newPassword são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar força da senha
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar senha e marcar como não alterada (forçar troca no próximo login)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        encrypted_password: hashedPassword,
        password_changed: null // Força o usuário a trocar a senha no próximo login
      },
      include: {
        profile: true
      }
    });

    console.log('✅ Senha resetada para:', updatedUser.email);

    return NextResponse.json({
      success: true,
      message: 'Senha resetada com sucesso. O usuário deverá trocar a senha no próximo login.',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        full_name: updatedUser.profile?.full_name
      }
    });
  } catch (error) {
    console.error('❌ Erro ao resetar senha:', error);
    return NextResponse.json(
      { error: 'Erro ao resetar senha' },
      { status: 500 }
    );
  }
}
