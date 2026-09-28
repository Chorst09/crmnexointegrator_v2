# 🔧 Corrigir Erro 401 no Checkout

## ❌ Problema

Erro 401 ao tentar processar o pagamento. O erro real é:
```
Cannot read properties of undefined (reading 'create')
```

Isso significa que a tabela `PendingSubscription` não existe no banco de dados.

---

## ✅ Solução

Você precisa executar a migração do banco de dados para criar a tabela.

### 1. Iniciar o Docker

```bash
# Abrir o Docker Desktop
# Ou iniciar via terminal:
open -a Docker
```

Aguarde o Docker iniciar completamente (ícone na barra de menu).

### 2. Iniciar o Banco de Dados

```bash
# Na raiz do projeto
docker-compose up -d
```

Ou se já estiver rodando:
```bash
docker-compose start
```

### 3. Verificar se o Banco Está Rodando

```bash
docker ps | grep postgres
```

Deve mostrar algo como:
```
CONTAINER ID   IMAGE         PORTS                    NAMES
abc123...      postgres:15   0.0.0.0:5434->5432/tcp   crm-postgres
```

### 4. Executar a Migração

```bash
cd apps/api
npx prisma migrate dev --name add_pending_subscription
```

Você verá:
```
✔ Generated Prisma Client
✔ The migration has been created successfully
✔ Applied migration: add_pending_subscription
```

### 5. Reiniciar o Servidor da API

```bash
# Parar o servidor (Ctrl+C no terminal)
# Iniciar novamente:
npm run dev
```

### 6. Testar Novamente

Acesse: http://localhost:5174

1. Clique em "Ver Planos"
2. Escolha um plano
3. Preencha os dados
4. Clique em "Pagar"

Agora deve funcionar! ✅

---

## 🔍 Verificar se a Tabela Foi Criada

```bash
# Conectar ao banco
PGPASSWORD=crm123 psql -h localhost -p 5434 -U crm -d crm

# Verificar tabela
\dt PendingSubscription

# Ver estrutura
\d "PendingSubscription"

# Sair
\q
```

---

## 🧪 Testar o Endpoint Diretamente

```bash
curl -X POST http://localhost:3002/api/checkout/create-preference \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "starter",
    "companyData": {
      "companyName": "Teste Ltda",
      "document": "12.345.678/0001-90",
      "email": "teste@empresa.com",
      "phone": "(11) 99999-9999",
      "responsibleName": "João Silva",
      "responsibleEmail": "joao@teste.com",
      "responsiblePhone": "(11) 98888-8888"
    }
  }'
```

Resposta esperada:
```json
{
  "success": true,
  "simulated": true,
  "subscriptionId": "uuid-aqui",
  "setupToken": "token-aqui",
  "message": "Pagamento simulado aprovado (desenvolvimento)"
}
```

---

## ⚠️ Se o Docker Não Estiver Instalado

### Instalar Docker Desktop

1. Baixe: https://www.docker.com/products/docker-desktop
2. Instale o Docker Desktop
3. Abra o Docker Desktop
4. Aguarde inicializar
5. Volte para o passo 2 acima

### Alternativa: Usar PostgreSQL Local

Se preferir não usar Docker:

1. Instale PostgreSQL:
```bash
brew install postgresql@15
brew services start postgresql@15
```

2. Crie o banco:
```bash
createdb crm
```

3. Atualize o `.env`:
```bash
DATABASE_URL=postgresql://seu-usuario@localhost:5432/crm?schema=public
```

4. Execute a migração:
```bash
cd apps/api
npx prisma migrate dev
```

---

## 📋 Checklist

- [ ] Docker está rodando
- [ ] Banco de dados está rodando (porta 5434)
- [ ] Migração executada com sucesso
- [ ] Tabela `PendingSubscription` existe
- [ ] Servidor da API reiniciado
- [ ] Teste do endpoint funcionando
- [ ] Checkout funcionando no navegador

---

## 🚀 Após Corrigir

O sistema funcionará em **modo simulado**:
- Pagamento aprovado automaticamente
- Empresa criada
- Token de setup gerado
- Link aparece no console

Para usar o Mercado Pago de verdade, as credenciais já estão configuradas no `.env`!

---

**Status**: ⏳ Aguardando migração do banco  
**Próximo**: Testar checkout completo
