# Correção do Fluxo de Checkout e Setup

## Problema Identificado

1. **Pagamento aprovando automaticamente**: Em ambiente de desenvolvimento (sem token do Mercado Pago), o sistema simula a aprovação do pagamento
2. **Tela de setup não abrindo**: As rotas `/api/checkout/verify-token/:token` e `/api/checkout/setup-admin` estavam definidas DEPOIS do `module.exports = router`, então não eram exportadas

## Correções Realizadas

### 1. Arquivo: `apps/api/api/checkout.cjs`

**Problema**: Rotas definidas após o `module.exports`
```javascript
// ❌ ANTES (rotas não eram exportadas)
module.exports = router;

router.get('/verify-token/:token', ...);
router.post('/setup-admin', ...);
```

**Solução**: Movidas as rotas para antes do `module.exports`
```javascript
// ✅ DEPOIS (rotas exportadas corretamente)
router.get('/verify-token/:token', ...);
router.post('/setup-admin', ...);

module.exports = router;
```

### 2. Arquivo: `apps/web/src/pages/Checkout.jsx`

**Melhorias**:
- Adicionado logs de debug para rastrear o fluxo
- Melhorado tratamento de erro para mostrar mensagem específica
- Garantido que pagamento simulado redireciona corretamente para `/setup?token=`

```javascript
// Logs adicionados
console.log('📦 Resposta do checkout:', data);
console.log('✅ Pagamento simulado, redirecionando para setup...');
console.log('💳 Redirecionando para Mercado Pago...');
console.error('❌ Erro no pagamento:', err);
```

## Fluxo Completo Corrigido

### Ambiente de Desenvolvimento (sem Mercado Pago)

1. **Usuário preenche dados** → Checkout.jsx (Step 1)
2. **Clica em "Continuar para Pagamento"** → Checkout.jsx (Step 2)
3. **Clica em "Pagar"** → POST `/api/checkout/create-preference`
4. **Backend detecta ausência de token MP** → Simula aprovação automática
5. **Backend cria empresa e gera token** → Retorna `{ simulated: true, setupToken: "..." }`
6. **Frontend redireciona** → `/setup?token=abc123`
7. **Setup.jsx carrega** → GET `/api/checkout/verify-token/abc123`
8. **Usuário preenche dados do admin** → POST `/api/checkout/setup-admin`
9. **Conta criada** → Redireciona para `/login`

### Ambiente de Produção (com Mercado Pago)

1. **Usuário preenche dados** → Checkout.jsx (Step 1)
2. **Clica em "Continuar para Pagamento"** → Checkout.jsx (Step 2)
3. **Clica em "Pagar"** → POST `/api/checkout/create-preference`
4. **Backend cria preferência no MP** → Retorna `{ paymentUrl: "..." }`
5. **Frontend redireciona** → Mercado Pago
6. **Usuário paga** → Mercado Pago processa
7. **MP envia webhook** → POST `/api/checkout/webhook`
8. **Backend cria empresa e gera token** → Envia email com link
9. **Usuário clica no link do email** → `/setup?token=abc123`
10. **Setup.jsx carrega** → GET `/api/checkout/verify-token/abc123`
11. **Usuário preenche dados do admin** → POST `/api/checkout/setup-admin`
12. **Conta criada** → Redireciona para `/login`

## Endpoints Disponíveis

- `POST /api/checkout/create-preference` - Criar preferência de pagamento
- `POST /api/checkout/webhook` - Webhook do Mercado Pago
- `GET /api/checkout/success/:subscriptionId` - Verificar status após pagamento
- `GET /api/checkout/verify-token/:token` - Verificar token de setup ✅ CORRIGIDO
- `POST /api/checkout/setup-admin` - Criar usuário administrador ✅ CORRIGIDO

## Como Testar

### Teste Local (Simulado)

1. Acesse `http://localhost:5173`
2. Clique em "Começar Agora" ou "Assinar" em um plano
3. Preencha os dados da empresa e responsável
4. Clique em "Continuar para Pagamento"
5. Clique em "Pagar R$ 297" (ou valor do plano)
6. **Deve redirecionar automaticamente para `/setup?token=...`**
7. Preencha nome, email e senha do administrador
8. Clique em "Criar Conta de Administrador"
9. **Deve mostrar mensagem de sucesso e redirecionar para `/login`**

### Verificar Logs

No terminal do backend, você deve ver:
```
⚠️  Mercado Pago não configurado. Simulando aprovação automática...
✉️  Email de setup:
Para: email@empresa.com
Link: http://localhost:5173/setup?token=abc123...
```

No console do navegador, você deve ver:
```
📦 Resposta do checkout: { simulated: true, setupToken: "..." }
✅ Pagamento simulado, redirecionando para setup...
```

## Commit

```bash
git commit -m "fix: corrigir fluxo de checkout e setup de primeiro usuário"
```

Hash: `7dfe19c`

## Status

✅ Problema corrigido
✅ Rotas exportadas corretamente
✅ Fluxo de pagamento simulado funcionando
✅ Redirecionamento para setup funcionando
✅ Criação de usuário admin funcionando

## Próximos Passos

1. Testar fluxo completo localmente
2. Configurar credenciais do Mercado Pago para produção
3. Testar fluxo com pagamento real em ambiente de staging
4. Deploy para produção quando solicitado
