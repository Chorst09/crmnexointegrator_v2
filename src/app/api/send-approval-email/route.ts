import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { userEmail, userName } = await request.json();

    // Buscar todos os administradores para enviar email
    const admins = await prisma.profile.findMany({
      where: { role: 'admin' },
      select: {
        email: true,
        full_name: true
      }
    });

    if (!admins || admins.length === 0) {
      console.log('Nenhum administrador encontrado');
      return NextResponse.json(
        { message: 'Nenhum administrador encontrado para notificar' },
        { status: 200 }
      );
    }

    // Gerar token único para aprovação
    const approvalToken = Buffer.from(`${userEmail}:${Date.now()}`).toString('base64');
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Implementar envio de email usando fetch
    const emailContent = {
      to: ['carlos.horst@doubletelecom.com.br'], // Enviando diretamente para o email corporativo
      subject: 'Nova solicitação de acesso - Simuladores Double TI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>🎯 Sistema Simuladores Double TI</strong><br>
              Nova solicitação de acesso recebida e aguardando sua aprovação.
            </p>
          </div>
          <h2 style="color: #2563eb;">Nova Solicitação de Acesso</h2>
          <p>Um novo usuário solicitou acesso ao sistema:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Nome:</strong> ${userName || 'Não informado'}</p>
            <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          
          <h3 style="color: #2563eb;">Ações Rápidas:</h3>
          <div style="margin: 20px 0;">
            <h4 style="color: #059669; margin-bottom: 10px;">✅ Aprovar como:</h4>
            <div style="margin-bottom: 10px;">
              <a href="${baseUrl}/api/approve-user?token=${approvalToken}&role=admin" 
                 style="background: #dc2626; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 5px 5px 5px 0; font-size: 14px;">
                👑 Administrador
              </a>
              <span style="color: #6b7280; font-size: 12px;">Acesso total ao sistema</span>
            </div>
            <div style="margin-bottom: 10px;">
              <a href="${baseUrl}/api/approve-user?token=${approvalToken}&role=director" 
                 style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 5px 5px 5px 0; font-size: 14px;">
                📊 Diretor
              </a>
              <span style="color: #6b7280; font-size: 12px;">Acesso a relatórios e gestão</span>
            </div>
            <div style="margin-bottom: 10px;">
              <a href="${baseUrl}/api/approve-user?token=${approvalToken}&role=user" 
                 style="background: #059669; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 5px 5px 5px 0; font-size: 14px;">
                👤 Usuário
              </a>
              <span style="color: #6b7280; font-size: 12px;">Acesso básico às calculadoras</span>
            </div>
          </div>
          
          <div style="margin: 20px 0;">
            <h4 style="color: #dc2626; margin-bottom: 10px;">❌ Negar Acesso:</h4>
            <a href="${baseUrl}/api/deny-user?token=${approvalToken}" 
               style="background: #6b7280; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 14px;">
              🚫 Negar Solicitação
            </a>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>⚠️ Importante:</strong> Clique diretamente nos botões acima para aprovar/negar. 
              As ações são processadas automaticamente.
            </p>
          </div>
          
          <p>Ou acesse o painel administrativo para gerenciar usuários:</p>
          <a href="${baseUrl}/admin/users" 
             style="background: #374151; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0;">
            🔧 Painel Administrativo
          </a>
          
          <hr style="margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Este email foi enviado automaticamente pelo sistema Simuladores Double TI.<br>
            Token de aprovação: ${approvalToken.substring(0, 20)}...
          </p>
        </div>
      `
    };

    // Tentar enviar email usando Resend
    let emailSent = false;
    let emailError = null;

    if (process.env.RESEND_API_KEY) {
      try {
        console.log('🔑 Chave Resend encontrada, tentando enviar email...');

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: emailContent.to,
            subject: emailContent.subject,
            html: emailContent.html,
          }),
        });

        const responseText = await resendResponse.text();
        console.log('📧 Resposta do Resend:', { status: resendResponse.status, body: responseText });

        if (resendResponse.ok) {
          emailSent = true;
          console.log('✅ Email enviado via Resend com sucesso!');
        } else {
          emailError = `Resend error (${resendResponse.status}): ${responseText}`;
          console.error('❌ Erro no Resend:', emailError);
        }
      } catch (error: any) {
        emailError = `Resend error: ${error.message}`;
        console.error('❌ Erro de conexão com Resend:', error);
      }
    } else {
      emailError = 'Chave RESEND_API_KEY não encontrada';
      console.error('❌ Chave do Resend não configurada');
    }

    // Log de backup se o email não foi enviado
    if (!emailSent) {
      console.log('🔄 Email não foi enviado via Resend, registrando para notificação manual...');
      console.log('📧 Administradores que deveriam receber o email:', admins.map((admin: any) => admin.email));
    }

    // Log detalhado para debug
    console.log('📧 Detalhes do email de aprovação:', {
      admins: admins.map((admin: any) => ({ email: admin.email, name: admin.full_name })),
      newUser: { email: userEmail, name: userName },
      emailSent,
      emailError,
      resendApiKey: process.env.RESEND_API_KEY ? 'Configurada' : 'Não configurada',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      message: emailSent ? 'Email de aprovação enviado com sucesso' : 'Solicitação registrada - Administradores serão notificados',
      admins: admins.length,
      emailSent,
      emailError: emailError || undefined,
      adminEmails: admins.map((admin: any) => admin.email)
    });

  } catch (error) {
    console.error('Erro ao enviar email de aprovação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}