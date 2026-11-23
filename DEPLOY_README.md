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
6. Se falhar: rollback automático

---

### Manual (quando precisar)

Você pode disparar o deploy manualmente no GitHub:

1. Acesse: https://github.com/Chorst09/crmnexointegrator_v2/actions
2. Clique em **"Deploy to Production"** (lado esquerdo)
3. Clique no botão **"Run workflow"**
4. Escolha a branch `main` e clique em **"Run workflow"**

---

### Acompanhar o deploy

1. Acesse: https://github.com/Chorst09/crmnexointegrator_v2/actions
2. Veja os logs em tempo real
3. Deploy demora cerca de **2-3 minutos**

---

## 🔐 Segredos configurados (GitHub Secrets)

Estes secrets já devem estar configurados em:  
https://github.com/Chorst09/crmnexointegrator_v2/settings/secrets/actions

- **`VPS_HOST`**: `209.50.241.25`
- **`VPS_USER`**: `root`
- **`VPS_SSH_KEY`**: chave privada RSA (nunca commitada no código)

---

## ⚙️ Configuração inicial (uma única vez)

### 1. Gerar chave SSH na VPS

```bash
ssh root@209.50.241.25

# Gerar chave
ssh-keygen -t ed25519 -f ~/.ssh/github_actions -N "" -C "github-actions"

# Ver chave privada (copiar TUDO)
cat ~/.ssh/github_actions

# Ver chave pública
cat ~/.ssh/github_actions.pub

# Adicionar ao authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 2. Adicionar secrets no GitHub

Acesse: https://github.com/Chorst09/crmnexointegrator_v2/settings/secrets/actions

Crie 3 secrets:

| Nome | Valor |
|------|-------|
| `VPS_HOST` | `209.50.241.25` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Conteúdo completo de `~/.ssh/github_actions` (chave privada) |

### 3. Testar

Faça um commit simples:

```bash
echo "# Test" >> README.md
git add README.md
git commit -m "test: GitHub Actions"
git push origin main
```

Acompanhe em: https://github.com/Chorst09/crmnexointegrator_v2/actions

---

## 📝 Fluxo de trabalho diário

### Desenvolvimento normal:

```bash
# 1. Fazer mudanças no código
vim apps/web/src/pages/Dashboard.jsx

# 2. Commitar
git add .
git commit -m "feat: Atualizar dashboard"

# 3. Push (dispara deploy automático)
git push origin main
```

**Pronto!** Deploy acontece automaticamente em 2-3 minutos.

---

## 🔧 Troubleshooting

### Deploy falhou?

1. Ver logs no GitHub Actions
2. Rollback é automático (versão anterior restaurada)
3. Corrigir o problema e fazer novo push

### Deploy manual na VPS (emergência)

```bash
ssh root@209.50.241.25
bash /opt/nexos-icp-github/deploy/icp/quick-deploy.sh
```

### Ver status do container

```bash
ssh root@209.50.241.25
docker ps -f name=nexos-icp
docker logs nexos-icp --tail 50
```

---

## ✅ Vantagens do GitHub Actions

- ✅ Deploy automático no push
- ✅ Logs centralizados
- ✅ Rollback automático se falhar
- ✅ Zero downtime
- ✅ Histórico completo de deploys
- ✅ Pode executar manualmente quando precisar

---

## 🌐 URLs

- **Produção:** https://nexos.chorstconsult.com.br
- **GitHub Actions:** https://github.com/Chorst09/crmnexointegrator_v2/actions
- **Repositório:** https://github.com/Chorst09/crmnexointegrator_v2
