import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userEmail, userName, role, resetLink, temporaryPassword } = await request.json();

    console.log('📧 Enviando email de boas-vindas para:', userEmail);

    // Mapear role para nome amigável
    const roleNames: Record<string, string> = {
      'admin': 'Administrador',
      'director': 'Diretor',
      'user': 'Usuário',
      'seller': 'Vendedor',
      'gerente': 'Gerente'
    };

    const roleName = roleNames[role] || role;

    const emailContent = {
      to: [userEmail],
      subject: 'Bem-vindo ao Simulador Double TI - Configure sua senha',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1e40af; margin: 0; font-size: 28px;">🎉 Bem-vindo ao Simulador Double TI!</h1>
            </div>

            <!-- Greeting -->
            <div style="margin-bottom: 25px;">
              <p style="font-size: 16px; color: #374151; margin: 0 0 10px 0;">
                Olá <strong>${userName}</strong>,
              </p>
              <p style="font-size: 16px; color: #374151; margin: 0;">
                Sua conta foi criada com sucesso no <strong>Simulador Double TI</strong>!
              </p>
            </div>

            <!-- Account Info -->
            <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; border-radius: 4px; margin-bottom: 25px;">
              <h3 style="color: #1e40af; margin-top: 0; font-size: 18px;">📋 Informações da Conta</h3>
              <p style="margin: 8px 0; color: #374151;"><strong>Email:</strong> ${userEmail}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Perfil:</strong> ${roleName}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Senha Temporária:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 3px;">${temporaryPassword}</code></p>
            </div>

            <!-- Important Notice -->
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 4px; margin-bottom: 25px;">
              <h3 style="color: #92400e; margin-top: 0; font-size: 18px;">⚠️ Importante: Configure sua Senha</h3>
              <p style="margin: 8px 0; color: #78350f;">
                Por segurança, você deve <strong>alterar sua senha</strong> no primeiro acesso.
              </p>
              <p style="margin: 8px 0; color: #78350f;">
                Use a senha temporária acima para fazer login e você será direcionado para criar uma nova senha.
              </p>
            </div>

            <!-- Access Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                🔐 Acessar e Configurar Senha
              </a>
            </div>

            <!-- Alternative Link -->
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                Se o botão não funcionar, copie e cole este link no seu navegador:
              </p>
              <p style="margin: 10px 0 0 0; word-break: break-all;">
                <a href="${resetLink}" style="color: #2563eb; font-size: 13px;">${resetLink}</a>
              </p>
            </div>

            <!-- Instructions -->
            <div style="margin-bottom: 25px;">
              <h3 style="color: #374151; font-size: 18px; margin-bottom: 15px;">📝 Como Acessar:</h3>
              <ol style="color: #6b7280; line-height: 1.8; padding-left: 20px;">
                <li>Clique no botão acima ou acesse o link</li>
                <li>Faça login com seu email e a senha temporária</li>
                <li>Você será direcionado para criar uma nova senha segura</li>
                <li>Após configurar sua senha, você terá acesso completo ao sistema</li>
              </ol>
            </div>

            <!-- Security Notice -->
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
              <p style="margin: 0; font-size: 14px; color: #991b1b;">
                <strong>🔒 Segurança:</strong> Este link é válido por 24 horas. Não compartilhe sua senha com ninguém.
              </p>
            </div>

            <!-- Support -->
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <p style="font-size: 14px; color: #6b7280; margin: 0;">
                Precisa de ajuda? Entre em contato com o administrador do sistema.
              </p>
              <p style="font-size: 14px; color: #6b7280; margin: 10px 0 0 0;">
                <strong>Simulador Double TI</strong><br>
                Sistema de Simulação e Propostas Comerciais
              </p>
            </div>

          </div>
        </div>
      `
    };

    // Tentar enviar via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (resendApiKey && resendApiKey !== 're_123456789') {
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Simulador Double TI <noreply@simuladores.doubleti.com.br>',
            to: emailContent.to,
            subject: emailContent.subject,
            html: emailContent.html,
          }),
        });

        if (resendResponse.ok) {
          console.log('✅ Email enviado via Resend');
          return NextResponse.json({ success: true, message: 'Email enviado com sucesso' });
        } else {
          const errorData = await resendResponse.json();
          console.error('❌ Erro ao enviar via Resend:', errorData);
        }
      } catch (resendError) {
        console.error('❌ Erro ao enviar via Resend:', resendError);
      }
    }

    // Log do email (fallback quando Resend não está configurado)
    console.log('📧 Email de boas-vindas (modo desenvolvimento):', {
      to: emailContent.to,
      subject: emailContent.subject,
      resetLink: resetLink
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Email registrado (modo desenvolvimento)',
      resetLink: resetLink 
    });

  } catch (error) {
    console.error('❌ Erro ao processar envio de email:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao enviar email' },
      { status: 500 }
    );
  }
}
