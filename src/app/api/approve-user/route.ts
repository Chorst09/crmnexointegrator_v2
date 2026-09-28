import { NextRequest, NextResponse } from 'next/server';
// import { query } from '@/lib/database'; // Unused import
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const role = searchParams.get('role');

    if (!token || !role) {
      return NextResponse.json({ error: 'Token e role são obrigatórios' }, { status: 400 });
    }

    // Decodificar token para obter email e timestamp
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userEmail, timestamp] = decoded.split(':');

    if (!userEmail || !timestamp) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }

    // Verificar se o token não expirou (24 horas)
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas em ms

    if (tokenAge > maxAge) {
      return NextResponse.json({ error: 'Token expirado' }, { status: 400 });
    }

    // Validar role
    const validRoles = ['admin', 'director', 'user'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Role inválido' }, { status: 400 });
    }

    console.log('🔧 Aprovando usuário via PostgreSQL local');

    console.log('🔍 Buscando usuário:', userEmail);

    // Buscar o usuário pelo email usando Prisma
    const user = await prisma.profile.findFirst({
      where: { email: userEmail }
    });

    const userError = !user ? new Error('Usuário não encontrado') : null;

    console.log('📊 Resultado da busca:', { user, userError });

    if (userError || !user) {
      console.log('❌ Usuário não encontrado:', userError?.message);
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário ainda está pendente
    if (user.role !== 'pending') {
      return NextResponse.json({ error: 'Usuário já foi processado' }, { status: 400 });
    }

    // Atualizar o role do usuário usando Prisma
    const updatedUser = await prisma.profile.update({
      where: { id: user.id },
      data: {
        role: role,
        updated_at: new Date()
      }
    });

    console.log('✅ Usuário aprovado:', updatedUser.email);

    // Enviar email de confirmação para o usuário
    try {
      const confirmationResponse = await fetch(`${request.nextUrl.origin}/api/send-user-approval-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: userEmail,
          userName: user.full_name || userEmail,
          role: role
        }),
      });

      if (!confirmationResponse.ok) {
        console.error('Erro ao enviar email de confirmação');
      }
    } catch (emailError) {
      console.error('Erro ao enviar email de confirmação:', emailError);
    }

    // Retornar página de sucesso
    const successHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Usuário Aprovado - Simuladores Double TI</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f9fafb; }
          .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .success { color: #059669; text-align: center; }
          .info { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">
            <h1>✅ Usuário Aprovado com Sucesso!</h1>
          </div>
          <div class="info">
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Nome:</strong> ${user.full_name || 'Não informado'}</p>
            <p><strong>Role Atribuído:</strong> ${role}</p>
            <p><strong>Data de Aprovação:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          <p>O usuário foi aprovado e receberá um email de confirmação com as instruções de acesso.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${request.nextUrl.origin}/admin/users" class="button">🔧 Gerenciar Outros Usuários</a>
          </div>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(successHtml, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error('Erro ao aprovar usuário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}