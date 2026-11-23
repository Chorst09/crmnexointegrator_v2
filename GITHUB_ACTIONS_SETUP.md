# GitHub Actions - Configuração de Deploy Automático

## 🎯 O que é GitHub Actions?

GitHub Actions permite automatizar o deploy toda vez que você faz `git push` para a branch `main`. O deploy acontece automaticamente no servidor sem precisar executar scripts manualmente.

---

## 📋 Pré-requisitos

1. ✅ Repositório no GitHub: `github.com/Chorst09/crmnexointegrator_v2`
2. ✅ VPS configurada (209.50.241.25)
3. ✅ Container Docker funcionando
4. ⚠️ Chave SSH privada (vamos gerar)

---

## 🔐 Passo 1: Gerar Chave SSH para GitHub Actions

### Na VPS:

```bash
# Conectar na VPS
ssh root@209.50.241.25

# Gerar chave SSH específica para GitHub Actions
ssh-keygen -t ed25519 -f ~/.ssh/github_actions_deploy -N "" -C "github-actions-deploy"

# Ver chave privada (copie TODO o conteúdo)
cat ~/.ssh/github_actions_deploy

# Ver chave pública
cat ~/.ssh/github_actions_deploy.pub

# Adicionar chave pública ao authorized_keys
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Testar chave (deve conectar sem pedir senha)
ssh -i ~/.ssh/github_actions_deploy root@127.0.0.1 "echo 'SSH OK'"
```

---

## 🔑 Passo 2: Adicionar Chave ao GitHub Secrets

1. **Acesse:** https://github.com/Chorst09/crmnexointegrator_v2/settings/secrets/actions

2. **Clique em:** "New repository secret"

3. **Nome do Secret:** `SSH_PRIVATE_KEY`

4. **Value:** Cole o conteúdo COMPLETO da chave privada (output de `cat ~/.ssh/github_actions_deploy`)
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
   ...
   (várias linhas)
   ...
   -----END OPENSSH PRIVATE KEY-----
   ```

5. **Clique em:** "Add secret"

---

## ✅ Passo 3: Verificar Workflow

O arquivo `.github/workflows/deploy-icp.yml` já foi criado com o seguinte fluxo:

```
Push to main
    ↓
GitHub Actions iniciado
    ↓
1. Conecta na VPS via SSH
2. Faz git pull do código
3. Build da imagem Docker
4. Para container antigo
5. Inicia novo container
6. Aguarda health check (60s)
7. Testa endpoints
8. Limpa containers antigos
    ↓
Deploy concluído ✓
```

**Se falhar:** Rollback automático para versão anterior

---

## 🚀 Passo 4: Testar Deploy Automático

### Teste Simples:

```bash
# Na sua máquina local
cd crmnexointegrator_v2-main

# Fazer uma pequena mudança
echo "# Test" >> README.md

# Commit e push
git add README.md
git commit -m "test: GitHub Actions deploy"
git push origin main
```

### Acompanhar Deploy:

1. Vá para: https://github.com/Chorst09/crmnexointegrator_v2/actions
2. Clique no workflow "Deploy to ICP VPS"
3. Acompanhe os logs em tempo real

**Tempo esperado:** 3-5 minutos

---

## 📊 Status do Deploy

### Via GitHub:

- ✅ **Badge verde:** Deploy OK
- ❌ **Badge vermelho:** Deploy falhou (rollback automático)

### Via VPS:

```bash
ssh root@209.50.241.25

# Ver release atual
cat /opt/nexos-icp-config/current-release

# Ver logs do container
docker logs nexos-icp --tail 50

# Testar health
curl http://127.0.0.1:3015/api/health
```

---

## 🔧 Troubleshooting

### Erro: "Permission denied (publickey)"

**Causa:** Chave SSH não foi adicionada corretamente aos Secrets.

**Solução:**
1. Verificar que copiou TODO o conteúdo da chave privada (incluindo BEGIN/END)
2. Verificar que o nome do secret é exatamente `SSH_PRIVATE_KEY`
3. Verificar que a chave pública está em `~/.ssh/authorized_keys` na VPS

### Erro: "Health check timeout"

**Causa:** Container não iniciou corretamente.

**Solução:**
```bash
ssh root@209.50.241.25
docker logs nexos-icp --tail 100

# Verificar banco de dados
docker ps -f name=postgresql_17
docker exec postgresql_17 psql -U nexos_icp -d nexos_icp -c "SELECT 1;"
```

### Erro: "Build failed"

**Causa:** Erro no código ou dependências.

**Solução:**
1. Ver logs do build no GitHub Actions
2. Testar build localmente:
   ```bash
   docker build --target runtime -f Dockerfile.icp -t test .
   ```

### Deploy manual após falha:

```bash
ssh root@209.50.241.25
bash /opt/nexos-icp-github/deploy/icp/quick-deploy.sh
```

---

## 🎛️ Configuração Avançada

### Deploy apenas em horários específicos

Edite `.github/workflows/deploy-icp.yml`:

```yaml
on:
  push:
    branches:
      - main
  schedule:
    # Deploy automático todo dia às 3h da manhã
    - cron: '0 3 * * *'
  workflow_dispatch:  # Permite trigger manual
```

### Deploy com aprovação manual

Adicione antes do job `deploy`:

```yaml
jobs:
  approval:
    runs-on: ubuntu-latest
    environment: production  # Requer configurar environment no GitHub
    steps:
      - name: Wait for approval
        run: echo "Waiting for manual approval..."
  
  deploy:
    needs: approval
    runs-on: ubuntu-latest
    # ... resto do deploy
```

### Notificações por Email

Adicione ao final do workflow:

```yaml
      - name: Notify success
        if: success()
        run: |
          echo "Deploy succeeded" | mail -s "NEXOS Deploy OK" seu@email.com

      - name: Notify failure
        if: failure()
        run: |
          echo "Deploy failed" | mail -s "NEXOS Deploy FAILED" seu@email.com
```

---

## 🔒 Segurança

### ✅ O que está seguro:

- Chave SSH privada armazenada em GitHub Secrets (criptografada)
- Sem senhas no código ou logs
- Chave SSH específica para deploy (não usa sua chave pessoal)
- Conexão SSH criptografada
- Logs do GitHub não expõem credenciais

### ⚠️ Boas práticas:

1. **Rotação de chaves:** Trocar chave SSH a cada 6 meses
2. **Logs de acesso:** Monitorar `/var/log/auth.log` na VPS
3. **Limitar acesso:** Chave SSH usada apenas pelo GitHub Actions
4. **Auditoria:** Revisar histórico de deploys no GitHub

### 🔐 Rotação da chave SSH:

```bash
# Gerar nova chave
ssh-keygen -t ed25519 -f ~/.ssh/github_actions_deploy_new -N ""

# Adicionar nova chave
cat ~/.ssh/github_actions_deploy_new.pub >> ~/.ssh/authorized_keys

# Atualizar secret no GitHub
# (usar conteúdo de github_actions_deploy_new)

# Após confirmar que funciona, remover chave antiga
sed -i '/github-actions-deploy/d' ~/.ssh/authorized_keys
rm ~/.ssh/github_actions_deploy ~/.ssh/github_actions_deploy.pub
mv ~/.ssh/github_actions_deploy_new ~/.ssh/github_actions_deploy
```

---

## 📝 Workflow Manual (Sem GitHub Actions)

Se preferir não usar GitHub Actions, continue usando os scripts:

```bash
# Deploy automático local → VPS
./deploy/icp/auto-deploy.sh "Mensagem do commit"

# Deploy rápido na VPS
ssh root@209.50.241.25
bash /opt/nexos-icp-github/deploy/icp/quick-deploy.sh
```

---

## 🎓 Fluxo de Trabalho Recomendado

### Desenvolvimento:

```bash
# 1. Fazer mudanças localmente
vim apps/web/src/pages/Dashboard.jsx

# 2. Testar localmente (opcional)
npm run dev

# 3. Commit e push
git add .
git commit -m "feat: Atualizar dashboard"
git push origin main

# 4. GitHub Actions faz deploy automaticamente
# Acompanhar em: github.com/Chorst09/crmnexointegrator_v2/actions
```

### Hotfix em Produção:

```bash
# Opção 1: Via GitHub (mais seguro)
# Editar arquivo direto no GitHub web
# Push dispara deploy automático

# Opção 2: Deploy direto na VPS (mais rápido)
ssh root@209.50.241.25
cd /opt/nexos-icp-github
git pull origin main
bash deploy/icp/quick-deploy.sh
```

---

## 📊 Monitoramento

### Ver histórico de deploys:

**GitHub:** https://github.com/Chorst09/crmnexointegrator_v2/actions

**VPS:**
```bash
ssh root@209.50.241.25

# Release atual
cat /opt/nexos-icp-config/current-release

# Histórico de imagens
docker images | grep nexos-icp

# Logs de deploy
ls -lh /tmp/build-*.log
```

### Métricas de deploy:

```bash
# Tempo médio de deploy
# Ver duração no GitHub Actions > Workflow runs

# Taxa de sucesso
# Ver histórico verde/vermelho no GitHub Actions
```

---

## ✅ Checklist Final

Antes de ativar GitHub Actions, confirme:

- [ ] Chave SSH gerada na VPS
- [ ] Chave privada adicionada a GitHub Secrets (nome: `SSH_PRIVATE_KEY`)
- [ ] Chave pública em `~/.ssh/authorized_keys` na VPS
- [ ] Teste SSH manual funcionando
- [ ] Arquivo `.github/workflows/deploy-icp.yml` commitado
- [ ] Primeiro deploy de teste realizado com sucesso
- [ ] Rollback testado (simular falha)
- [ ] Monitoramento configurado

---

## 🎉 Pronto!

Após configurar, todo `git push` para `main` dispara deploy automático.

**URL de Produção:** https://nexos.chorstconsult.com.br

**Logs de Deploy:** https://github.com/Chorst09/crmnexointegrator_v2/actions

**Tempo de Deploy:** ~3-5 minutos

**Zero Downtime:** ✅ Container antigo só é removido após novo estar healthy

**Rollback Automático:** ✅ Se novo container falhar, restaura anterior
