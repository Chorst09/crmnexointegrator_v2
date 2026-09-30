# Criar Usuário MASTER

## Problema
O banco de dados não está rodando na porta 5434, então não podemos executar o seed.

## Solução Manual

### Opção 1: Executar SQL Direto no Banco

Se você tiver acesso ao banco de dados, execute este SQL:

```sql
-- Criar usuário MASTER
INSERT INTO "User" (
  id,
  name,
  email,
  password,
  role,
  quota,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Master Admin',
  'chorstconsult@gmail.com',
  '$2a$10$YourHashedPasswordHere', -- Senha: <ADMIN_PASSWORD>
  'MASTER',
  999999,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;
```

### Opção 2: Iniciar o Banco de Dados

1. **Verificar se o Docker está rodando:**
   ```bash
   docker ps
   ```

2. **Iniciar o banco de dados:**
   ```bash
   docker-compose up -d postgres
   # ou
   docker start nome-do-container-postgres
   ```

3. **Executar o seed:**
   ```bash
   cd apps/api
   npx prisma db seed
   ```

### Opção 3: Usar a Interface de Administração

Depois que o login funcionar:
1. Faça login com um usuário admin existente
2. Vá em "Administração" → "Usuários"
3. Crie manualmente o usuário:
   - Nome: Master Admin
   - Email: chorstconsult@gmail.com
   - Senha: <ADMIN_PASSWORD>
   - Role: MASTER

## Senha Hash (bcrypt)

A senha `<ADMIN_PASSWORD>` com bcrypt (10 rounds) gera um hash como:
```
$2a$10$[hash_aqui]
```

Para gerar o hash correto, você pode usar:

```javascript
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('<ADMIN_PASSWORD>', 10);
console.log(hash);
```

## Verificar se o Banco Está Rodando

```bash
# Verificar processos do PostgreSQL
ps aux | grep postgres

# Verificar portas em uso
lsof -i :5434

# Verificar containers Docker
docker ps -a | grep postgres
```

## Sobre o Erro de Login

O erro "Could not establish connection" que você está vendo no navegador é porque:

1. **O servidor da API não está respondendo** - Verifique se está rodando na porta 3002
2. **O banco de dados não está acessível** - Precisa estar na porta 5434
3. **Variáveis de ambiente incorretas** - Verifique o arquivo `.env`

## Próximos Passos

1. **Iniciar o banco de dados:**
   ```bash
   # Se usar Docker
   docker-compose up -d
   
   # Ou verificar o status
   docker ps
   ```

2. **Verificar se a API está rodando:**
   ```bash
   # Deve estar rodando na porta 3002
   curl http://localhost:3002/api/health
   ```

3. **Executar o seed:**
   ```bash
   cd apps/api
   npx prisma db seed
   ```

4. **Testar o login:**
   - Email: chorstconsult@gmail.com
   - Senha: <ADMIN_PASSWORD>

## Arquivo Modificado

- ✅ `apps/api/prisma/seed.cjs` - Adicionado usuário MASTER no início do seed
