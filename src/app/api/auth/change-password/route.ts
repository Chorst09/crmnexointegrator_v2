import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPassword, newPassword, isFirstLogin, userId, email } = body;

    let user: any = null;

    // Se veio userId ou email (modo token do email), buscar usuário diretamente
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, encrypted_password: true }
      });
    } else if (email) {
      user = await prisma.user.findUnique({
        where: { email: email },
        select: { id: true, email: true, encrypted_password: true }
      });
    } else {
      // Modo autenticado: verificar token
      const token = request.cookies.get('auth-token')?.value;
      const currentUser = await getCurrentUser(token);

      if (!currentUser) {
        return NextResponse.json(
          { success: false, error: 'Usuário não autenticado' },
          { status: 401 }
        );
      }

      user = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { id: true, email: true, encrypted_password: true }
      });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Se não é primeiro login e não veio do email, verificar senha atual
    if (!isFirstLogin && !email && currentPassword) {
      if (!user.encrypted_password) {
        return NextResponse.json(
          { success: false, error: 'Senha atual não encontrada' },
          { status: 400 }
        );
      }

      const isValidPassword = await verifyPassword(currentPassword, user.encrypted_password);
      if (!isValidPassword) {
        return NextResponse.json(
          { success: false, error: 'Senha atual incorreta' },
          { status: 400 }
        );
      }
    }

    // Hash da nova senha
    const hashedPassword = await hashPassword(newPassword);

    // Atualizar senha no banco
    await prisma.user.update({
      where: { id: user.id },
      data: {
        encrypted_password: hashedPassword,
        password_changed: new Date()
      }
    });

    // Atualizar perfil
    await prisma.profile.update({
      where: { id: user.id },
      data: {
        updated_at: new Date()
      }
    }).catch(() => {
      // Ignorar erro se perfil não existir
    });

    return NextResponse.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}