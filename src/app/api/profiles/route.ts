import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const limit = searchParams.get('limit');

    const where: any = {};
    if (role) where.role = role;

    const profiles = await prisma.profile.findMany({
      where,
      select: {
        id: true,
        full_name: true,
        role: true,
        email: true,
        created_at: true,
        updated_at: true
      },
      orderBy: {
        full_name: 'asc'
      },
      ...(limit && { take: parseInt(limit) })
    });

    return NextResponse.json({
      success: true,
      data: profiles
    });
  } catch (error) {
    console.error('Erro ao buscar profiles:', error);
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
    
    const profile = await prisma.profile.upsert({
      where: { id: body.id },
      update: {
        full_name: body.full_name,
        role: body.role,
        updated_at: new Date()
      },
      create: {
        id: body.id,
        full_name: body.full_name,
        email: body.email,
        role: body.role
      }
    });

    return NextResponse.json({
      success: true,
      data: profile
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar/atualizar profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}