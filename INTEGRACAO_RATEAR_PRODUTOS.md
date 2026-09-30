# 📦 Integração - Módulo Ratear Produtos & Rateios Salvos
**Data:** 18/06/2026  
**Versão:** 2.0  
**Status:** ✅ Pronto para Integração

---

## 📋 Conteúdo do Pacote

Este pacote contém o código **standalone** do módulo de Rateio de Despesas pronto para ser instalado em outro sistema:

### Arquivos Principais

1. **RATEAR-PRODUTOS-STANDALONE.ts**
   - Motor de cálculo de rateio
   - Persistência (localStorage)
   - Exportação (JSON/CSV/PDF)
   - Auditoria

2. **Componentes React** (se precisar da UI)
   - `src/components/rateio-precificacao-v2.tsx` - Interface completa
   - `src/app/pricing/ratear-produtos/page.tsx` - Página de roteamento
   - `src/app/pricing/rateios-salvos/page.tsx` - Página de histórico

---

## 🚀 Como Usar

### Opção 1: Usar Apenas o Motor (Integração Simples)

```typescript
import {
  calcRateio,
  RateioStorage,
  RateioExporter,
  RateioItem,
  Expense,
  RateioResult
} from './RATEAR-PRODUTOS-STANDALONE'

// 1. Preparar dados
const items: RateioItem[] = [
  {
    sku: 'PROD-001',
    desc: 'Notebook',
    ncm: '8471.30.12',
    custo: 3200,
    preco: 4800,
    qty: 3,
    un: 'UN'
  }
]

const expenses: Expense[] = [
  {
    tipo: 'Frete',
    desc: 'CIF',
    valor: 500,
    metodo: 'custo',
    pagador: 'Proprio',
    conta: '3.1.01.01'
  }
]

// 2. Executar rateio
const result: RateioResult = calcRateio(items, expenses, {}, items)

// 3. Validar
console.log('Rateio OK?', result.ok)
console.log('Margem Antes:', result.avgMgAnt)
console.log('Margem Depois:', result.avgMgNova)

// 4. Usar resultados
result.results.forEach(item => {
  console.log(`${item.prod.sku}: Novo custo = R$ ${item.novoCusto}`)
})
```

### Opção 2: Usar com Persistência

```typescript
import { RateioStorage, SavedRateio } from './RATEAR-PRODUTOS-STANDALONE'

const rateio: SavedRateio = {
  id: Date.now(),
  nome: 'Rateio NF 001',
  data: new Date().toLocaleString('pt-BR'),
  snapshot: {
    items,
    expenses,
    rateioMode: 'custo',
    nf: { numero: '001', emitente: 'Tech Dist' }
  },
  resultado: result,
  resumo: {
    totalItens: items.length,
    totalDespesas: 500,
    totalCusto: 9600,
    totalVenda: 14400,
    margem: 0.3333
  }
}

// Salvar
const updated = RateioStorage.addRateio(rateio)

// Carregar
const loaded = RateioStorage.load()
const specific = RateioStorage.getRateio(rateio.id)

// Deletar
RateioStorage.deleteRateio(rateio.id)
```

### Opção 3: Exportar Dados

```typescript
import { RateioExporter } from './RATEAR-PRODUTOS-STANDALONE'

// JSON
const json = RateioExporter.toJSON(rateio, {
  usuario: 'João Silva',
  empresa: 'Tech SA'
})
RateioExporter.download('rateio.json', json, 'application/json')

// CSV
const csv = RateioExporter.toCSV(result)
RateioExporter.download('rateio.csv', csv, 'text/csv;charset=utf-8;')

// PDF (abre em nova janela para impressão)
const html = RateioExporter.toPDF(rateio, result)
const win = window.open('', '_blank')
if (win) {
  win.document.write(html)
  win.document.close()
}
```

---

## 🔧 Métodos de Rateio

O módulo suporta **4 métodos** diferentes:

### 1. Por Custo (CUSTO)
Distribui a despesa proporcionalmente ao custo total de cada item.

```typescript
{ metodo: 'custo' }
```

**Fórmula:** `Despesa × (Custo Item × Qty) / Total Custos`

### 2. Por Venda (VENDA)
Distribui a despesa proporcionalmente ao preço de venda de cada item.

```typescript
{ metodo: 'venda' }
```

**Fórmula:** `Despesa × (Preço Item × Qty) / Total Vendas`

### 3. Por Quantidade (QTY)
Distribui a despesa proporcionalmente à quantidade de unidades.

```typescript
{ metodo: 'qty' }
```

**Fórmula:** `Despesa × Qty Item / Total Qty`

### 4. Peso Manual (PESO)
Distribui a despesa com pesos customizáveis por SKU.

```typescript
const manualWeights = {
  'PROD-001': 2.5,
  'PROD-002': 1.0
}
{ metodo: 'peso' }
```

---

## 🎯 Composição de Produtos

Permite que um produto (alvo) seja composto por outros produtos (fontes).

```typescript
const composition = {
  targetSkus: ['KIT-001'], // Produto final
  sourceSkus: ['COMP-001', 'COMP-002'] // Componentes
}

const result = calcRateio(items, expenses, {}, items, composition)

// Resultado:
// - Componentes têm compositionRole = 'source'
// - KIT tem compositionRole = 'target'
// - Despesa é distribuída apenas entre os alvos
// - Cada alvo herda custo dos componentes
```

---

## 📊 Estrutura de Dados

### RateioItem
```typescript
{
  sku: string          // Código do produto
  desc: string         // Descrição
  ncm: string          // Classificação fiscal
  custo: number        // Custo unitário
  preco: number        // Preço de venda
  qty: number          // Quantidade
  un: string           // Unidade (UN, KG, etc)
  margemProposta?: number      // Margem fixa (0-1)
  importedFromProposal?: boolean
  operationType?: 'venda' | 'locacao' | 'servicos'
  period?: number      // Período em meses (para locação)
}
```

### Expense
```typescript
{
  tipo: string         // Frete, Seguro, Imposto, etc
  desc: string         // Descrição
  valor: number        // Valor da despesa
  metodo: RateioMode   // custo | venda | qty | peso
  pagador: string      // Quem paga
  conta: string        // Centro de custo
}
```

### ResultItem (Resultado do Rateio)
```typescript
{
  prod: RateioItem
  rat: number                 // Total rateado
  expenseRat: number          // Despesa rateada
  ratUnit: number             // Rateio por unidade
  novoCusto: number           // Custo + rateio
  mgAnt: number               // Margem anterior (0-1)
  mgNova: number              // Margem nova (0-1)
  totC: number                // Total custo (custo × qty)
  totV: number                // Total venda (preço × qty)
  part: number                // Participação na despesa (0-1)
  delta: number               // Variação de margem
  sourceCostTotal?: number    // Custo de componentes (composição)
  composedSourceSkus?: string[]
  compositionRole?: 'target' | 'source'
  composedTargetSkus?: string[]
}
```

---

## 🧪 Exemplo Prático Completo

```typescript
// Cenário: Rateio de frete e seguro para 3 notebooks

import {
  calcRateio,
  D,
  fmt,
  pct,
  RateioStorage,
  RateioExporter
} from './RATEAR-PRODUTOS-STANDALONE'

// 1. DEFINIR PRODUTOS
const items = [
  {
    sku: 'NB-DELL-001',
    desc: 'Notebook Dell Latitude i7 16GB',
    ncm: '8471.30.12',
    custo: 3200,
    preco: 4800,
    qty: 3,
    un: 'UN'
  },
  {
    sku: 'MOUSE-001',
    desc: 'Mouse sem fio',
    ncm: '8471.60.50',
    custo: 45,
    preco: 90,
    qty: 10,
    un: 'UN'
  }
]

// 2. DEFINIR DESPESAS
const expenses = [
  {
    tipo: 'Frete',
    desc: 'Frete aéreo Porto Alegre',
    valor: 800,
    metodo: 'custo' as const,
    pagador: 'Próprio',
    conta: '3.1.01.01'
  },
  {
    tipo: 'Seguro',
    desc: 'Seguro de carga',
    valor: 150,
    metodo: 'venda' as const,
    pagador: 'Próprio',
    conta: '3.1.01.02'
  }
]

// 3. EXECUTAR RATEIO
const result = calcRateio(items, expenses, {}, items)

// 4. VALIDAR
if (!result.ok) {
  console.warn('Diferença encontrada:', result.diff)
}

// 5. EXIBIR RESULTADOS
console.log(`✅ Rateio executado com sucesso!`)
console.log(`📊 Total de despesas: ${fmt(result.totalExp)}`)
console.log(`📈 Margem antes: ${pct(result.avgMgAnt)}`)
console.log(`📈 Margem depois: ${pct(result.avgMgNova)}`)

result.results.forEach((item, idx) => {
  console.log(`\n${idx + 1}. ${item.prod.sku}`)
  console.log(`   Custo antes: R$ ${item.prod.custo}`)
  console.log(`   Custo depois: R$ ${fmt(item.novoCusto)}`)
  console.log(`   Diferença: R$ ${fmt(item.ratUnit)} por unidade`)
  console.log(`   Margem: ${pct(item.mgAnt)} → ${pct(item.mgNova)}`)
})

// 6. SALVAR
const rateio = {
  id: Date.now(),
  nome: 'Rateio NF 004521 - Tech Dist',
  data: new Date().toLocaleString('pt-BR'),
  snapshot: {
    items,
    expenses,
    rateioMode: 'custo',
    nf: { numero: '004521', emitente: 'Tech Distribuidora' },
    responsavel: 'João Silva',
    justificativa: 'Rateio de frete e seguro'
  },
  resultado: result,
  resumo: {
    totalItens: items.length,
    totalDespesas: result.totalExp,
    totalCusto: items.reduce((s, i) => s + D(i.custo * i.qty), 0),
    totalVenda: items.reduce((s, i) => s + D(i.preco * i.qty), 0),
    margem: result.avgMgNova
  }
}

RateioStorage.addRateio(rateio)
console.log('💾 Rateio salvo com sucesso!')

// 7. EXPORTAR
const csv = RateioExporter.toCSV(result)
console.log('📋 CSV gerado')

const json = RateioExporter.toJSON(rateio)
console.log('📄 JSON gerado')
```

---

## 📝 Notas Importantes

### Precisão Decimal
O módulo usa arredondamento com **4 casas decimais** para evitar erros de ponto flutuante.

```typescript
const D = (value: number, decimals = 4) =>
  Number((Number(value) || 0).toFixed(decimals))
```

### Validação de Rateio
Um rateio é considerado "OK" se a diferença entre despesas e soma do rateado é menor que R$ 0.02:

```typescript
ok: Math.abs(diff) < 0.02
```

### LocalStorage
Rateios são salvos em `localStorage` com chave: `precifica_rateios_v2`

### Compatibilidade
- ✅ React 19+
- ✅ Next.js 15+
- ✅ Node.js 18+
- ✅ Navegadores modernos (com localStorage)

---

## 🔗 Referências de Código

Arquivos originais no sistema:
- `src/components/rateio-precificacao-v2.tsx` (UI completa)
- `src/app/pricing/ratear-produtos/page.tsx` (Página)
- `src/app/pricing/rateios-salvos/page.tsx` (Histórico)

---

## 📞 Suporte

Para dúvidas sobre integração, consulte:
- Arquivo `RATEAR-PRODUTOS-STANDALONE.ts` (código comentado)
- Tipos TypeScript exportados
- Exemplos de uso acima

---

**Pronto para Integração!** 🚀
