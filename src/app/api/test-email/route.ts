import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testando envio de email direto...');
    
    // Verificar se a chave existe
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        error: 'RESEND_API_KEY não configurada',
        success: false
      });
    }

    console.log('🔑 Chave Resend encontrada:', process.env.RESEND_API_KEY.substring(0, 10) + '...');

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ['carlos.horst@doubletelecom.com.br'],
        subject: 'Teste de Email - Simuladores Double TI',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Teste de Email</h2>
            <p>Este é um teste do sistema de emails.</p>
            <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            <p><strong>Status:</strong> Sistema funcionando corretamente!</p>
            <hr>
            <p style="color: #6b7280; font-size: 12px;">
              Por favor, encaminhe este email para carlos.horst@doubletelecom.com.br
            </p>
          </div>
        `
      }),
    });

    const responseText = await resendResponse.text();
    
    console.log('📧 Resposta do Resend:', {
      status: resendResponse.status,
      statusText: resendResponse.statusText,
      body: responseText
    });

    if (resendResponse.ok) {
      return NextResponse.json({
        success: true,
        message: 'Email enviado com sucesso!',
        resendResponse: responseText
      });
    } else {
      return NextResponse.json({
        success: false,
        error: `Erro ${resendResponse.status}: ${responseText}`,
        status: resendResponse.status
      });
    }

  } catch (error: any) {
    console.error('❌ Erro no teste de email:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST para testar o envio de email',
    resendConfigured: !!process.env.RESEND_API_KEY
  });
}