# Deploy NEXOS CRM

## 🚀 Como funciona o deploy via GitHub Actions

### Automático (já configurado)

Sempre que você fizer push para a branch `main`, o deploy acontece automaticamente:

```bash
git add .
git commit -m "sua mensagem"
git push origin main
```

**O GitHub Actions vai:**
1. Clonar o código no servidor
2. Fazer build da imagem Docker
3. Parar o container antigo
4. Iniciar o novo container
5. Verificar se está funcionando

---

### Manual (quando precisar)

Você pode disparar o deploy manualmente no GitHub:

1. Acesse: https://github.com/Chorst09/crmnexointegrator_v2/actions
2. Clique em **"Deploy to Production"** (lado esquerdo)
3. Clique no botão **"Run workflow"**
4. Escolha a branch `main` e clique em **"Run workflow"**

---

### Acompanhar o deploy

- Acesse: https://github.com/Chorst09/crmnexointegrator_v2/actions
- Veja os logs em tempo real
- Deploy demora cerca de **2-3 minutos**

---

## 🔐 Segredos configurados (GitHub Secrets)

- **VPS_HOST**: `209.50.241.25`
- **VPS_USER**: `root`
- **VPS_SSH_KEY**: chave privada ED25519 (nunca commitada no código)

---

## ✅ Tudo seguro!

A chave SSH não está gravada em nenhum lugar do repositório ou workflows.

---

## 🌐 URL de Produção

https://nexos.chorstconsult.com.br
