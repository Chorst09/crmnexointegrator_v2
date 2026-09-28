# Teste de Login - Ambiente Local

## Status dos Serviços

✅ **PostgreSQL**: Rodando na porta 5434 (container Docker)
✅ **API**: Rodando em http://localhost:3002
✅ **Frontend**: Rodando em http://localhost:5173

## Testes Realizados

### 1. Teste de Conexão com a API
```bash
curl http://localhost:3002/api/health
```
**Resultado**: ✅ API respondendo corretamente

### 2. Teste de Login via curl
```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"email":"admin@crm.com","password":"admin123"}'
```
**Resultado**: ✅ Login bem-sucedido, token JWT gerado

### 3. Teste de CORS
```bash
curl -X OPTIONS http://localhost:3002/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST"
```
**Resultado**: ✅ CORS configurado corretamente

### 4. Teste de Acesso Autenticado
```bash
curl http://localhost:3002/api/dashboard \
  -H "Authorization: Bearer [TOKEN]"
```
**Resultado**: ✅ Dashboard retornando dados corretamente

## Credenciais de Teste

- **Email**: admin@crm.com
- **Senha**: admin123
- **Perfil**: ADMIN

## Como Testar no Navegador

1. Abra o navegador em: http://localhost:5173
2. Faça login com as credenciais acima
3. Você deve ser redirecionado para o dashboard

## Troubleshooting

Se o login não funcionar no navegador:

1. **Limpe o cache do navegador**: Cmd+Shift+R (Mac) ou Ctrl+Shift+R (Windows/Linux)
2. **Abra o Console do Navegador**: F12 ou Cmd+Option+I (Mac)
3. **Verifique erros no console**: Procure por erros de CORS ou conexão
4. **Verifique a aba Network**: Veja se a requisição está sendo enviada para http://localhost:3002/api/auth/login

## Configurações Atuais

### API (.env.local)
```
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://crm:crm123@localhost:5434/crm?schema=public
JWT_SECRET=dev-jwt-secret-change-in-production
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,http://localhost:3001,http://crm.chorstconsult.com.br
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3002/api
```

## Próximos Passos

Após confirmar que o login está funcionando no navegador, você pode:

1. Testar as funcionalidades de Calculadoras
2. Verificar o carrinho de propostas
3. Testar a criação de oportunidades
4. Explorar o dashboard

## Comandos Úteis

### Reiniciar API
```bash
# Parar processo atual
lsof -ti:3002 | xargs kill -9

# Iniciar novamente
cd apps/api && npm run dev
```

### Reiniciar Frontend
```bash
cd apps/web && npm run dev
```

### Ver logs da API
```bash
# Logs em tempo real
tail -f apps/api/logs/*.log
```

### Verificar banco de dados
```bash
docker exec -it crmautomatizadokvm-postgres-1 psql -U crm -d crm
```
