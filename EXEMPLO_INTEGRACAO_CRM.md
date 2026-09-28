# 🔗 EXEMPLO PRÁTICO DE INTEGRAÇÃO EM CRM

**Passo a passo completo para integrar o simulador em um CRM existente**

---

## 📋 PRÉ-REQUISITOS

Seu CRM deve ter:
- ✅ Next.js 13+ ou React 18+
- ✅ TailwindCSS configurado
- ✅ Sistema de autenticação
- ✅ Banco de dados PostgreSQL (ou adaptar)
- ✅ API REST para dados do cliente

---

## 🚀 PASSO 1: PREPARAR ESTRUTURA

### 1.1 Criar pastas no seu CRM

```bash
# No seu projeto CRM
mkdir -p src/modules/simulador/{components,hooks,lib,types,api}
mkdir -p src/modules/simulador/components/{dashboard,calculators,proposals,shared}
mkdir -p src/modules/simulador/lib/{proposals,validations}
```

### 1.2 Copiar arquivos principais

```bash
# Do projeto Double
cp -r SimuladoresDoublev2/src/components/dashboard/* seu-crm/src/modules/simulador/components/dashboard/
cp -r SimuladoresDoublev2/src/components/calculators/* seu-crm/src/modules/simulador/components/calculators/
cp -r SimuladoresDoublev2/src/components/proposals/* seu-crm/src/modules/simulador/components/proposals/
cp -r SimuladoresDoublev2/src/components/ui/* seu-crm/src/components/ui/
cp -r SimuladoresDoublev2/src/hooks/* seu-crm/src/modules/simulador/hooks/
cp -r SimuladoresDoublev2/src/lib/* seu-crm/src/modules/simulador/lib/
```

---

## 🔐 PASSO 2: ADAPTAR AUTENTICAÇÃO

### 2.1 Criar hook de autenticação customizado

```typescript
// seu-crm/src/modules/simulador/hooks/use-auth.tsx
'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useSession } from 'next-auth/react'; // ou seu provider

interface User {
  id: string;
  email: string;
  role: 'admin' | 'director' | 'user';
  profile?: {
    full_name: string;
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (session?.user) {
      // Adaptar conforme seus dados de sessão
      setUser({
        id: session.user.id || '',
        email: session.user.email || '',
        role: session.user.role || 'user',
        profile: {
          full_name: session.user.name || ''
        }
      });
    }
  }, [session]);

  return (
    <AuthContext.Provider value={{ user, isLoading: status === 'loading', logout: async () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
```

### 2.2 Envolver seu app

```typescript
// seu-crm/src/app/layout.tsx
import { AuthProvider } from '@/modules/simulador/hooks/use-auth';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## 📦 PASSO 3: ADAPTAR DADOS DE PROPOSTAS

### 3.1 Criar hook de propostas customizado

```typescript
// seu-crm/src/modules/simulador/hooks/use-proposals-with-permissions.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { getPermissionsForRole } from '../lib/permissions';

export interface Proposal {
  id: string;
  base_id: string;
  title: string;
  type: string;
  status: string;
  value: number;
  total_monthly: number;
  total_setup: number;
  created_by: string;
  created_at: string;
  client: {
    name: string;
  };
  metadata?: Record<string, any>;
}

export function useProposalsWithPermissions() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Chamar sua API
      const response = await fetch('/api/simulador/proposals', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar propostas');

      const data = await response.json();
      setProposals(data.proposals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return { proposals, fetchProposals, loading, error };
}

async function getAuthToken(): Promise<string> {
  // Implementar de acordo com seu sistema de auth
  const response = await fetch('/api/auth/token');
  const data = await response.json();
  return data.token;
}
```

### 3.2 Criar API endpoint

```typescript
// seu-crm/src/app/api/simulador/proposals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth'; // seu sistema
import { db } from '@/lib/db'; // seu ORM

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Buscar propostas do seu BD
    const proposals = await db.proposal.findMany({
      where: {
        created_by: user.role === 'admin' ? undefined : user.id
      },
      include: {
        client: true,
        creator: { select: { email: true, profile: true } }
      }
    });

    return NextResponse.json({ proposals });
  } catch (error) {
    console.error('Erro ao buscar propostas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar propostas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    // Salvar proposta no seu BD
    const proposal = await db.proposal.create({
      data: {
        ...body,
        created_by: user.id,
        client_id: body.client_id
      },
      include: { client: true }
    });

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar proposta:', error);
    return NextResponse.json(
      { error: 'Erro ao criar proposta' },
      { status: 500 }
    );
  }
}
```

---

## 💰 PASSO 4: ADAPTAR COMISSÕES

### 4.1 Criar hook de comissões

```typescript
// seu-crm/src/modules/simulador/hooks/use-commissions.ts
'use client';

import { useEffect, useState } from 'react';

export interface CommissionData {
  months_12: number;
  months_24: number;
  months_36: number;
  months_48: number;
  months_60: number;
}

export function useCommissions() {
  const [channelSeller, setChannelSeller] = useState<CommissionData | null>(null);
  const [channelDirector, setChannelDirector] = useState<CommissionData | null>(null);

  useEffect(() => {
    // Carregar taxas de comissão do seu BD
    fetch('/api/simulador/commissions')
      .then(res => res.json())
      .then(data => {
        setChannelSeller(data.channelSeller);
        setChannelDirector(data.channelDirector);
      })
      .catch(error => console.error('Erro ao carregar comissões:', error));
  }, []);

  return { channelSeller, channelDirector };
}
```

### 4.2 Criar endpoint de comissões

```typescript
// seu-crm/src/app/api/simulador/commissions/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Buscar suas taxas de comissão
    const channelSeller = await db.commissionChannelSeller.findFirst();
    const channelDirector = await db.commissionChannelDirector.findFirst();

    return NextResponse.json({
      channelSeller: channelSeller || getDefaultCommissions(),
      channelDirector: channelDirector || getDefaultCommissions()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar comissões' },
      { status: 500 }
    );
  }
}

function getDefaultCommissions() {
  return {
    months_12: 10,
    months_24: 15,
    months_36: 20,
    months_48: 25,
    months_60: 30
  };
}
```

---

## 🎨 PASSO 5: CRIAR PÁGINA DE SIMULADOR

### 5.1 Criar página principal

```typescript
// seu-crm/src/app/simulador/page.tsx
'use client';

import { useState } from 'react';
import DashboardView from '@/modules/simulador/components/dashboard/DashboardView';
import InternetRadioCalculator from '@/modules/simulador/components/calculators/InternetRadioCalculator';
import InternetFibraCalculator from '@/modules/simulador/components/calculators/InternetFibraCalculator';
import PABXSIPCalculator from '@/modules/simulador/components/calculators/PABXSIPCalculator';
import ProposalsView from '@/modules/simulador/components/proposals/ProposalsView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SimuladorPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Simulador de Preços</h1>
          <p className="text-gray-600">Double Telecom - CRM Integration</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="radio">Internet Rádio</TabsTrigger>
            <TabsTrigger value="fibra">Internet Fibra</TabsTrigger>
            <TabsTrigger value="pabx">PABX SIP</TabsTrigger>
            <TabsTrigger value="proposals">Propostas</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardView />
          </TabsContent>

          <TabsContent value="radio" className="mt-6">
            <InternetRadioCalculator />
          </TabsContent>

          <TabsContent value="fibra" className="mt-6">
            <InternetFibraCalculator />
          </TabsContent>

          <TabsContent value="pabx" className="mt-6">
            <PABXSIPCalculator />
          </TabsContent>

          <TabsContent value="proposals" className="mt-6">
            <ProposalsView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

---

## 🔄 PASSO 6: INTEGRAR COM SEU BD

### 6.1 Exemplo Prisma Schema

```prisma
// seu-crm/prisma/schema.prisma

model Proposal {
  id           String   @id @default(cuid())
  base_id      String   @unique
  title        String
  type         String   // FIBER, RADIO, PABX, VM, DOUBLE
  status       String   @default("Rascunho")
  value        Decimal  @db.Decimal(15, 2)
  total_setup  Decimal  @db.Decimal(15, 2)
  total_monthly Decimal @db.Decimal(15, 2)
  contract_period Int
  
  created_by   String
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  
  client_id    String
  client       Client   @relation(fields: [client_id], references: [id])
  
  metadata     Json?
  products     Json?
  
  @@index([created_by])
  @@index([client_id])
}

model Client {
  id           String   @id @default(cuid())
  name         String
  email        String
  phone        String?
  created_at   DateTime @default(now())
  
  proposals    Proposal[]
}

model CommissionChannelSeller {
  id           String   @id @default(cuid())
  months_12    Int
  months_24    Int
  months_36    Int
  months_48    Int
  months_60    Int
}
```

---

## 🧪 PASSO 7: TESTAR INTEGRAÇÃO

### 7.1 Checklist de testes

```bash
# 1. Autenticação
[ ] User consegue fazer login
[ ] User info carregado corretamente
[ ] Logout funciona

# 2. Dashboard
[ ] Dashboard carrega sem erros
[ ] Propostas aparecem na lista
[ ] Gráficos renderizam

# 3. Calculadora
[ ] Calculadora abre
[ ] Formulário funciona
[ ] Cálculos estão corretos
[ ] Proposta salva com sucesso

# 4. Propostas
[ ] Lista de propostas carrega
[ ] Pode editar proposta
[ ] Pode aprovar proposta
[ ] Status atualiza

# 5. Permissões
[ ] Admin vê todas as propostas
[ ] User vê apenas suas propostas
[ ] User não consegue aprovar
```

### 7.2 Testar com seu cliente

```typescript
// seu-crm/src/modules/simulador/hooks/use-auth.tsx
// Adicionar modo debug

const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('🔐 User:', user);
  console.log('📊 Proposals:', proposals);
  console.log('💰 Commissions:', commissions);
}
```

---

## 🚀 PASSO 8: DEPLOY

### 8.1 Checklist de deploy

```
[ ] Todas as APIs implementadas
[ ] Banco de dados migrado
[ ] Autenticação funcionando
[ ] Variáveis de ambiente configuradas
[ ] Testes de produção passando
[ ] Backups realizados
[ ] Monitoramento ativado
```

### 8.2 Variáveis de ambiente

```bash
# seu-crm/.env.production
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="seu-secret"
NEXTAUTH_URL="https://seu-crm.com"

# Simulador
NEXT_PUBLIC_SIMULADOR_API="https://seu-crm.com/api/simulador"
```

---

## 📞 TROUBLESHOOTING

### Problema: "useAuth não funciona"

```typescript
// Verificar se AuthProvider está envolvendo seu app
// Verificar se useAuth está sendo chamado dentro do provider
```

### Problema: "Propostas não carregam"

```typescript
// Verificar:
1. API endpoint existe?
   curl http://localhost:3000/api/simulador/proposals

2. Token de autenticação é válido?
   console.log(await getAuthToken());

3. Query no BD está correta?
   SELECT * FROM proposals;
```

### Problema: "TailwindCSS não funciona"

```typescript
// Verificar:
1. TailwindCSS config inclui seu path?
2. content: ['./src/**/*.{js,ts,jsx,tsx}']
3. npm run build && npm run dev
```

---

## ✅ RESULTADO FINAL

Após seguir todos os passos:

✅ Dashboard funcionando  
✅ Calculadoras integrando com seu BD  
✅ Propostas sendo salvas  
✅ Permissões respeitadas  
✅ Tudo sincronizado em tempo real  

---

**Próximo**: Consulte `GUIA_EXTRACAO_MODULAR.md` para customizações avançadas.

---

**Data**: 10 de Agosto de 2026  
**Status**: Pronto para Implementação
