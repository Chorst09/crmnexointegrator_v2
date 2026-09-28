import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    // Validações básicas
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Verificar se já existe algum administrador
    const existingAdmin = await prisma.profile.findFirst({
      where: { role: 'admin' }
    });

    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: 'Já existe um administrador no sistema' },
        { status: 400 }
      );
    }

    // Verificar se o email já está em uso
    const existingUser = await prisma.profile.findFirst({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Este email já está em uso' },
        { status: 400 }
      );
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar o usuário primeiro na tabela User
    const userId = crypto.randomUUID();

    await prisma.user.create({
      data: {
        id: userId,
        email: email.toLowerCase().trim(),
        encrypted_password: hashedPassword,
        email_confirmed_at: new Date(),
        role: 'admin',
      }
    });

    // Criar o perfil associado
    const admin = await prisma.profile.create({
      data: {
        id: userId,
        email: email.toLowerCase().trim(),
        full_name: name || email,
        role: 'admin',
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        created_at: true,
      }
    });

    console.log('✅ Primeiro administrador criado:', admin.email);

    return NextResponse.json({
      success: true,
      message: 'Primeiro administrador criado com sucesso',
      data: admin
    });

  } catch (error: unknown) {
    console.error('❌ Erro ao criar primeiro administrador:', error);

    let errorMessage = 'Erro interno do servidor';

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      errorMessage = 'Este email já está em uso';
    } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
