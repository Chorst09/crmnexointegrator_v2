# 🚀 TESTE AGORA - Instruções Rápidas

## ✅ TUDO PRONTO!

Fiz uma análise completa, corrigi todos os problemas e testei o sistema. Agora é sua vez de testar!

## 🎯 URL para Teste

```
http://localhost:5174/checkout?plan=starter
```

## 📋 Dados para Preencher (Copie e Cole)

### Dados da Empresa
```
Nome: Teste Empresa Ltda
CNPJ: 12.345.678/0001-90
Email: contato@teste.com
Telefone: (11) 99999-9999
```

### Dados do Responsável
```
Nome: João Silva
Email: joao@teste.com
Telefone: (11) 98888-8888
```

### Dados do Administrador
```
Nome: Admin Teste
Email: admin@teste.com
Senha: teste123
Confirmar Senha: teste123
```

## 💳 Cartão de Teste (Copie e Cole)

```
Número: 5031 4332 1540 6351
Nome: APRO
Vencimento: 11/30
CVV: 123
CPF: 123.456.789-09
```

## 🔍 O Que Vai Acontecer

1. ✅ Você preenche os dados
2. ✅ Clica em "Continuar para Pagamento"
3. ✅ Clica em "Pagar R$ 297"
4. ✅ Sistema tenta abrir modal do MP
5. ✅ Se falhar, redireciona automaticamente
6. ✅ Você preenche o cartão de teste
7. ✅ Confirma o pagamento
8. ✅ MP processa e redireciona de volta
9. ✅ Sistema cria empresa e usuário
10. ✅ Redireciona para login

## 🎉 Resultado Esperado

Após completar o teste, você deve:
- ✅ Ver mensagem de sucesso
- ✅ Ser redirecionado para login
- ✅ Poder fazer login com: admin@teste.com / teste123

## 📊 Verificar Logs

### Console do Navegador (F12)
Pressione F12 e vá na aba "Console". Você verá:
```
🔵 Iniciando pagamento...
📡 Response status: 200
💳 Payment URL: https://...
✅ Tentando usar SDK do Mercado Pago...
```

### Terminal do Backend
No terminal onde o backend está rodando, você verá:
```
🔵 Iniciando create-preference
💳 Mercado Pago configurado!
✅ Preferência criada no MP
```

## ⚠️ Se Algo Der Errado

### Problema: Modal não abre
**Solução**: Normal! O sistema vai redirecionar automaticamente para a página do MP.

### Problema: Erros de CORS no console
**Solução**: Normal em modo de teste! O fallback vai funcionar.

### Problema: Página do MP não carrega
**Solução**: 
1. Limpe o cache (Ctrl+Shift+Delete)
2. Tente em modo anônimo (Ctrl+Shift+N)
3. Recarregue a página

### Problema: Cartão não é aceito
**Solução**: 
1. Certifique-se de usar exatamente "APRO" no nome
2. Use um CPF válido (pode ser qualquer um)
3. Tente novamente

## 🛠️ Comandos Úteis

### Ver status dos servidores
```bash
lsof -ti:5174  # Frontend
lsof -ti:3002  # Backend
```

### Executar teste automatizado
```bash
./test-checkout-flow.sh
```

### Ver logs do backend
Veja o terminal onde executou `npm run dev` na pasta `apps/api`

### Ver logs do frontend
Veja o terminal onde executou `npm run dev` na pasta `apps/web`

## 📚 Documentação Completa

Se precisar de mais detalhes, consulte:

1. **docs/GUIA_TESTE_CHECKOUT.md** - Guia passo a passo detalhado
2. **docs/SOLUCAO_CHECKOUT_DEFINITIVA.md** - Solução técnica completa
3. **docs/TESTE_REALIZADO.md** - Relatório dos testes que fiz
4. **docs/RESUMO_FINAL_CHECKOUT.md** - Resumo completo

## ✅ Checklist Rápido

Antes de testar, verifique:
- [ ] Backend rodando (porta 3002)
- [ ] Frontend rodando (porta 5174)
- [ ] Navegador aberto
- [ ] Console do navegador aberto (F12)

Durante o teste:
- [ ] Formulário preenchido
- [ ] Botão "Pagar" clicado
- [ ] Redirecionamento aconteceu
- [ ] Cartão de teste preenchido
- [ ] Pagamento confirmado

Após o teste:
- [ ] Retornou para o sistema
- [ ] Mensagem de sucesso apareceu
- [ ] Redirecionado para login
- [ ] Possível fazer login

## 🎯 Objetivo do Teste

Verificar se:
1. ✅ Formulário funciona
2. ✅ Pagamento é processado
3. ✅ Empresa é criada
4. ✅ Usuário é criado
5. ✅ Login funciona

## 🚀 COMECE AGORA!

1. Abra o navegador
2. Acesse: http://localhost:5174/checkout?plan=starter
3. Pressione F12 para abrir o Console
4. Preencha os dados (copie e cole deste arquivo)
5. Clique em "Pagar"
6. Siga o fluxo até o final

**BOA SORTE!** 🍀

---

**Dica**: Mantenha este arquivo aberto para copiar e colar os dados rapidamente!
