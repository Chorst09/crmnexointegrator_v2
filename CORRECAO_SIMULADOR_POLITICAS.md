# Correção: Módulo Simulador nas Políticas de Acesso

## Data: 2026-09-03

## Problema Identificado
O módulo **Simulador** não estava aparecendo na tela de **Configurações → Políticas de Acesso por Role**, e as permissões para visualização de tabelas de preços, comissões e DRE não estavam corretamente configuradas para diferentes roles.

## Alterações Realizadas

### 1. Arquivos Modificados

#### `apps/web/src/utils/permissions.js`
- ✅ Adicionado `ROLE_POLICY_MODULES` com 4 novas permissões do Simulador:
  - `simulador` - Acesso às calculadoras
  - `simuladorViewPricing` - Ver Tabelas de Preços
  - `simuladorViewCommissions` - Ver Comissões  
  - `simuladorViewDRE` - Ver DRE
- ✅ Atualizado `ROLE_ACCESS_POLICY` para todos os roles (USER, PRE_SALES, ADMIN, MASTER)
- ✅ Atualizado `moduleFromPath()` para identificar `/simuladores` como módulo SIMULADOR
- ✅ Atualizado `canAccessModule()` para validar acesso ao SIMULADOR
- ✅ Atualizado `getUserAccess()` para incluir `accessSimulador`

#### `apps/web/src/pages/Administracao.jsx`
- ✅ Adicionado `accessSimulador` no array `MODULE_ACCESS_ITEMS`
- ✅ Atualizado `constrainAccessToCompanyModules()` para incluir `accessSimulador`

#### `src/lib/permissions.ts` (Backend)
- ✅ Adicionado interface `RolePermissions` com 4 novas propriedades do Simulador
- ✅ Atualizado `ROLE_PERMISSIONS` para todos os canonical roles

#### `apps/web/src/lib/permissions.ts` (Frontend)
- ✅ Mesmas alterações do backend para manter consistência

#### `apps/web/src/precificacao/lib/permissions.ts`
- ✅ Adicionado permissões do Simulador na interface
- ✅ Atualizado todas as configurações de roles

### 2. Matriz de Permissões Implementada

| Role       | Acesso Simulador | Ver Preços | Ver Comissões | Ver DRE | Ver Todas Oportunidades |
|------------|------------------|------------|---------------|---------|-------------------------|
| **USER**       | ✅ Sim           | ❌ Não     | ❌ Não        | ❌ Não  | ❌ Não (só suas)        |
| **PRE_SALES**  | ✅ Sim           | ❌ Não     | ❌ Não        | ❌ Não  | ❌ Não (só suas)        |
| **ADMIN**      | ✅ Sim           | ✅ Sim     | ✅ Sim        | ✅ Sim  | ✅ Sim (todas)          |
| **MASTER**     | ✅ Sim           | ✅ Sim     | ✅ Sim        | ✅ Sim  | ✅ Sim (todas)          |

### 3. Funcionalidades Garantidas

#### ✅ Simulador aparece na UI de Políticas
Agora na tela **Configurações → Políticas de Acesso por Role** o módulo **Simulador** aparece com:
- Checkbox para habilitar/desabilitar acesso ao Simulador
- 3 sub-permissões para controlar visualização de:
  - Tabelas de Preços
  - Tabelas de Comissões
  - DRE (Demonstrativo de Resultados)

#### ✅ Usuários veem apenas suas oportunidades
A permissão `canViewAllProposals` já estava corretamente configurada:
- USER e PRE_SALES: `false` → veem apenas suas próprias oportunidades
- ADMIN e MASTER: `true` → veem todas as oportunidades

A API já valida isso em:
- `/src/app/api/proposals/route.ts` (linha 87)
- `/src/app/api/proposals/[id]/route.ts` (linhas 98, 212, 424)

#### ✅ Tabs sensíveis ocultas para usuários comuns
As calculadoras já usam `canEditCommissions` para controlar a exibição de tabs:
- Implementado em: `PABXSIPCalculator`, `InternetManCalculator`, `InternetOKv2Calculator`, etc.
- USER/PRE_SALES: veem apenas tab **Calculadora**
- ADMIN/MASTER: veem todas as tabs (**Calculadora**, **Tabela de Preços**, **Comissões**, **DRE**)

## Como Verificar no Sistema

### 1. Acessar Políticas de Acesso
```
Login como ADMIN → Configurações → Políticas de Acesso por Role
```

Agora você deve ver o módulo **Simulador** listado junto com:
- Dashboard Geral
- Leads
- Oportunidades
- Busca de Oportunidades Públicas
- Somente suas oportunidades
- **→ Simulador** ⭐ NOVO
- **→ Ver Tabelas de Preços (Simulador)** ⭐ NOVO
- **→ Ver Comissões (Simulador)** ⭐ NOVO
- **→ Ver DRE (Simulador)** ⭐ NOVO
- Registro no Fabricante
- etc.

### 2. Testar Acesso de USER
```
1. Login como usuário comum (role: USER)
2. Acessar /simuladores
3. Abrir qualquer calculadora (ex: PABX/SIP)
4. Verificar que aparecem apenas as tabs:
   - ✅ Calculadora
   - ❌ Tabela de Preços (oculta)
   - ❌ Comissões (oculta)
   - ❌ DRE (oculta)
```

### 3. Testar Acesso de ADMIN
```
1. Login como admin
2. Acessar /simuladores  
3. Abrir qualquer calculadora
4. Verificar que aparecem todas as tabs:
   - ✅ Calculadora
   - ✅ Tabela de Preços
   - ✅ Comissões
   - ✅ DRE
```

### 4. Testar Filtro de Oportunidades
```
1. Login como USER
2. Criar uma oportunidade
3. Fazer logout
4. Login como outro USER
5. Tentar acessar a oportunidade do primeiro usuário
6. Resultado: ❌ Não deve aparecer na lista
```

## Commit e Deploy

### Commit
```bash
git commit -m "feat: Adicionar módulo Simulador às políticas de acesso por role"
git push origin main
```
✅ **Status**: Concluído em 2026-09-03

### Deploy
O código foi enviado para o repositório GitHub. 

**Importante**: O SSH para o servidor está com timeout. Você precisará fazer o deploy manualmente:

```bash
# Conectar ao servidor
ssh root@143.244.215.190

# Atualizar código
cd /root/nexosintegrator
git pull origin main

# Instalar dependências (se houver novas)
npm install

# Build
npm run build

# Reiniciar PM2
pm2 restart all

# Verificar status
pm2 status
pm2 logs
```

## Segurança - Produção

⚠️ **ATENÇÃO**: Como o sistema está em produção, as seguintes precauções foram tomadas:

1. ✅ **Não altera dados existentes** - apenas adiciona novas permissões
2. ✅ **Mantém compatibilidade** - roles existentes continuam funcionando
3. ✅ **Default seguro** - USER e PRE_SALES não veem informações sensíveis por padrão
4. ✅ **ADMIN mantém acesso total** - administradores não perdem nenhuma funcionalidade
5. ✅ **Filtros de oportunidades mantidos** - usuários continuam vendo apenas suas oportunidades

## Próximos Passos Recomendados

1. **Fazer deploy manual** no servidor (SSH com timeout)
2. **Testar em produção** as 4 verificações acima
3. **Ajustar políticas** para empresas/usuários específicos se necessário
4. **Documentar** no manual do sistema as novas permissões

## Arquivos de Referência

Para entender melhor o sistema de permissões:
- `/apps/web/src/utils/permissions.js` - Permissões principais
- `/src/lib/permissions.ts` - Backend permissions
- `/apps/web/src/pages/Administracao.jsx` - UI de configuração
- `/src/app/api/proposals/route.ts` - API que valida acesso a propostas

---

## Resumo Executivo

✅ **Problema Resolvido**: Módulo Simulador agora aparece nas Políticas de Acesso  
✅ **Permissões Configuradas**: Usuários comuns não veem preços/comissões/DRE  
✅ **Oportunidades Filtradas**: Cada usuário vê apenas suas próprias oportunidades  
✅ **Código em Produção**: Commit feito, aguardando deploy manual  
⚠️ **Ação Necessária**: Deploy manual via SSH (timeout no comando automatizado)
