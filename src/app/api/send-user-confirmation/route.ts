import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userEmail, userName } = await request.json();

    if (!userEmail) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY não configurada');
      return NextResponse.json({ error: 'Configuração de email não disponível' }, { status: 500 });
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    const emailContent = {
      to: [userEmail],
      subject: 'Cadastro realizado com sucesso - Aguardando aprovação',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dcfce7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #059669;">
            <p style="margin: 0; color: #065f46; font-size: 14px;">
              <strong>✅ Sistema Simuladores Double TI</strong><br>
              Seu cadastro foi realizado com sucesso!
            </p>
          </div>
          
          <h2 style="color: #059669;">🎉 Cadastro Realizado com Sucesso!</h2>
          
          <p>Olá <strong>${userName || userEmail}</strong>,</p>
          
          <p>Seu cadastro foi efetuado com sucesso no Sistema Simuladores Double TI!</p>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f59e0b;">
            <h3 style="color: #92400e; margin-top: 0;">⏳ Status Atual: Aguardando Aprovação</h3>
            <p style="margin: 0; color: #92400e;">
              Nosso administrador foi notificado sobre seu cadastro e definirá seu nível de acesso em breve.
              Você receberá um email quando sua conta for aprovada.
            </p>
          </div>
          
          <h3 style="color: #2563eb;">📋 Dados do seu Cadastro:</h3>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Nome:</strong> ${userName || 'Não informado'}</p>
            <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            <p><strong>Status:</strong> Pendente de aprovação</p>
          </div>
          
          <h3 style="color: #2563eb;">🔄 Próximos Passos:</h3>
          <ol>
            <li>Aguarde a aprovação do administrador</li>
            <li>Você receberá um email quando for aprovado</li>
            <li>Após aprovação, poderá fazer login no sistema</li>
          </ol>
          
          <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>💡 Importante:</strong> Mantenha este email para referência. 
              O processo de aprovação pode levar algumas horas.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}" 
               style="background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 14px;">
              🌐 Visitar Site
            </a>
          </div>
          
          <hr style="margin: 30px 0;">
          <p style="color: #6b7280; font-size: 12px; text-align: center;">
            Este email foi enviado automaticamente pelo Sistema Simuladores Double TI.<br>
            Não responda a este email.
          </p>
        </div>
      `
    };

    // Enviar email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: emailContent.to,
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('Email de confirmação enviado com sucesso:', result);
      return NextResponse.json({ 
        success: true, 
        message: 'Email de confirmação enviado com sucesso',
        emailId: result.id 
      });
    } else {
      console.error('Erro ao enviar email de confirmação:', result);
      return NextResponse.json({ 
        error: 'Erro ao enviar email de confirmação',
        details: result 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Erro ao processar envio de email de confirmação:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}