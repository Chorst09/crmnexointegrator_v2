# 🧪 TESTE DO MODO SIMULADO - Passo a Passo

## ✅ Sistema Pronto para Teste

O modo simulado está ativo e funcionando. Agora você pode testar o checkout completo sem usar o Mercado Pago.

## 🚀 Como Testar (5 minutos)

### 1. Abra o Navegador
- Abra o Chrome ou Firefox
- Pressione **F12** para abrir o Console (importante!)
- Vá na aba **Console**

### 2. Acesse o Checkout
```
http://localhost:5173/checkout?plan=starter
```

### 3. Preencha os Dados

#### Dados da Empresa
```
Nome: Minha Empresa Teste
CNPJ: 11.222.333/0001-44
Email: empresa@teste.com
Telefone: (11) 99999-9999
```

#### Dados do Responsável
```
Nome: João Silva
Email: joao@teste.com
Telefone: (11) 98888-8888
```

#### Dados do Administrador
```
Nome: Admin Teste
Email: admin@teste.com
Senha: teste123
Confirmar Senha: teste123
```

### 4. Clique em "Continuar para Pagamento"

### 5. Clique em "Pagar R$ 297"

### 6. Observe o Console (F12)

Você deve ver estes logs:
```
🔵 Iniciando pagamento...
📡 Response status: 200
📦 Resposta bruta: {simulated: true, ...}
✅ Modo simulado - Criando conta diretamente...
📤 Chamando API de confirmação...
   Endpoint: http://127.0.0.1:3002/api/licensing/public/checkout/confirm
   Plan ID: plan-mensal
   Plan Code: MENSAL
📦 Payload: {...}
📡 Confirm response status: 200
✅ Resposta da confirmação: {...}
✅ Conta criada com sucesso!
```

### 7. Aguarde o Redirecionamento

O sistema vai redirecionar automaticamente para a página de login.

### 8. Faça Login

Use as credenciais que você criou:
```
Email: admin@teste.com
Senha: teste123
```

### 9. Pronto!

Você deve estar logado no sistema com a empresa criada!

## 🔍 O Que Verificar

### No Console do Navegador (F12)
- ✅ Logs aparecem em ordem
- ✅ Status 200 em todas as requisições
- ✅ Nenhum erro vermelho
- ✅ Mensagem "Conta criada com sucesso!"

### No Terminal do Backend
Você deve ver:
```
🔵 Iniciando create-preference
⚠️  Modo simulado ativado
✅ Retornando resposta simulada
```

### No Sistema
- ✅ Redirecionado para login
- ✅ Possível fazer login
- ✅ Dashboard carrega
- ✅ Empresa aparece no sistema

## ❌ Se Der Erro

### Erro: "Plano não encontrado"
**Solução**: Os planos padrão não foram criados. Execute:
```bash
cd apps/api
npx prisma db seed
```

### Erro: "404 Not Found"
**Solução**: Backend não está rodando. Execute:
```bash
cd apps/api
npm run dev
```

### Erro: "Network Error"
**Solução**: Verifique se o backend está na porta 3002:
```bash
lsof -ti:3002
```

### Erro: "Email já cadastrado"
**Solução**: Use um email diferente ou delete a empresa do banco:
```sql
DELETE FROM "User" WHERE email = 'admin@teste.com';
DELETE FROM "TenantCompany" WHERE email = 'empresa@teste.com';
```

## 📊 Verificar no Banco de Dados

Após o teste, você pode verificar se foi criado:

### Empresa
```sql
SELECT * FROM "TenantCompany" ORDER BY "createdAt" DESC LIMIT 1;
```

### Usuário Admin
```sql
SELECT * FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" DESC LIMIT 1;
```

### Licença
```sql
SELECT * FROM "CompanyLicense" ORDER BY "createdAt" DESC LIMIT 1;
```

## 🎯 Resultado Esperado

Após completar o teste:

1. ✅ Empresa criada no banco
2. ✅ Usuário admin criado
3. ✅ Licença ativa criada
4. ✅ Possível fazer login
5. ✅ Dashboard funciona
6. ✅ Sem erros no console

## 🔄 Testar Novamente

Para testar novamente com dados diferentes:

1. Use um **CNPJ diferente**
2. Use um **email diferente**
3. Ou delete os dados anteriores do banco

## 📝 Checklist de Teste

- [ ] Backend rodando (porta 3002)
- [ ] Frontend rodando (porta 5173)
- [ ] Console do navegador aberto (F12)
- [ ] Formulário preenchido
- [ ] Botão "Pagar" clicado
- [ ] Logs aparecem no console
- [ ] Status 200 nas requisições
- [ ] Redirecionado para login
- [ ] Login funciona
- [ ] Dashboard carrega

## 🆘 Precisa de Ajuda?

Se algo não funcionar:

1. **Copie os logs** do console (F12)
2. **Copie os logs** do terminal do backend
3. **Me envie** para eu analisar
4. **Tire um print** da tela se houver erro visual

## 🎉 Sucesso!

Se tudo funcionou, você agora tem:
- ✅ Checkout funcionando em modo simulado
- ✅ Criação automática de empresas
- ✅ Sistema pronto para desenvolvimento
- ✅ Sem dependência do Mercado Pago para testes

---

**Última atualização**: 25 de Janeiro de 2026
**Status**: ✅ PRONTO PARA TESTE
**Modo**: 🧪 SIMULADO (sem Mercado Pago)
