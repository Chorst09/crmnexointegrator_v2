import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const profile = await prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        full_name: true,
        role: true,
        email: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: 'Perfil não encontrado'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Erro ao buscar profile:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    console.log('🔄 Atualizando perfil:', { id, body });

    // Validar dados
    if (!body.role || !body.full_name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role e nome completo são obrigatórios'
        },
        { status: 400 }
      );
    }

    // Atualizar profile e user_compat em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // Verificar se o perfil existe
      const existingProfile = await tx.profile.findUnique({
        where: { id }
      });

      if (!existingProfile) {
        throw new Error('Perfil não encontrado');
      }

      console.log('📊 Perfil atual:', existingProfile);

      // Atualizar profile
      const profile = await tx.profile.update({
        where: { id },
        data: {
          role: body.role,
          full_name: body.full_name,
          updated_at: new Date()
        }
      });

      console.log('✅ Profile atualizado:', profile);

      // Atualizar user_compat (tabela users no schema public)
      const userCompat = await tx.userCompat.update({
        where: { id },
        data: {
          role: body.role,
          updated_at: new Date()
        }
      });

      console.log('✅ UserCompat atualizado:', userCompat);

      return profile;
    });

    console.log('✅ Perfil atualizado com sucesso:', result);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar profile:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete user from auth.users (cascade will delete profile and user_compat)
    await prisma.user.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Usuário excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}