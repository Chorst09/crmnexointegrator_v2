import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Tentar obter token do cookie primeiro
    const tokenFromCookie = request.cookies.get('auth-token')?.value
    
    let token = tokenFromCookie
    
    // Se não houver cookie, tentar header Authorization
    if (!token) {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticação não encontrado' },
        { status: 401 }
      )
    }

    const user = await getCurrentUser(token)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { user }
    })
  } catch (error) {
    console.error('Me API error:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}