import { NextRequest, NextResponse } from 'next/server'
import { signIn, generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await signIn(email, password)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      )
    }

    if (!result.user) {
      return NextResponse.json(
        { success: false, error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    // Gerar token JWT
    const token = generateToken(result.user)

    const response = NextResponse.json({
      success: true,
      data: {
        user: result.user,
        session: { access_token: token }
      }
    })

    // Definir cookie com o token
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: false, // Permitir HTTP em produção
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}