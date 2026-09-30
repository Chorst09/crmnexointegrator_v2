import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userEmail, userName } = await request.json();

    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Log estruturado
    console.log('🚨🚨🚨 NOVA SOLICITAÇÃO DE ACESSO 🚨🚨🚨');
    console.log('='.repeat(50));
    console.log(`📧 EMAIL: ${userEmail}`);
    console.log(`👤 NOME: ${userName || 'Não informado'}`);
    console.log(`⏰ DATA: ${new Date().toLocaleString('pt-BR')}`);
    console.log(`🔗 AÇÃO: ${appUrl}/?admin=user-management`);
    console.log('='.repeat(50));
    console.log('🚨🚨🚨 APROVAÇÃO NECESSÁRIA 🚨🚨🚨');

    // Também criar um alerta visual nos logs
    const alertMessage = `
    ╔════════════════════════════════════════════════════════════════╗
    ║                    🚨 NOVA SOLICITAÇÃO DE ACESSO 🚨            ║
    ║                                                                ║
    ║  Email: ${userEmail.padEnd(45)} ║
    ║  Nome:  ${(userName || 'Não informado').padEnd(45)} ║
    ║  Data:  ${new Date().toLocaleString('pt-BR').padEnd(45)} ║
    ║                                                                ║
    ║  👉 ACESSE: ${appUrl.padEnd(45)} ║
    ║     Vá em Administração > Gerenciar Usuários                  ║
    ║                                                                ║
    ╚════════════════════════════════════════════════════════════════╝
    `;
    
    console.log(alertMessage);

    return NextResponse.json({
      success: true,
      message: 'Notificação registrada nos logs do servidor',
      instructions: 'Verifique os logs do servidor para ver a notificação'
    });

  } catch (error) {
    console.error('❌ Erro na notificação:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}