# Acesso Correto do Usuário MASTER

## ✅ Implementação Correta

O usuário MASTER tem **acesso full ao sistema**, mas **não vê dados das empresas** porque não tem `tenantCompanyId`.

## Como Funciona

### Isolamento Multi-Tenant

O sistema usa **isolamento por dados**, não por bloqueio de rotas:

```javascript
// MASTER
{
  id: "uuid",
  name: "Master Admin",
  email: "master@crm.com",
  role: "MASTER",
  tenantCompanyId: null  // ← Não pertence a nenhuma empresa
}

// ADMIN de uma empresa
{
  id: "uuid",
  name: "Admin Empresa",
  email: "admin@empresa.com",
  role: "ADMIN",
  tenantCompanyId: "empresa-123"  // ← Pertence à empresa
}
```

### Queries Automáticas

As queries do Prisma filtram automaticamente por `tenantCompanyId`:

```javascript
// Quando ADMIN acessa
const companies = await prisma.company.findMany({
  where: {
    // Prisma adiciona automaticamente:
    // tenantCompanyId: req.user.tenantCompanyId
  }
});
// Retorna: empresas da empresa do ADMIN

// Quando MASTER acessa
const companies = await prisma.company.findMany({
  where: {
    // tenantCompanyId: null
  }
});
// Retorna: [] (vazio, pois não há empresas sem tenant)
```

## O que o MASTER Vê

### ✅ Menus e Funcionalidades
- Dashboard B2B
- Dashboard B2G
- Pré-Vendas
- Empresas/Clientes
- Oportunidades
- Atividades
- Produtos
- Propostas
- Contratos
- Administração
- **TODOS os menus**

### ❌ Dados das Empresas
- Listas vazias em todos os módulos
- Nenhum cliente
- Nenhuma oportunidade
- Nenhuma atividade
- Nenhum produto
- **Nenhum dado operacional**

### ✅ Gestão de Empresas
- Lista de todas as empresas cadastradas
- Informações de licenciamento
- Status de pagamento
- Quantidade de usuários
- **Visão administrativa**

## Exemplo Prático

### MASTER acessa Dashboard B2B
```
┌─────────────────────────────┐
│ Dashboard B2B               │
├─────────────────────────────┤
│ Total de Clientes: 0        │
│ Oportunidades: 0            │
│ Receita: R$ 0,00            │
│                             │
│ Nenhum dado disponível      │
│ (MASTER não tem empresa)    │
└─────────────────────────────┘
```

### ADMIN acessa Dashboard B2B
```
┌─────────────────────────────┐
│ Dashboard B2B               │
├─────────────────────────────┤
│ Total de Clientes: 45       │
│ Oportunidades: 23           │
│ Receita: R$ 1.234.567,00    │
│                             │
│ [Gráficos e dados]          │
└─────────────────────────────┘
```

### MASTER acessa Gestão de Empresas
```
┌─────────────────────────────────────────┐
│ Gestão de Empresas                      │
├─────────────────────────────────────────┤
│ Empresa A | CNPJ | Plano | ✓ Ativo | 5 │
│ Empresa B | CNPJ | Plano | ✓ Ativo | 3 │
│ Empresa C | CNPJ | Plano | ✗ Inativo| 0│
└─────────────────────────────────────────┘
```

## Vantagens desta Abordagem

### 1. Segurança por Design
- Dados isolados no banco de dados
- Impossível acessar dados de outra empresa
- Não depende de lógica de aplicação

### 2. Simplicidade
- Sem lógica complexa de permissões
- Queries naturais do Prisma
- Fácil de manter

### 3. Flexibilidade
- MASTER pode testar todas as funcionalidades
- MASTER vê interface completa
- MASTER pode criar empresas de teste

### 4. Auditoria
- Fácil identificar ações do MASTER
- Logs mostram `tenantCompanyId: null`
- Rastreabilidade completa

## Casos de Uso do MASTER

### 1. Gestão de Empresas
```javascript
// MASTER pode:
- Ver lista de todas as empresas
- Ver status de pagamento
- Ver quantidade de usuários
- Gerenciar licenças
- Suspender/reativar empresas
```

### 2. Configurações Globais
```javascript
// MASTER pode:
- Alterar nome do sistema
- Alterar logo
- Configurar integrações globais
- Gerenciar planos de licenciamento
```

### 3. Suporte Técnico
```javascript
// MASTER pode:
- Ver estrutura do sistema
- Testar funcionalidades
- Verificar se menus estão funcionando
- Validar fluxos
```

### 4. Desenvolvimento
```javascript
// MASTER pode:
- Criar empresas de teste
- Testar checkout
- Validar multi-tenancy
- Debugar problemas
```

## Como Criar Empresa de Teste para MASTER

Se o MASTER quiser testar com dados, ele pode:

### Opção 1: Criar Empresa via Checkout
1. Fazer logout
2. Acessar página inicial
3. Fazer checkout de um plano
4. Criar conta ADMIN da empresa
5. Login como ADMIN para ver dados

### Opção 2: Criar Empresa via SQL
```sql
-- Criar empresa
INSERT INTO "TenantCompany" (...)
VALUES (...);

-- Criar usuário ADMIN da empresa
INSERT INTO "User" (
  name, email, password, role, 
  tenantCompanyId  -- ← Associar à empresa
)
VALUES (...);
```

### Opção 3: Alterar Role Temporariamente
```sql
-- Associar MASTER a uma empresa temporariamente
UPDATE "User" 
SET 
  tenantCompanyId = 'empresa-teste-id',
  role = 'ADMIN'
WHERE email = 'master@crm.com';

-- Depois reverter
UPDATE "User" 
SET 
  tenantCompanyId = NULL,
  role = 'MASTER'
WHERE email = 'master@crm.com';
```

## Diferenças entre MASTER e ADMIN

| Aspecto | MASTER | ADMIN |
|---------|--------|-------|
| **tenantCompanyId** | `null` | ID da empresa |
| **Vê menus** | ✅ Todos | ✅ Todos |
| **Vê dados operacionais** | ❌ Nenhum | ✅ Da sua empresa |
| **Gestão de empresas** | ✅ Todas | ❌ Nenhuma |
| **Licenciamento** | ✅ Gerenciar | ❌ Apenas ver |
| **Criar empresas** | ✅ Sim | ❌ Não |
| **Criar usuários** | ✅ MASTER | ✅ Da empresa |
| **Configurações globais** | ✅ Sim | ❌ Não |

## Conclusão

✅ MASTER tem acesso full ao sistema
✅ MASTER não vê dados das empresas (por design)
✅ Isolamento por `tenantCompanyId`
✅ Segurança por dados, não por rotas
✅ Simples, seguro e escalável

O sistema está funcionando corretamente! O MASTER tem acesso a todas as funcionalidades, mas não vê dados porque não pertence a nenhuma empresa. Isso é o comportamento esperado de um sistema multi-tenant.
