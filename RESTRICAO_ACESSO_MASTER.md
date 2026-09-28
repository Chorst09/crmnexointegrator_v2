# Restrição de Acesso do Usuário MASTER

## ✅ Problema Resolvido

O usuário MASTER estava vendo todos os menus e tinha acesso aos dados operacionais das empresas (clientes, oportunidades, etc). Isso não deveria acontecer.

## Alterações Implementadas

### 1. Frontend - Sidebar

**Antes**: MASTER via todos os menus
```javascript
if (master) return menuSections; // ❌ Acesso total
```

**Depois**: MASTER vê apenas Administração
```javascript
if (master) {
  return menuSections.filter(section => section.id === 'administracao');
}
```

### 2. Backend - Middleware RBAC

**Antes**: MASTER tinha acesso total
```javascript
if (isMaster(req.user) || role === 'ADMIN') return next(); // ❌ Sem restrições
```

**Depois**: MASTER só acessa rotas administrativas
```javascript
if (isMaster(req.user)) {
  const allowedMasterPaths = [
    '/licensing',
    '/settings',
    '/users',
    '/health',
    '/auth'
  ];
  const isAllowed = allowedMasterPaths.some((prefix) => p.startsWith(prefix));
  if (!isAllowed) {
    return res.status(403).json({ 
      error: 'MASTER não tem acesso a dados operacionais das empresas' 
    });
  }
  return next();
}
```

## O que o MASTER Pode Fazer

### ✅ Permitido

1. **Ver lista de empresas** em Administração → Gestão de Empresas
   - Nome da empresa
   - CNPJ
   - Email
   - Plano contratado
   - Status (ativo/inativo)
   - Quantidade de usuários
   - Data de criação

2. **Gerenciar licenciamento**
   - Ver planos disponíveis
   - Criar/editar planos
   - Gerenciar licenças das empresas

3. **Gerenciar usuários MASTER**
   - Criar outros usuários MASTER
   - Editar configurações globais

4. **Acessar configurações do sistema**
   - Nome do sistema
   - Logo
   - Configurações gerais

### ❌ Bloqueado

1. **Dados operacionais das empresas**
   - Clientes/Empresas
   - Oportunidades
   - Atividades
   - Propostas
   - Contratos
   - Produtos
   - Comissões
   - Dashboard B2B/B2G

2. **Módulos específicos**
   - B2B Privado
   - B2G Editais
   - Pré-Vendas
   - Gestão (Produtos, Vendedores, etc)
   - Automação
   - Pós-Venda

## Estrutura de Permissões

### MASTER
- **Propósito**: Administrador do sistema multi-tenant
- **Acesso**: Apenas gestão de empresas e licenciamento
- **tenantCompanyId**: `null` (não pertence a nenhuma empresa)
- **Menus visíveis**: Apenas "Administração"

### ADMIN
- **Propósito**: Administrador de uma empresa específica
- **Acesso**: Todos os dados da sua empresa
- **tenantCompanyId**: ID da empresa
- **Menus visíveis**: Todos os módulos da empresa

### USER, PRE_SALES, SELLER, etc
- **Propósito**: Usuários operacionais
- **Acesso**: Conforme permissões configuradas
- **tenantCompanyId**: ID da empresa
- **Menus visíveis**: Conforme accessB2B, accessB2G, accessPreSales

## Rotas Permitidas para MASTER

| Rota | Descrição |
|------|-----------|
| `/api/licensing/*` | Gestão de licenças e empresas |
| `/api/settings` | Configurações do sistema |
| `/api/users` | Gestão de usuários MASTER |
| `/api/health` | Health check |
| `/api/auth/*` | Autenticação |

## Rotas Bloqueadas para MASTER

| Rota | Motivo |
|------|--------|
| `/api/companies` | Dados operacionais das empresas |
| `/api/clients` | Clientes das empresas |
| `/api/opportunities` | Oportunidades das empresas |
| `/api/activities` | Atividades das empresas |
| `/api/proposals` | Propostas das empresas |
| `/api/contracts` | Contratos das empresas |
| `/api/products` | Produtos das empresas |
| `/api/dashboard` | Dashboard das empresas |
| `/api/b2g/*` | Módulo B2G das empresas |
| `/api/pre-vendas/*` | Módulo Pré-Vendas das empresas |

## Como Testar

### 1. Login como MASTER
```
Email: master@crm.com
Senha: master123
```

### 2. Verificar Sidebar
- ✅ Deve mostrar apenas "Administração"
- ❌ Não deve mostrar B2B, B2G, Pré-Vendas, etc

### 3. Acessar Gestão de Empresas
- Vá em Administração → Gestão de Empresas
- ✅ Deve ver lista de empresas
- ✅ Deve ver informações básicas (nome, CNPJ, plano, status)

### 4. Tentar Acessar Dados Operacionais
- Tente acessar diretamente: `/dashboard`, `/empresas`, `/oportunidades`
- ❌ Deve ser bloqueado (403 Forbidden)
- ❌ Mensagem: "MASTER não tem acesso a dados operacionais das empresas"

## Diferença entre MASTER e ADMIN

| Característica | MASTER | ADMIN |
|----------------|--------|-------|
| **Escopo** | Sistema inteiro | Uma empresa |
| **tenantCompanyId** | `null` | ID da empresa |
| **Ver empresas** | ✅ Todas | ❌ Nenhuma |
| **Dados operacionais** | ❌ Nenhum | ✅ Da sua empresa |
| **Licenciamento** | ✅ Gerenciar | ❌ Apenas visualizar |
| **Criar empresas** | ✅ Sim | ❌ Não |
| **Criar usuários** | ✅ MASTER | ✅ Da sua empresa |

## Segurança

### Proteção em Camadas

1. **Frontend (Sidebar)**
   - Filtra menus visíveis
   - Primeira linha de defesa (UX)

2. **Backend (Middleware)**
   - Valida cada requisição
   - Bloqueia acesso não autorizado
   - Retorna 403 Forbidden

3. **Banco de Dados**
   - MASTER não tem `tenantCompanyId`
   - Queries filtram por empresa automaticamente

### Mensagens de Erro

```json
{
  "error": "MASTER não tem acesso a dados operacionais das empresas"
}
```

## Conclusão

✅ MASTER agora tem acesso restrito
✅ Vê apenas Administração no menu
✅ Pode gerenciar empresas e licenças
✅ Não pode acessar dados operacionais
✅ Backend bloqueia tentativas de acesso
✅ Segurança em múltiplas camadas

O usuário MASTER agora funciona como um super-administrador do sistema multi-tenant, com visibilidade de todas as empresas mas sem acesso aos dados internos de cada uma.
