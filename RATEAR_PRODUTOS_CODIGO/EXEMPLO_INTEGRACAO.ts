/**
 * EXEMPLO DE INTEGRAÇÃO - RATEAR PRODUTOS
 * =========================================
 * Demonstra como usar o módulo em diferentes cenários
 */

// ============================================================================
// EXEMPLO 1: USO BÁSICO EM COMPONENTE REACT
// ============================================================================

import React from 'react'
import RateioPrecificacaoV2 from '@/components/rateio-precificacao-v2'

export function MinhaPageRatearProdutos() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-4">Ratear Produtos</h1>
      <RateioPrecificacaoV2 />
    </div>
  )
}

// ============================================================================
// EXEMPLO 2: EXTRAÇÃO DO MOTOR DE CÁLCULO
// ============================================================================

// Extrair apenas a função calcRateio() do arquivo rateio-precificacao-v2.tsx
// e usá-la diretamente:

type RateioMode = 'custo' | 'venda' | 'qty' | 'peso'

interface RateioItem {
  sku: string
  desc: string
  ncm: string
  custo: number
  preco: number
  qty: number
  un: string
}

interface Expense {
  tipo: string
  desc: string
  valor: number
  metodo: RateioMode
  pagador: string
  conta: string
}

interface ResultItem {
  prod: RateioItem
  rat: number
  expenseRat: number
  ratUnit: number
  novoCusto: number
  mgAnt: number
  mgNova: number
}

interface RateioResult {
  results: ResultItem[]
  avgMgAnt: number
  avgMgNova: number
  totalExp: number
  ok: boolean
}

const D = (value: number, decimals = 4) =>
  Number((Number(value) || 0).toFixed(decimals))

function calcRateioSimples(
  items: RateioItem[],
  expenses: Expense[],
  method: RateioMode = 'custo'
): RateioResult {
  // Implementação simplificada do cálculo
  const results = items.map(item => ({
    prod: item,
    rat: 0,
    expenseRat: 0,
    ratUnit: 0,
    novoCusto: item.custo,
    mgAnt: (item.preco - item.custo) / item.preco,
    mgNova: (item.preco - item.custo) / item.preco,
  }))

  return {
    results,
    avgMgAnt: 0,
    avgMgNova: 0,
    totalExp: expenses.reduce((s, e) => s + e.valor, 0),
    ok: true,
  }
}

// ============================================================================
// EXEMPLO 3: USAR EM HOOK CUSTOMIZADO
// ============================================================================

export function useRatearProdutos() {
  const [items, setItems] = React.useState<RateioItem[]>([])
  const [expenses, setExpenses] = React.useState<Expense[]>([])
  const [resultado, setResultado] = React.useState<RateioResult | null>(null)

  const executarRateio = (metodo: RateioMode = 'custo') => {
    const res = calcRateioSimples(items, expenses, metodo)
    setResultado(res)
    return res
  }

  const adicionarItem = (item: RateioItem) => {
    setItems(prev => [...prev, item])
  }

  const adicionarDespesa = (expense: Expense) => {
    setExpenses(prev => [...prev, expense])
  }

  const limpar = () => {
    setItems([])
    setExpenses([])
    setResultado(null)
  }

  return {
    items,
    expenses,
    resultado,
    executarRateio,
    adicionarItem,
    adicionarDespesa,
    limpar,
  }
}

// ============================================================================
// EXEMPLO 4: COMPONENTE CUSTOMIZADO
// ============================================================================

export function MeuComponenteRatear() {
  const { items, expenses, resultado, executarRateio, adicionarItem, adicionarDespesa } =
    useRatearProdutos()

  return (
    <div className="space-y-6">
      {/* Seção de Itens */}
      <div className="border rounded-lg p-4">
        <h2 className="text-xl font-bold mb-4">Produtos</h2>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <span>{item.sku}</span>
            <span>{item.desc}</span>
            <span>R$ {item.custo}</span>
            <span>R$ {item.preco}</span>
            <span>{item.qty} un</span>
          </div>
        ))}
      </div>

      {/* Seção de Despesas */}
      <div className="border rounded-lg p-4">
        <h2 className="text-xl font-bold mb-4">Despesas</h2>
        {expenses.map((exp, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 mb-2">
            <span>{exp.tipo}</span>
            <span>R$ {exp.valor}</span>
            <span>{exp.metodo}</span>
          </div>
        ))}
      </div>

      {/* Botões */}
      <div className="flex gap-2">
        <button
          onClick={() => executarRateio('custo')}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Ratear (Por Custo)
        </button>
        <button
          onClick={() => executarRateio('venda')}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Ratear (Por Venda)
        </button>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="border rounded-lg p-4 bg-green-50">
          <h2 className="text-xl font-bold mb-4">Resultado</h2>
          <p>Margem Antes: {(resultado.avgMgAnt * 100).toFixed(2)}%</p>
          <p>Margem Depois: {(resultado.avgMgNova * 100).toFixed(2)}%</p>
          <p>Total Despesas: R$ {resultado.totalExp.toFixed(2)}</p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXEMPLO 5: INTEGRAÇÃO COM API/BACKEND
// ============================================================================

export async function salvarRateioNoServidor(
  rateio: {
    nome: string
    items: RateioItem[]
    expenses: Expense[]
    resultado: RateioResult
  }
) {
  const response = await fetch('/api/rateios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rateio),
  })

  if (!response.ok) {
    throw new Error('Erro ao salvar rateio')
  }

  return response.json()
}

export async function carregarRateioDosServidor(id: string) {
  const response = await fetch(`/api/rateios/${id}`)

  if (!response.ok) {
    throw new Error('Erro ao carregar rateio')
  }

  return response.json()
}

// ============================================================================
// EXEMPLO 6: DADOS DE TESTE
// ============================================================================

export const DADOS_TESTE = {
  items: [
    {
      sku: 'NB-001',
      desc: 'Notebook Dell Latitude i7 16GB',
      ncm: '8471.30.12',
      custo: 3200,
      preco: 4800,
      qty: 3,
      un: 'UN',
    },
    {
      sku: 'MON-002',
      desc: 'Monitor LG UltraWide 34"',
      ncm: '8528.52.20',
      custo: 850,
      preco: 1350,
      qty: 8,
      un: 'UN',
    },
    {
      sku: 'KB-003',
      desc: 'Teclado Mecânico Corsair K70',
      ncm: '8471.60.52',
      custo: 320,
      preco: 580,
      qty: 15,
      un: 'UN',
    },
  ] as RateioItem[],

  expenses: [
    {
      tipo: 'Frete',
      desc: 'CIF - Transportadora Rápida',
      valor: 500,
      metodo: 'custo' as const,
      pagador: 'Próprio',
      conta: '3.1.01.01',
    },
    {
      tipo: 'Seguro',
      desc: 'Seguro de carga NF #004521',
      valor: 120,
      metodo: 'venda' as const,
      pagador: 'Próprio',
      conta: '3.1.01.02',
    },
  ] as Expense[],
}

// ============================================================================
// EXEMPLO 7: EXPORTAR PARA CSV
// ============================================================================

export function exportarCSV(resultado: RateioResult) {
  const headers = [
    'SKU',
    'Descrição',
    'Qtd',
    'Custo Original',
    'Rateio Unitário',
    'Novo Custo',
    'Margem Antes %',
    'Margem Depois %',
  ]

  const rows = resultado.results.map(item => [
    item.prod.sku,
    item.prod.desc,
    String(item.prod.qty),
    item.prod.custo.toFixed(2),
    item.ratUnit.toFixed(2),
    item.novoCusto.toFixed(2),
    (item.mgAnt * 100).toFixed(2),
    (item.mgNova * 100).toFixed(2),
  ])

  const csv = [headers, ...rows].map(row => row.join(';')).join('\n')

  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  link.download = `rateio_${Date.now()}.csv`
  link.click()
}

// ============================================================================
// EXEMPLO 8: VALIDAÇÃO DE DADOS
// ============================================================================

export function validarRateia(items: RateioItem[], expenses: Expense[]): string[] {
  const erros: string[] = []

  if (items.length === 0) erros.push('Adicione pelo menos um produto')

  items.forEach(item => {
    if (!item.sku) erros.push(`Produto sem SKU`)
    if (item.custo < 0) erros.push(`${item.sku}: Custo não pode ser negativo`)
    if (item.preco <= 0) erros.push(`${item.sku}: Preço deve ser maior que zero`)
    if (item.qty <= 0) erros.push(`${item.sku}: Quantidade deve ser maior que zero`)
  })

  if (expenses.length === 0) erros.push('Adicione pelo menos uma despesa')

  expenses.forEach(exp => {
    if (!exp.tipo) erros.push('Despesa sem tipo')
    if (exp.valor <= 0) erros.push(`${exp.tipo}: Valor deve ser maior que zero`)
  })

  return erros
}

// ============================================================================
// EXEMPLO 9: USAR NO SIDEBAR (Navegação)
// ============================================================================

export const MENU_RATEAR = {
  title: 'Ratear Produtos',
  url: '/pricing/ratear-produtos',
  icon: 'Calculator',
  area: 'pricing',
  children: [
    {
      title: 'Novo Rateio',
      url: '/pricing/ratear-produtos',
    },
    {
      title: 'Rateios Salvos',
      url: '/pricing/rateios-salvos',
    },
  ],
}

// ============================================================================
// EXEMPLO 10: INTEGRAÇÃO RÁPIDA EM PAGE.TSX
// ============================================================================

/*
// src/app/pricing/ratear-produtos/page.tsx

'use client'

import RateioPrecificacaoV2 from '@/components/rateio-precificacao-v2'

export default function RatearProdutosPage() {
  return (
    <div className="min-h-screen bg-background">
      <RateioPrecificacaoV2 />
    </div>
  )
}
*/

// ============================================================================
// FIM DOS EXEMPLOS
// ============================================================================

export default {
  calcRateioSimples,
  useRatearProdutos,
  MeuComponenteRatear,
  salvarRateioNoServidor,
  carregarRateioDosServidor,
  DADOS_TESTE,
  exportarCSV,
  validarRateia,
  MENU_RATEAR,
}
