# Credenciais de Login - CRM Comercial

## ✅ Ambiente Local (Docker)

### URL de Acesso
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3002/api

### Usuário Admin
- **Email**: `admin@crm.com`
- **Senha**: `admin123`
- **Função**: Administrador

### Outros Usuários Disponíveis

| Email | Senha | Nome | Função |
|-------|-------|------|--------|
| admin@crm.com | admin123 | Administrador | ADMIN |
| joao@crm.com | vendedor123 | João Silva | SELLER |
| maria@crm.com | vendedor123 | Maria Santos | SELLER |
| carlos@crm.com | vendedor123 | Carlos Oliveira | SELLER |
| ana@crm.com | vendedor123 | Ana Costa | SELLER |

## 🚀 Ambiente de Produção (Servidor)

### URL de Acesso
- **Frontend**: https://crm.chorstconsult.com.br
- **API**: https://crm.chorstconsult.com.br/api

### Usuário Admin
- **Email**: `admin@crm.com`
- **Senha**: `admin123`

## 📝 Notas Importantes

1. **Credenciais Padrão**: As credenciais acima são as padrões criadas pelo seed do banco de dados.

2. **Mudança de Senha**: Após o primeiro login, é recomendado mudar a senha do usuário admin.

3. **Novos Usuários**: Você pode criar novos usuários através da interface de administração.

4. **Banco de Dados Local**: 
   - Host: `postgres` (Docker) ou `localhost:5434` (local)
   - Database: `crm`
   - User: `crm`
   - Password: `crm123`

5. **Banco de Dados Produção**:
   - Host: `localhost`
   - Database: `crm_com`
   - User: `Chorstconsult`
   - Password: `<ADMIN_PASSWORD>`

## 🔧 Troubleshooting

### Erro "Erro de conexão. Tente novamente."

**Possíveis causas:**
1. API não está respondendo
2. Banco de dados não foi inicializado
3. Migrações não foram aplicadas
4. Seed não foi executado

**Solução:**
```bash
# 1. Verificar se os containers estão rodando
docker-compose ps

# 2. Aplicar migrações
docker-compose exec -T api npm run db:migrate:deploy

# 3. Executar seed
docker-compose exec -T api npm run db:seed

# 4. Reiniciar containers
docker-compose restart api
```

### Erro "Usuário ou senha inválidos"

**Possíveis causas:**
1. Email ou senha incorretos
2. Usuário não foi criado pelo seed

**Solução:**
- Verifique se o email está correto: `admin@crm.com`
- Verifique se a senha está correta: `admin123`
- Se o seed não foi executado, execute: `docker-compose exec -T api npm run db:seed`

## 📊 Dados de Teste

O seed cria automaticamente:
- ✅ 5 usuários (1 admin + 4 vendedores)
- ✅ 6 empresas com diferentes lead scores
- ✅ 3 produtos
- ✅ 6 oportunidades
- ✅ 3 atividades
- ✅ 2 comissões
- ✅ 3 regiões
- ✅ 3 concorrentes
- ✅ 4 templates de proposta
- ✅ 2 workflows avançados
- ✅ 2 onboardings
- ✅ 2 tickets de suporte
- ✅ 3 pesquisas NPS
- ✅ 2 alertas de churn
- ✅ 4 solicitações de pré-vendas

## 🎯 Próximos Passos

1. Faça login com `admin@crm.com` / `admin123`
2. Explore os dados de teste criados pelo seed
3. Crie novos usuários conforme necessário
4. Configure as integrações (WhatsApp, Email, VoIP)
5. Personalize os templates de proposta

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs: `docker-compose logs api`
2. Verifique a conexão com o banco: `docker-compose logs postgres`
3. Reinicie os containers: `docker-compose restart`
