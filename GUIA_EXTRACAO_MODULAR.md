# 📦 GUIA DE EXTRAÇÃO MODULAR - SIMULADOR DOUBLE v2
**Para Integração em CRM Externo**

---

## 🎯 OBJETIVO

Extrair código de 3 módulos principais em formato modular e reutilizável:

1. **Dashboard** - Visualização de métricas e propostas
2. **Pricing (Calculadoras)** - 12+ calculadoras de preço
3. **Commercial Proposal** - Fluxo de aprovação e geração de propostas

---

## 📂 ESTRUTURA DE ARQUIVOS

```
src/
├── components/
│   ├── dashboard/                    ← MÓDULO #1
│   │   ├── DashboardView.tsx
│   │   ├── CalculatorsMenuView.tsx
│   │   ├── QuoteStatusChart.tsx
│   │   ├── RoDashboardView.tsx
│   │   └── StatCard.tsx
│   │
│   ├── calculators/                  ← MÓDULO #2
│   │   ├── InternetRadioCalculator.tsx
│   │   ├── InternetFibraCalculator.tsx
│   │   ├── PABXSIPCalculator.tsx
│   │   ├── DoubleFibraRadioCalculator.tsx
│   │   ├── MaquinasVirtuaisCalculator.tsx
│   │   ├── CommissionTablesUnified.tsx   (shared)
│   │   ├── ClientManagerForm.tsx         (shared)
│   │   └── ... (12+ calculators)
│   │
│   ├── proposals/                    ← MÓDULO #3
│   │   ├── ProposalsView.tsx
│   │   ├── ProposalForm.tsx
│   │   ├── ProposalStatusBadge.tsx
│   │   ├── ProposalApprovalRequestButton.tsx
│   │   ├── ProposalApprovalInfo.tsx
│   │   └── ProposalApprovalActions.tsx
│   │
│   └── shared/                       ← SHARED COMPONENTS
│       └── (reused across modules)
│
├── hooks/
│   ├── use-proposals-with-permissions.ts
│   ├── use-commissions.ts
│   ├── use-auth.tsx
│   └── ...
│
├── lib/
│   ├── permissions.ts
│   ├── database.ts
│   ├── proposals/
│   │   ├── approval-policy.ts
│   │   └── ...
│   ├── proposal-sync.ts
│   └── ...
│
└── app/api/
    ├── proposals/
    │   ├── route.ts
    │   └── [id]/route.ts
    ├── commissions/
    │   └── route.ts
    └── ...
```

---

## 🚀 MÓDULO #1: DASHBOARD

### Componentes

```
src/components/dashboard/
├── DashboardView.tsx          - View principal do dashboard
├── CalculatorsMenuView.tsx    - Menu de seleção de calculadoras
├── QuoteStatusChart.tsx       - Gráficos de status de propostas
├── RoDashboardView.tsx        - Dashboard de ROs
└── StatCard.tsx               - Card reutilizável de estatísticas
```

### Dependências

```typescript
// Hooks necessários
- useAuth()                    // Autenticação
- useProposalsWithPermissions() // Fetch de propostas
- useCommissions()             // Dados de comissões

// Tipos
- Proposal
- UserProfile
- Commission

// Libs
- src/lib/permissions.ts       // Permissões
- src/lib/database.ts          // Serviços de BD
```

### API Endpoints Necessários

```bash
GET  /api/proposals                    # Listar propostas
GET  /api/proposals?dashboard=true     # Dashboard view
GET  /api/auth/me                      # User info
GET  /api/commissions                  # Dados de comissões
```

### Uso Básico

```typescript
import DashboardView from '@/components/dashboard/DashboardView';

export default function CRMDashboard() {
  return <DashboardView />;
}
```

### Customização

```typescript
// Modificar período
const [startDate, setStartDate] = useState(new Date(Date.now() - 30*24*60*60*1000));
const [endDate, setEndDate] = useState(new Date());

// Filtrar por tipo de proposta
const [typeFilter, setTypeFilter] = useState('FIBER');

// Limitar número de propostas mostradas
const maxProposals = 50;
```

---

## 💰 MÓDULO #2: PRICING (CALCULADORAS)

### Calculadoras Disponíveis

| Calculadora | Arquivo | Tipos |
|-------------|---------|-------|
| Internet Rádio | `InternetRadioCalculator.tsx` | Wireless, 4G/5G |
| Internet Fibra | `InternetFibraCalculator.tsx` | Fibra Óptica |
| PABX SIP | `PABXSIPCalculator.tsx` | VoIP, Telefonia |
| Fibra + Rádio | `DoubleFibraRadioCalculator.tsx` | Híbrido |
| Máquinas Virtuais | `MaquinasVirtuaisCalculator.tsx` | Cloud, VM |
| Internet OKv2 | `InternetOKv2Calculator.tsx` | OK Internet |
| ... | ... | ... |

### Componentes Compartilhados

```
CommissionTablesUnified.tsx  - Tabelas de comissão (vendedor, diretor, canal)
ClientManagerForm.tsx        - Formulário de dados do cliente
ClientManagerInfo.tsx        - Exibição de dados do cliente
DRETable.tsx                 - Demonstração de Resultado (DRE)
ChannelSellerTable.tsx       - Comissões de vendedor canal
DirectorTable.tsx            - Comissões de diretor
```

### Dependências

```typescript
// Hooks
- useAuth()                    // User info
- useCommissions()             // Commission rates
- useProposalsWithPermissions() // Save/load proposals
- useDeepLinkedProposal()      // URL params support

// Tipos
- Proposal
- Product
- Commission

// Libs
- src/lib/permissions.ts
- src/lib/proposal-id-generator.ts
- src/lib/proposal-sync.ts     // Real-time sync
```

### API Endpoints Necessários

```bash
GET  /api/proposals?all=true          # Carregar propostas
POST /api/proposals                   # Criar proposta
PUT  /api/proposals/[id]              # Atualizar proposta
GET  /api/proposals/[id]              # Detalhes da proposta
GET  /api/commissions                 # Taxas de comissão
```

### Estrutura de Proposta

```typescript
interface Proposal {
  id: string;
  base_id: string;
  title: string;
  type: 'FIBER' | 'RADIO' | 'PABX' | 'VM' | 'DOUBLE' | 'INTERNET_OK';
  status: string;
  value: number;
  total_setup: number;
  total_monthly: number;
  contract_period: number;
  date: Date;
  expiry_date: Date;
  created_by: string;
  client: {
    name: string;
    contact?: string;
    email?: string;
    phone?: string;
  };
  account_manager: {
    name: string;
    email?: string;
  };
  products: Product[];
  metadata: {
    applySalespersonDiscount?: boolean;
    appliedDirectorDiscountPercentage?: number;
    baseTotalMonthly?: number;
    isExistingClient?: boolean;
    previousMonthlyFee?: number;
    forecastTemperature?: 0 | 25 | 50 | 75 | 100;
  };
  version: number;
}
```

### Uso Básico

```typescript
import InternetRadioCalculator from '@/components/calculators/InternetRadioCalculator';

export default function CRMCalculator() {
  return <InternetRadioCalculator />;
}
```

### Customização de Calculadora

```typescript
// Props disponíveis em cada calculadora
interface CalculatorProps {
  initialProposalId?: string;        // Abrir proposta existente
  onSave?: (proposal: Proposal) => void;  // Callback após salvar
  isModal?: boolean;                 // Modo modal
  readOnly?: boolean;                // Somente leitura
}

// Exemplo
<InternetRadioCalculator
  initialProposalId="PROP-123"
  onSave={(proposal) => {
    console.log('Proposta salva:', proposal);
    // Integrar com seu CRM
  }}
  isModal={true}
/>
```

### Fluxo Básico de Calculadora

```
1. User abre calculadora
   ↓
2. Carrega propostas existentes (useProposalsWithPermissions)
   ↓
3. Preenche formulário (dados do cliente, produtos, etc)
   ↓
4. Calcula preço → mostra resultado
   ↓
5. Pode editar comissões (se admin/director)
   ↓
6. Salva como proposta → POST /api/proposals
   ↓
7. Proposta criada e pronta para aprovação
```

---

## 📄 MÓDULO #3: COMMERCIAL PROPOSAL

### Componentes

```
src/components/proposals/
├── ProposalsView.tsx                - Listagem de propostas
├── ProposalForm.tsx                 - Formulário de edição
├── ProposalStatusBadge.tsx          - Badge de status
├── ProposalApprovalRequestButton.tsx - Botão de aprovação
├── ProposalApprovalInfo.tsx         - Info de aprovação
└── ProposalApprovalActions.tsx      - Ações de aprovação
```

### Fluxo de Aprovação

```
RASCUNHO (Rascunho)
    ↓
AGUARDANDO APROVAÇÃO DO CLIENTE (Enviada)
    ↓
APROVADA (Aprovada pelo cliente)
    ↓
CONTRATO ENVIADO (Fase final)
```

### Estados de Proposta

```typescript
enum ProposalStatus {
  RASCUNHO = "Rascunho",
  ENVIADA = "Enviada",
  AGUARDANDO_APROVACAO_CLIENTE = "Aguardando Aprovação do Cliente",
  APROVADA = "Aprovada",
  CONTRATO_ENVIADO = "Contrato Enviado",
  REJEITADA = "Rejeitada",
  CANCELADA = "Cancelada"
}
```

### Permissões de Ação

| Ação | Admin | Director | User |
|------|-------|----------|------|
| Criar | ✅ | ✅ | ✅ |
| Editar | ✅ | ✅ | ✅ (própria) |
| Aprovar | ✅ | ✅ | ❌ |
| Enviar | ✅ | ✅ | ✅ (própria) |
| Ver Todas | ✅ | ✅ | ❌ |

### Dependências

```typescript
// Hooks
- useAuth()
- useProposalsWithPermissions()

// Tipos
- Proposal
- ApprovalWorkflow

// Libs
- src/lib/permissions.ts
```

### API Endpoints Necessários

```bash
GET  /api/proposals                              # Listar propostas
GET  /api/proposals/[id]                         # Detalhes
POST /api/proposals                              # Criar
PUT  /api/proposals/[id]                         # Atualizar
DELETE /api/proposals/[id]                       # Deletar
POST /api/proposals/[id]/approval/request        # Solicitar aprovação
PUT  /api/proposals/[id]/approval/[workflowId]   # Aprovar/Rejeitar
```

### Uso Básico

```typescript
import ProposalsView from '@/components/proposals/ProposalsView';

export default function CRMProposals() {
  return <ProposalsView />;
}
```

---

## 🔗 DEPENDÊNCIAS COMUNS

### Hooks Necessários

1. **useAuth()** - Autenticação
```typescript
const { user, logout, isLoading } = useAuth();
// Returns: { email, role, profile, id }
```

2. **useProposalsWithPermissions()** - Fetch de propostas
```typescript
const { proposals, fetchProposals, loading, error } = useProposalsWithPermissions();
```

3. **useCommissions()** - Dados de comissão
```typescript
const { 
  channelSeller, 
  channelDirector, 
  seller, 
  channelInfluencer, 
  channelIndicator 
} = useCommissions();
```

### Libraries/UI

```typescript
// Componentes de UI
- Card, CardContent, CardHeader, CardTitle
- Button, Input, Label
- Select, SelectContent, SelectItem, SelectTrigger, SelectValue
- Table, TableBody, TableCell, TableHead, TableHeader, TableRow
- Tabs, TabsContent, TabsList, TabsTrigger
- Dialog, DialogContent, DialogHeader, DialogTitle
- Badge
- Checkbox
- Radio

// Icons
- lucide-react (ícones SVG)

// Charting
- recharts (gráficos)

// Toast notifications
- sonner
```

### Backend Services

```typescript
// Database
- Prisma ORM
- PostgreSQL

// Auth
- NextAuth.js (ou similar)

// Email
- Resend (ou similar)

// File upload
- S3/similar (para PDFs)
```

---

## 🛠️ INTEGRAÇÃO EM CRM EXTERNO

### Passo 1: Copiar Arquivos

```bash
# Copiar componentes
cp -r src/components/dashboard src/components/calculators src/components/proposals <CRM_PROJECT>/src/components/

# Copiar hooks
cp -r src/hooks <CRM_PROJECT>/src/

# Copiar libs
cp -r src/lib <CRM_PROJECT>/src/

# Copiar tipos
cp -r src/types <CRM_PROJECT>/src/
```

### Passo 2: Adaptar Dependências

```typescript
// seu-crm/src/hooks/use-auth.tsx
export function useAuth() {
  // Adaptar para autenticação do seu CRM
  // Retornar { user, logout, isLoading }
}

// seu-crm/src/hooks/use-proposals-with-permissions.ts
export function useProposalsWithPermissions() {
  // Adaptar para suas APIs
  // Retornar { proposals, fetchProposals, loading, error }
}

// seu-crm/src/lib/permissions.ts
export function getPermissionsForRole(role: string) {
  // Adaptar para suas regras de permissão
  // Retornar { canViewAllProposals, canEditProposals, ... }
}
```

### Passo 3: Configurar APIs

```typescript
// Seus endpoints devem retornar mesma estrutura
GET  /api/proposals     → { data: Proposal[] }
POST /api/proposals     → { data: Proposal }
PUT  /api/proposals/[id] → { data: Proposal }
```

### Passo 4: Adaptar Estilos

```typescript
// TailwindCSS config
// Verificar se seu CRM usa mesmas classes
module.exports = {
  theme: {
    extend: {
      colors: {
        // Seus cores
      }
    }
  }
}
```

---

## 📋 CHECKLIST DE INTEGRAÇÃO

- [ ] Copiar componentes
- [ ] Copiar hooks e libs
- [ ] Adaptar `useAuth()` para seu CRM
- [ ] Adaptar `useProposalsWithPermissions()` para suas APIs
- [ ] Adaptar `getPermissionsForRole()` para suas regras
- [ ] Configurar endpoints API
- [ ] Testar autenticação
- [ ] Testar carregamento de propostas
- [ ] Testar salvamento de proposta
- [ ] Testar calculadora básica
- [ ] Testar aprovações
- [ ] Testar multi-user sync

---

## 🔧 CUSTOMIZAÇÕES COMUNS

### 1. Adicionar Novo Tipo de Calculadora

```typescript
// src/components/calculators/MeuCalculador.tsx
export default function MeuCalculador() {
  const { proposals, fetchProposals } = useProposalsWithPermissions();
  const { user } = useAuth();

  return (
    <div>
      {/* Seu calculador aqui */}
    </div>
  );
}
```

### 2. Modificar Comissões

```typescript
// Editar em: src/lib/database.ts
export const commissionService = {
  async getSeller() {
    // Retornar suas taxas
  }
}
```

### 3. Adaptar Fluxo de Aprovação

```typescript
// Editar em: src/app/api/proposals/[id]/route.ts
// Modificar lógica de aprovação conforme necessário
```

---

## 📚 ARQUIVOS PRINCIPAIS PARA EXTRAÇÃO

### Absoluto Necessário (Core)
```
✅ src/components/dashboard/DashboardView.tsx
✅ src/components/calculators/InternetRadioCalculator.tsx
✅ src/components/calculators/InternetFibraCalculator.tsx
✅ src/components/calculators/PABXSIPCalculator.tsx
✅ src/components/calculators/CommissionTablesUnified.tsx
✅ src/components/calculators/ClientManagerForm.tsx
✅ src/components/proposals/ProposalsView.tsx
✅ src/hooks/use-proposals-with-permissions.ts
✅ src/hooks/use-commissions.ts
✅ src/lib/permissions.ts
✅ src/lib/database.ts
✅ src/lib/proposal-sync.ts
```

### Muito Importante (Extended)
```
✅ src/components/calculators/InternetFibraCalculator.tsx
✅ src/components/calculators/MaquinasVirtuaisCalculator.tsx
✅ src/components/calculators/DoubleFibraRadioCalculator.tsx
✅ src/components/proposals/ProposalForm.tsx
✅ src/components/proposals/ProposalStatusBadge.tsx
✅ src/components/shared/*
```

### Opcional (Utilities)
```
⚪ src/components/calculators/InternetManCalculator.tsx
⚪ src/components/calculators/EventosTICalculator.tsx
⚪ src/components/calculators/SDWanCalculator.tsx
⚪ src/lib/proposal-id-generator.ts
```

---

## 🚀 EXEMPLO COMPLETO DE INTEGRAÇÃO

```typescript
// seu-crm/src/pages/simulador.tsx
import DashboardView from '@/components/dashboard/DashboardView';
import InternetRadioCalculator from '@/components/calculators/InternetRadioCalculator';
import ProposalsView from '@/components/proposals/ProposalsView';
import { useState } from 'react';

export default function SimuladorPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="container mx-auto p-6">
      <h1>Simulador de Preços - Double Telecom</h1>
      
      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button onClick={() => setActiveTab('calculator')}>Calculadora</button>
        <button onClick={() => setActiveTab('proposals')}>Propostas</button>
      </div>

      {activeTab === 'dashboard' && <DashboardView />}
      {activeTab === 'calculator' && <InternetRadioCalculator />}
      {activeTab === 'proposals' && <ProposalsView />}
    </div>
  );
}
```

---

## 📞 SUPORTE

Para questões sobre integração:
1. Verificar `REVISAO_ARQUITETURA_CRITICA.md` para detalhes técnicos
2. Verificar hooks em `src/hooks/` para padrão de dados
3. Verificar tipos em `src/lib/types.ts`
4. Contactar arquiteto senior para customizações complexas

---

**Data**: 10 de Agosto de 2026  
**Status**: Pronto para Extração
