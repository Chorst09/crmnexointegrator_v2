import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, newPassword } = body;

    console.log('🔐 Alterando senha do usuário:', userId);

    if (!userId || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar tamanho mínimo da nova senha
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      );
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await prisma.user.update({
      where: { id: userId },
      data: {
        encrypted_password: hashedPassword,
        password_changed: new Date(),
        updated_at: new Date()
      }
    });

    console.log('✅ Senha alterada com sucesso para usuário:', userId);

    return NextResponse.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao alterar senha:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao alterar senha'
      },
      { status: 500 }
    );
  }
}
