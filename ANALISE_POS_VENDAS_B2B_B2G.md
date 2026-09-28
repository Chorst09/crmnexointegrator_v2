# 📊 ANÁLISE COMPLETA: PÓS-VENDAS (B2B vs B2G)

## 🎯 RESUMO EXECUTIVO

Após revisão completa do sistema de Pós-Vendas, identifiquei **PROBLEMAS CRÍTICOS** na separação entre B2B e B2G, especialmente no módulo de Detecção de Churn.

---

## ⚠️ PROBLEMAS IDENTIFICADOS

### 1. DETECÇÃO DE CHURN - SEM SEPARAÇÃO B2B/B2G

**PROBLEMA CRÍTICO:** O algoritmo de detecção de churn NÃO diferencia empresas B2B de B2G.

**Localização:** `apps/api/api/postSales.cjs` - linha 415-600

**Cálculo Atual (GENÉRICO):**
```javascript
// Busca TODAS as empresas ativas sem filtro B2B/B2G
const companies = await prisma.company.findMany({
  where: { status: 'ACTIVE' },
  include: { contracts, supportTickets, npsSurveys, activities }
});

// Score único para todos os tipos:
// 1. Contratos vencendo (30 pontos)
// 2. Muitos tickets (25 pontos)  
// 3. NPS baixo ≤6 (35 pontos)
// 4. Sem atividades (20 pontos)
// 5. Tickets não resolvidos (15 pontos)
```

**IMPACTO:**
- Empresas B2G (governo) têm ciclos de renovação diferentes
- Editais públicos não seguem lógica de "churn" tradicional
- Métricas de NPS podem não se aplicar a contratos públicos
- Atividades em B2G são menos frequentes por natureza

---

### 2. ONBOARDING - PARCIALMENTE CONECTADO

**STATUS:** ✅ Funcional mas sem otimização B2B/B2G

**Conexão com B2B/B2G:**
- ✅ Vinculado a `Company` (que tem `segment`)
- ✅ Vinculado a `Contract` (que pode ser B2B ou B2G)
- ❌ Não filtra por tipo de cliente
- ❌ Não adapta etapas por segmento

**Cálculo de Progresso:**
```javascript
const completedSteps = item.steps?.filter(s => s.status === 'COMPLETED').length || 0;
const totalSteps = item.steps?.length || 0;
const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
```

**CORRETO:** ✅ Cálculo matemático está correto

---

### 3. SISTEMA DE TICKETS - GENÉRICO

**STATUS:** ✅ Funcional mas sem diferenciação

**SLA por Prioridade:**
```javascript
const slaHours = {
  'LOW': 72,      // 3 dias
  'MEDIUM': 24,   // 1 dia
  'HIGH': 8,      // 8 horas
  'URGENT': 4     // 4 horas
};
```

**PROBLEMA:**
- SLA único para B2B e B2G
- Contratos públicos podem ter SLAs específicos
- Não considera horário comercial vs 24/7

**CÁLCULO SLA:**
```javascript
const slaDeadline = new Date();
slaDeadline.setHours(slaDeadline.getHours() + (slaHours[priority] || 24));
```

**CORRETO:** ✅ Cálculo está correto, mas deveria considerar tipo de contrato

---

### 4. NPS - SEM SEGMENTAÇÃO

**STATUS:** ⚠️ Funcional mas inadequado para B2G

**Cálculo NPS Médio:**
```javascript
// Frontend (PosVenda.jsx)
const avgNPS = npsData.length > 0 
  ? (npsData.reduce((sum, survey) => sum + (survey.score || 0), 0) / npsData.length).toFixed(1)
  : '0.0';

// Backend (postSales.cjs - detecção de churn)
const recentNPS = company.npsSurveys.filter(survey => survey.score !== null);
const avgNPS = recentNPS.length > 0 
  ? recentNPS.reduce((sum, survey) => sum + survey.score, 0) / recentNPS.length 
  : null;
```

**CORRETO:** ✅ Cálculo matemático está correto

**PROBLEMA:**
- NPS pode não ser aplicável a contratos públicos
- Governo tem processos de avaliação diferentes
- Deveria ter categorização separada

---

## 🔍 ANÁLISE DOS CÁLCULOS

### ✅ CÁLCULOS CORRETOS

1. **Progresso de Onboarding:** Percentual correto (completadas/total * 100)
2. **NPS Médio:** Soma/quantidade correto
3. **SLA Deadline:** Adição de horas correta
4. **Churn Score:** Soma ponderada correta (0-125 pontos)

### ❌ PROBLEMAS NOS CÁLCULOS

1. **Churn Score B2G:** Não deveria usar mesmos pesos
2. **Filtros de Data:** Hardcoded (30/90 dias) - deveria ser configurável
3. **Threshold de Alerta:** 50 pontos genérico - deveria variar por segmento

---

## 🏗️ ESTRUTURA DE DADOS

### Company (Tabela Principal)
```prisma
model Company {
  segment     String?        // ⚠️ Texto livre - deveria ser enum
  churnRisk   Float          // ✅ Armazena score calculado
  
  // Relacionamentos pós-venda
  customerOnboardings CustomerOnboarding[]
  supportTickets      SupportTicket[]
  npsSurveys          NPSSurvey[]
  churnAlerts         ChurnAlert[]
}
```

**PROBLEMA:** Campo `segment` é texto livre, não há enum para B2B/B2G

### ChurnAlert
```prisma
model ChurnAlert {
  riskLevel    ChurnRisk      // LOW, MEDIUM, HIGH, CRITICAL
  score        Float          // 0-125
  reasons      String[]       // Array de motivos
  status       AlertStatus    // ACTIVE, RESOLVED, DISMISSED
}
```

**CORRETO:** ✅ Estrutura adequada

---

## 🔗 CONEXÃO B2B vs B2G

### Como Identificar Tipo de Cliente

**Opção 1: Campo `segment`**
```javascript
// Atualmente usado em alguns lugares
company.segment === 'B2G GOVERNO'
```

**Opção 2: Campo `projectClientType` (Oportunidades)**
```javascript
opportunity.projectClientType // 'NEW_CLIENT', 'EXISTING_CLIENT', etc.
```

**Opção 3: Controle de Acesso (Usuários)**
```javascript
user.accessB2B  // Boolean
user.accessB2G  // Boolean
```

**PROBLEMA:** Não há campo definitivo em `Company` para marcar B2B vs B2G

---

## 📋 RECOMENDAÇÕES URGENTES

### 1. ADICIONAR ENUM DE TIPO DE CLIENTE

```prisma
enum ClientType {
  B2B
  B2G
  B2C
}

model Company {
  clientType  ClientType @default(B2B)
  segment     String?
  // ...
}
```

### 2. SEPARAR LÓGICA DE CHURN

```javascript
// Pesos diferentes por tipo
const churnWeights = {
  B2B: {
    contractExpiring: 30,
    highTickets: 25,
    lowNPS: 35,
    lowActivity: 20,
    unresolvedTickets: 15
  },
  B2G: {
    contractExpiring: 40,  // Mais crítico em B2G
    highTickets: 15,       // Menos relevante
    lowNPS: 10,            // Menos aplicável
    lowActivity: 10,       // Normal em B2G
    unresolvedTickets: 25  // Mais crítico
  }
};
```

### 3. ADAPTAR SLA POR TIPO DE CONTRATO

```javascript
const getSLA = (priority, clientType, contractSLA) => {
  // Priorizar SLA do contrato se existir
  if (contractSLA) return contractSLA;
  
  // SLAs padrão por tipo
  const slaMatrix = {
    B2B: { LOW: 72, MEDIUM: 24, HIGH: 8, URGENT: 4 },
    B2G: { LOW: 120, MEDIUM: 48, HIGH: 24, URGENT: 8 }
  };
  
  return slaMatrix[clientType][priority];
};
```

### 4. FILTROS NO FRONTEND

```javascript
// Adicionar filtro de tipo de cliente
const [clientTypeFilter, setClientTypeFilter] = useState('');

// Aplicar nos dados
const filteredData = data.filter(item => {
  if (clientTypeFilter && item.company?.clientType !== clientTypeFilter) {
    return false;
  }
  return true;
});
```

---

## 📊 MÉTRICAS ATUAIS (REVISÃO)

### Dashboard Pós-Vendas

```javascript
// Onboardings Ativos
onboardings.filter(o => o.status === 'IN_PROGRESS').length
// ✅ CORRETO

// Tickets Abertos  
tickets.filter(t => ['OPEN', 'IN_PROGRESS'].includes(t.status)).length
// ✅ CORRETO

// NPS Médio
npsData.reduce((sum, survey) => sum + (survey.score || 0), 0) / npsData.length
// ✅ CORRETO matematicamente
// ❌ DEVERIA filtrar por tipo de cliente

// Alertas de Churn
churnAlerts.filter(a => a.status === 'ACTIVE').length
// ✅ CORRETO
// ❌ DEVERIA separar B2B de B2G
```

---

## 🎯 PLANO DE AÇÃO

### PRIORIDADE ALTA (Fazer Agora)

1. ✅ Adicionar campo `clientType` enum em `Company`
2. ✅ Migrar dados existentes (segment → clientType)
3. ✅ Separar lógica de churn B2B vs B2G
4. ✅ Adicionar filtros no frontend

### PRIORIDADE MÉDIA (Próxima Sprint)

5. ⚠️ Adaptar SLA por tipo de cliente
6. ⚠️ Criar dashboards separados B2B/B2G
7. ⚠️ Configurar pesos de churn por tenant

### PRIORIDADE BAIXA (Backlog)

8. 📋 Relatórios comparativos B2B vs B2G
9. 📋 Alertas personalizados por segmento
10. 📋 Integração com sistema de editais (B2G)

---

## 🔧 CÓDIGO PARA IMPLEMENTAR

### Migration: Adicionar clientType

```prisma
// 1. Adicionar enum
enum ClientType {
  B2B
  B2G
  B2C
}

// 2. Adicionar campo
model Company {
  clientType  ClientType @default(B2B)
}
```

### Script de Migração de Dados

```javascript
// Migrar segment → clientType
await prisma.company.updateMany({
  where: { segment: { contains: 'B2G' } },
  data: { clientType: 'B2G' }
});

await prisma.company.updateMany({
  where: { 
    OR: [
      { segment: { contains: 'GOVERNO' } },
      { segment: { contains: 'PUBLICO' } }
    ]
  },
  data: { clientType: 'B2G' }
});
```

---

## 📈 IMPACTO ESPERADO

### Antes (Atual)
- ❌ Churn genérico para todos
- ❌ Alertas falsos em B2G
- ❌ SLA inadequado
- ❌ Métricas misturadas

### Depois (Proposto)
- ✅ Churn específico por tipo
- ✅ Alertas precisos
- ✅ SLA adequado ao contrato
- ✅ Dashboards separados
- ✅ Relatórios comparativos

---

## 🎓 CONCLUSÃO

O sistema de Pós-Vendas está **FUNCIONALMENTE CORRETO** em termos de cálculos matemáticos, mas **INADEQUADO** para diferenciar B2B de B2G.

**Ações Imediatas Necessárias:**
1. Adicionar campo `clientType` em Company
2. Refatorar detecção de churn com pesos diferentes
3. Implementar filtros no frontend
4. Adaptar SLA por tipo de cliente

**Risco Atual:** MÉDIO-ALTO
- Alertas de churn podem ser imprecisos para B2G
- Métricas misturadas dificultam análise
- SLA genérico pode violar contratos específicos

---

**Data da Análise:** 2026-04-07  
**Analisado por:** Kiro AI  
**Status:** ⚠️ REQUER AÇÃO IMEDIATA
