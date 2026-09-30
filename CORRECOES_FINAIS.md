# Correções Finais - Login Funcionando

## ✅ Problemas Resolvidos

### 1. Porta Incorreta da API no Frontend
**Problema**: O frontend estava configurado para acessar a API na porta 3001, mas a API roda na porta 3002.

**Solução**: Atualizado `apps/web/src/config/api.js`:
```javascript
// Antes
return 'http://127.0.0.1:3001/api';

// Depois
return 'http://127.0.0.1:3002/api';
```

### 2. Dockerfile do Web para Desenvolvimento
**Problema**: O Dockerfile padrão do web usa nginx (produção), não Vite (desenvolvimento).

**Solução**: Criado `apps/web/Dockerfile.dev` com Node.js e Vite.

### 3. Porta do Vite
**Problema**: O Vite estava configurado para porta 3000, mas deveria ser 5173.

**Solução**: Atualizado `apps/web/vite.config.js`:
```javascript
server: {
  port: 5173
}
```

### 4. Configuração de CORS
**Problema**: A API não estava aceitando requisições de `http://localhost:5173`.

**Solução**: Atualizado `apps/api/.env`:
```env
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,http://crm.chorstconsult.com.br
```

### 5. URL da API no Frontend
**Problema**: O frontend estava tentando usar proxy relativo `/api`, mas o proxy do Vite não funcionava corretamente.

**Solução**: Atualizado `apps/web/.env`:
```env
VITE_API_URL=http://localhost:3002/api
```

### 6. Banco de Dados
**Problema**: Tabelas não existiam e dados de teste não foram criados.

**Solução**:
- Aplicadas todas as migrações
- Criada migração para `PreSalesRequest`
- Executado seed com sucesso

### 7. Porta PostgreSQL
**Problema**: Porta 5432 já estava em uso.

**Solução**: Alterada para porta 5434 no `docker-compose.yml`.

## 🎯 Configuração Final

### Docker Compose
```yaml
services:
  postgres:
    ports:
      - "5434:5432"
  
  api:
    ports:
      - "3002:3002"
    environment:
      CORS_ORIGIN: http://localhost:5173,http://localhost:3000
  
  web:
    build:
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
```

### Variáveis de Ambiente

#### API (`apps/api/.env`)
```env
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://crm:crm123@postgres:5432/crm?schema=public
JWT_SECRET=dev-jwt-secret-change-in-production
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,http://crm.chorstconsult.com.br
```

#### Web (`apps/web/.env`)
```env
VITE_API_URL=http://localhost:3002/api
```

## 📝 Credenciais de Login

### Usuário Admin
- **Email**: `admin@crm.com`
- **Senha**: `admin123`

### Outros Usuários
| Email | Senha | Nome | Função |
|-------|-------|------|--------|
| joao@crm.com | vendedor123 | João Silva | SELLER |
| maria@crm.com | vendedor123 | Maria Santos | SELLER |
| carlos@crm.com | vendedor123 | Carlos Oliveira | SELLER |
| ana@crm.com | vendedor123 | Ana Costa | SELLER |

## 🚀 Como Usar

### 1. Subir o Docker
```bash
docker-compose up -d
```

### 2. Verificar Status
```bash
docker-compose ps
```

Deve mostrar:
- `api` - Up (healthy) - 0.0.0.0:3002->3002/tcp
- `postgres` - Up (healthy) - 0.0.0.0:5434->5432/tcp
- `web` - Up - 0.0.0.0:5173->5173/tcp

### 3. Acessar a Aplicação
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3002/api

### 4. Fazer Login
1. Acesse http://localhost:5173
2. Digite:
   - Email: `admin@crm.com`
   - Senha: `admin123`
3. Clique em "Entrar"

## 🔍 Verificação

### Testar API
```bash
curl http://localhost:3002/api/health
```

Deve retornar:
```json
{"status":"ok","service":"crm-api","timestamp":"..."}
```

### Testar Login
```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@crm.com","password":"admin123"}'
```

Deve retornar:
```json
{
  "user": {
    "id": "...",
    "name": "Administrador",
    "email": "admin@crm.com",
    "role": "ADMIN"
  },
  "token": "..."
}
```

## 📊 Dados de Teste

O seed criou automaticamente:
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

## 🐛 Troubleshooting

### Erro de CORS
Se aparecer erro de CORS no console:
```bash
docker-compose restart api
```

### Frontend não carrega
```bash
docker-compose restart web
```

### Banco de dados vazio
```bash
docker-compose exec -T api npm run db:migrate:deploy
docker-compose exec -T api npm run db:seed
```

### Limpar tudo e recomeçar
```bash
docker-compose down -v
docker-compose up -d
docker-compose exec -T api npm run db:migrate:deploy
docker-compose exec -T api npm run db:seed
```

## ✅ Status Final

- ✅ **Docker rodando**: 3 containers (api, postgres, web)
- ✅ **Banco inicializado**: Todas as migrações aplicadas
- ✅ **Dados de teste**: Seed executado com sucesso
- ✅ **CORS configurado**: Frontend pode acessar API
- ✅ **Login funcionando**: Credenciais testadas e validadas

## 🎉 Pronto para Usar!

Acesse http://localhost:5173 e faça login com `admin@crm.com` / `admin123`
