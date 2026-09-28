import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userEmail, userName } = await request.json();

    console.log('📧 Tentando enviar email direto...');
    
    // Usar a chave diretamente (temporário para teste)
    const RESEND_KEY = 're_UGUJ3fpU_4vzyKYfgLVo2G2qNosSLfhrj';
    
    const emailContent = {
      from: 'onboarding@resend.dev',
      to: ['carlos.horst@doubletelecom.com.br'], // Email verificado no Resend
      subject: `Nova solicitação de acesso - ${userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Nova Solicitação de Acesso</h2>
          <p>Um novo usuário solicitou acesso ao sistema:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Nome:</strong> ${userName}</p>
            <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          <p>Para aprovar este usuário, acesse o painel administrativo.</p>
        </div>
      `
    };

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailContent),
    });

    const responseText = await resendResponse.text();
    console.log('📧 Resposta do Resend:', { status: resendResponse.status, body: responseText });

    if (resendResponse.ok) {
      console.log('✅ Email enviado com sucesso!');
      return NextResponse.json({
        success: true,
        message: 'Email enviado com sucesso',
        resendResponse: responseText
      });
    } else {
      console.error('❌ Erro no Resend:', responseText);
      return NextResponse.json({
        success: false,
        error: `Erro ${resendResponse.status}: ${responseText}`
      });
    }

  } catch (error: any) {
    console.error('❌ Erro no envio de email:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}