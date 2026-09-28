# Checkout - Pagamento Corrigido

## Problema Identificado

O erro no pagamento estava ocorrendo porque:

1. **Banco de dados incorreto**: O arquivo `.env.local` da API estava configurado para conectar na porta 5435 (banco de teste), mas o banco correto está na porta 5432
2. **Credenciais do Mercado Pago**: Não estavam configuradas no `.env.local` da API
3. **URL do frontend**: Estava configurada para porta 5174, mas o frontend roda na porta 5173

## Correções Aplicadas

### 1. Configuração do Banco de Dados
- Atualizado `apps/api/.env.local` para usar porta 5432
- DATABASE_URL: `postgresql://crm:crm123@localhost:5432/crm?schema=public`

### 2. Credenciais do Mercado Pago
Adicionadas no `apps/api/.env.local`:
```env
MERCADO_PAGO_PUBLIC_KEY=TEST-ea423066-0567-48a7-800c-f1a39833ce5e
MERCADO_PAGO_ACCESS_TOKEN=TEST-295373260675697-121217-6e2dd435f6708fc53d0de81b5627652a-606002420
MERCADO_PAGO_WEBHOOK_TOKEN=webhook_secure_token_2026_mp_crm_b2g_production
```

### 3. URLs Corrigidas
```env
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:3002
```

### 4. Melhorias no Backend
- Adicionados logs detalhados no endpoint `/api/checkout/create-preference`
- Resposta padronizada com `paymentUrl` e `initPoint` para compatibilidade
- Logs mostram cada etapa do processo de criação da preferência no Mercado Pago

### 5. Logs no Frontend
O frontend já possui logs detalhados que mostram:
- Status da resposta da API
- Dados brutos recebidos
- Dados processados
- URL de pagamento extraída

## Como Testar

### 1. Verificar Servidores
```bash
# Backend deve estar rodando na porta 3002
lsof -ti:3002

# Frontend deve estar rodando na porta 5173
lsof -ti:5173
```

### 2. Testar Endpoint Diretamente
```bash
curl -X POST http://127.0.0.1:3002/api/checkout/create-preference \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "starter",
    "companyData": {
      "companyName": "Teste Empresa",
      "document": "12345678000190",
      "email": "teste@empresa.com",
      "phone": "(11) 99999-9999",
      "responsibleName": "João Teste",
      "responsibleEmail": "joao@empresa.com",
      "responsiblePhone": "(11) 98888-8888"
    }
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "subscriptionId": "uuid-aqui",
  "paymentUrl": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=...",
  "initPoint": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=...",
  "preferenceId": "606002420-..."
}
```

### 3. Testar no Navegador

1. Acesse: http://localhost:5173
2. Clique em "Começar Agora" ou vá para `/checkout?plan=starter`
3. Preencha os dados da empresa e do responsável
4. Preencha os dados do usuário administrador
5. Clique em "Continuar para Pagamento"
6. Clique em "Pagar R$ 297"
7. Abra o Console do navegador (F12) e verifique os logs:
   - `🔵 Iniciando pagamento...`
   - `📡 Response status: 200`
   - `📦 Resposta bruta: {...}`
   - `📦 Dados processados: {...}`
   - `💳 Payment URL: https://www.mercadopago.com.br/...`
   - `✅ Redirecionando para Mercado Pago...`

### 4. Verificar Logs do Backend

No terminal onde o backend está rodando, você verá:
```
🔵 Iniciando create-preference
   Plan ID: starter
   Company: Nome da Empresa
   MP Token presente: true
   MP Token length: 70
💳 Mercado Pago configurado! Criando preferência de pagamento...
   Access Token: TEST-295373260675697...
📤 Enviando preferência para MP: {...}
✅ Preferência criada no MP: 606002420-...
   Init Point: https://www.mercadopago.com.br/...
✅ Retornando resposta com paymentUrl
   paymentUrl: https://www.mercadopago.com.br/...
📤 Response final: {...}
```

## Fluxo Completo do Pagamento

1. **Usuário preenche dados** → Frontend valida
2. **Clica em "Pagar"** → Frontend chama `/api/checkout/create-preference`
3. **Backend cria registro** → Salva no banco como `PENDING`
4. **Backend chama Mercado Pago** → Cria preferência de pagamento
5. **Backend retorna URL** → `paymentUrl` com link do MP
6. **Frontend salva no localStorage** → Dados para confirmação posterior
7. **Frontend redireciona** → Usuário vai para página do Mercado Pago
8. **Usuário paga** → Mercado Pago processa pagamento
9. **MP redireciona de volta** → `/checkout?status=success&payment_id=...`
10. **Frontend confirma** → Chama `/api/licensing/public/checkout/confirm`
11. **Backend cria empresa e usuário** → Conta ativada
12. **Redireciona para login** → Usuário pode fazer login

## Credenciais de Teste do Mercado Pago

As credenciais configuradas são de **TESTE** do Mercado Pago:
- Não processam pagamentos reais
- Permitem testar o fluxo completo
- Podem ser usadas em desenvolvimento

Para usar em produção, você precisará:
1. Criar conta no Mercado Pago
2. Obter credenciais de produção
3. Atualizar as variáveis de ambiente

## Status Atual

✅ Backend conectando no banco correto (porta 5432)
✅ Credenciais do Mercado Pago configuradas
✅ Endpoint criando preferências no MP com sucesso
✅ Frontend com logs detalhados
✅ URLs corrigidas (frontend na 5173)
✅ Resposta padronizada com `paymentUrl` e `initPoint`

## Próximos Passos

1. Testar o fluxo completo no navegador
2. Verificar se o redirecionamento para o Mercado Pago funciona
3. Testar o retorno após pagamento
4. Verificar se a empresa e usuário são criados corretamente

## Observações

- Os erros de CORS que aparecem no console são normais do Mercado Pago
- O importante é verificar se o `paymentUrl` é recebido e o redirecionamento acontece
- Todos os logs estão ativos para facilitar o debug
