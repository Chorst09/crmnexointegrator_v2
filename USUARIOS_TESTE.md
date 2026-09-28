# 👥 Usuários de Teste - CRM NEXOS

## 🔐 Credenciais de Acesso

Todos os usuários abaixo foram criados no seed do banco de dados e estão prontos para uso.

---

## 🎖️ MASTER (Acesso Total)

### Master Admin
- **Email**: `chorstconsult@gmail.com`
- **Senha**: `<ADMIN_PASSWORD>`
- **Role**: MASTER
- **Acesso**: Todas as funcionalidades do sistema
- **Rota após login**: `/administracao`

**Permissões**:
- ✅ Dashboard completo
- ✅ Administração de usuários
- ✅ Administração de licenciamento
- ✅ Billing e integrações
- ✅ Acesso B2B, B2G e Pré-Vendas
- ✅ Todas as oportunidades (não apenas as suas)
- ✅ Relatórios estratégicos
- ✅ Precificação e documentação

---

## 👨‍💼 ADMIN (Administrador)

### Administrador
- **Email**: `admin@crm.com`
- **Senha**: `admin123`
- **Role**: ADMIN
- **Quota**: 100.000
- **Rota após login**: `/dashboard`

**Permissões**:
- ✅ Dashboard
- ✅ Gestão de leads e oportunidades
- ✅ Administração de usuários (limitada)
- ✅ Relatórios
- ✅ Acesso B2B e B2G

---

## 💼 SELLERS (Vendedores)

### 1. João Silva
- **Email**: `joao@crm.com`
- **Senha**: `vendedor123`
- **Role**: SELLER
- **Região**: São Paulo (SP)
- **Quota**: 50.000
- **Rota após login**: `/oportunidades`

### 2. Maria Santos
- **Email**: `maria@crm.com`
- **Senha**: `vendedor123`
- **Role**: SELLER
- **Região**: São Paulo (SP)
- **Quota**: 45.000
- **Rota após login**: `/oportunidades`

### 3. Carlos Oliveira
- **Email**: `carlos@crm.com`
- **Senha**: `vendedor123`
- **Role**: SELLER
- **Região**: Região Sul (SUL)
- **Quota**: 40.000
- **Rota após login**: `/oportunidades`

### 4. Ana Costa
- **Email**: `ana@crm.com`
- **Senha**: `vendedor123`
- **Role**: SELLER
- **Região**: Rio de Janeiro (RJ)
- **Quota**: 35.000
- **Rota após login**: `/oportunidades`

**Permissões dos Vendedores**:
- ✅ Dashboard (visão limitada)
- ✅ Gestão de leads
- ✅ Oportunidades (apenas as suas)
- ✅ Atividades
- ✅ Produtos
- ✅ Propostas
- ⚠️ Sem acesso à administração

---

## 🧪 Como Testar Cada Usuário

### Teste Manual (Interface Web)
1. Acesse: http://localhost:5174
2. Clique em "Entrar"
3. Use as credenciais de qualquer usuário acima
4. Verifique a rota de redirecionamento
5. Explore as funcionalidades disponíveis

### Teste via API (curl)
```bash
# Exemplo: Login do MASTER
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"chorstconsult@gmail.com","password":"<ADMIN_PASSWORD>"}'

# Exemplo: Login de um vendedor
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@crm.com","password":"vendedor123"}'
```

---

## 📊 Comparação de Permissões

| Funcionalidade | MASTER | ADMIN | SELLER |
|----------------|--------|-------|--------|
| Dashboard | ✅ Completo | ✅ Completo | ✅ Limitado |
| Leads | ✅ Todos | ✅ Todos | ✅ Seus |
| Oportunidades | ✅ Todas | ✅ Todas | ⚠️ Apenas suas |
| Administração de Usuários | ✅ Total | ✅ Limitada | ❌ Não |
| Licenciamento | ✅ Sim | ❌ Não | ❌ Não |
| Billing | ✅ Sim | ❌ Não | ❌ Não |
| Integrações | ✅ Sim | ✅ Sim | ❌ Não |
| Relatórios Estratégicos | ✅ Sim | ✅ Sim | ⚠️ Limitado |
| Precificação | ✅ Sim | ✅ Sim | ⚠️ Limitado |
| B2B | ✅ Sim | ✅ Sim | ✅ Sim |
| B2G | ✅ Sim | ✅ Sim | ✅ Sim |
| Pré-Vendas | ✅ Sim | ✅ Sim | ✅ Sim |

---

## 🎯 Cenários de Teste Recomendados

### Cenário 1: Fluxo Completo do MASTER
1. Login como `chorstconsult@gmail.com`
2. Acessar `/administracao`
3. Criar novo usuário
4. Gerenciar licenças
5. Visualizar todos os relatórios

### Cenário 2: Fluxo do Vendedor
1. Login como `joao@crm.com`
2. Acessar `/oportunidades`
3. Criar nova oportunidade
4. Adicionar atividade
5. Gerar proposta

### Cenário 3: Fluxo do Admin
1. Login como `admin@crm.com`
2. Acessar `/dashboard`
3. Visualizar métricas gerais
4. Gerenciar usuários da equipe
5. Acessar relatórios

---

## 🔄 Redefinir Senha (Recuperação)

Para testar a recuperação de senha:
1. Clique em "Esqueci minha senha"
2. Informe o email
3. Digite a nova senha
4. Confirme a nova senha
5. Informe o código de recuperação (solicite ao administrador)

---

## 📝 Notas Importantes

1. **Senhas Hasheadas**: Todas as senhas são armazenadas com bcrypt (10 rounds)
2. **Token JWT**: Válido por 7 dias após o login
3. **Quotas**: Representam metas de vendas dos vendedores
4. **Regiões**: Vendedores são associados a regiões específicas
5. **Permissões**: Definidas automaticamente com base no role

---

## 🚀 Comandos Úteis

### Listar Todos os Usuários
```bash
PGPASSWORD=crm123 psql -h localhost -p 5434 -U crm -d crm \
  -c "SELECT email, role, name FROM \"User\" ORDER BY role, email;"
```

### Verificar Permissões de um Usuário
```bash
# Após login, use o token para verificar
curl http://localhost:3002/api/auth/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### Resetar Senha de um Usuário (via SQL)
```bash
# Exemplo: resetar senha do admin para "novasenha123"
PGPASSWORD=crm123 psql -h localhost -p 5434 -U crm -d crm \
  -c "UPDATE \"User\" SET password = '\$2a\$10\$...' WHERE email = 'admin@crm.com';"
```

---

## 🎉 Status

- ✅ 6 usuários criados
- ✅ 3 roles diferentes (MASTER, ADMIN, SELLER)
- ✅ 3 regiões configuradas
- ✅ Permissões definidas
- ✅ Todos testados e funcionando

---

**Última Atualização**: 06/04/2026  
**Status**: ✅ PRONTO PARA USO
