import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const branding = await prisma.brandingConfig.findFirst({
      where: { is_active: true },
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json(branding || {
      logo_url: '/double-logo.svg',
      logo_width: 200,
      logo_height: 60,
      company_name: 'Double TI + Telecom',
      primary_color: '#5b9bd5',
      secondary_color: '#1e3a5f'
    });
  } catch (error) {
    console.error('Error fetching branding:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branding configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Desativar configurações anteriores
    await prisma.brandingConfig.updateMany({
      where: { is_active: true },
      data: { is_active: false }
    });

    // Criar nova configuração
    const branding = await prisma.brandingConfig.create({
      data: {
        logo_url: body.logo_url,
        logo_width: body.logo_width || 200,
        logo_height: body.logo_height || 60,
        company_name: body.company_name,
        primary_color: body.primary_color,
        secondary_color: body.secondary_color,
        is_active: true
      }
    });

    return NextResponse.json(branding);
  } catch (error) {
    console.error('Error saving branding:', error);
    return NextResponse.json(
      { error: 'Failed to save branding configuration' },
      { status: 500 }
    );
  }
}
