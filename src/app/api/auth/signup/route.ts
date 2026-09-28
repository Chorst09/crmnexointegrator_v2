import { NextRequest, NextResponse } from 'next/server'
import { signUp, generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, full_name, role = 'user' } = body

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { success: false, error: 'Email, senha e nome completo são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Formato de email inválido' },
        { status: 400 }
      )
    }

    // Validar força da senha
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }

    const result = await signUp(email, password, full_name, role)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    if (!result.user) {
      return NextResponse.json(
        { success: false, error: 'Erro ao criar usuário' },
        { status: 500 }
      )
    }

    // Não fazer login automático - usuário precisa aguardar aprovação
    return NextResponse.json({
      success: true,
      message: 'Cadastro realizado com sucesso! Aguarde a aprovação do administrador para fazer login.',
      data: {
        user: {
          email: result.user.email,
          full_name: result.user.full_name
        }
      }
    })
  } catch (error) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}