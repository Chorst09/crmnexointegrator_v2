# Deploy Automático - NEXOS CRM

## 🚀 Scripts Disponíveis

### 1. Deploy Automático (Recomendado)

Execute da sua máquina local para fazer commit, push e deploy automaticamente.

**Arquivo:** `deploy/icp/auto-deploy.sh`

```bash
# Uso básico (detecta mudanças automaticamente)
./deploy/icp/auto-deploy.sh

# Com mensagem de commit personalizada
./deploy/icp/auto-deploy.sh "Correção no dashboard B2B"

# Com mensagem detalhada
./deploy/icp/auto-deploy.sh "fix: Resolver erro 500 no endpoint /api/settings

- Corrigir query do Prisma
- Adicionar tratamento de erro
- Atualizar testes"
```

**O que faz:**
1. ✅ Detecta mudanças no Git
2. ✅ Solicita confirmação
3. ✅ Faz commit local
4. ✅ Push para GitHub
5. ✅ Conecta via SSH na VPS
6. ✅ Atualiza código na VPS
7. ✅ Build da imagem Docker
8. ✅ Deploy do novo container
9. ✅ Health checks automáticos
10. ✅ **Rollback automático se falhar**
11. ✅ Limpa containers antigos

**Tempo estimado:** 2-4 minutos

---

### 2. Deploy Rápido na VPS

Execute diretamente na VPS para atualizar sem precisar passar pela sua máquina local.

**Arquivo:** `deploy/icp/quick-deploy.sh`

```bash
# Conectar na VPS
ssh root@209.50.241.25

# Executar deploy
bash /opt/nexos-icp-github/deploy/icp/quick-deploy.sh
```

**O que faz:**
1. ✅ Verifica atualizações no GitHub
2. ✅ Faz pull do código
3. ✅ Build da imagem Docker
4. ✅ Deploy do novo container
5. ✅ Health checks
6. ✅ **Rollback automático se falhar**

**Tempo estimado:** 1-2 minutos

---

## 📋 Pré-requisitos

### Para `auto-deploy.sh` (Local)

1. **Git configurado:**
   ```bash
   git config --global user.name "Seu Nome"
   git config --global user.email "seu@email.com"
   ```

2. **Acesso SSH à VPS:**
   ```bash
   # Testar conexão
   ssh root@209.50.241.25 "echo 'Conectado!'"
   ```

3. **Script executável:**
   ```bash
   chmod +x deploy/icp/auto-deploy.sh
   ```

### Para `quick-deploy.sh` (VPS)

1. **Acesso SSH à VPS**
2. **Repositório clonado em `/opt/nexos-icp-github`**
3. **Docker rodando**

---

## 🎯 Fluxo de Trabalho Recomendado

### Desenvolvimento Local

```bash
# 1. Fazer mudanças no código
vim apps/web/src/pages/Dashboard.jsx

# 2. Testar localmente (opcional)
npm run dev

# 3. Deploy automático
./deploy/icp/auto-deploy.sh "feat: Atualizar dashboard"

# Aguardar conclusão (~3 min)
# ✓ Deploy concluído!
```

### Hotfix Rápido

```bash
# Cenário: Erro em produção, precisa corrigir AGORA

# 1. Corrigir no GitHub via web editor
# (ou via git na sua máquina e push manual)

# 2. Conectar na VPS
ssh root@209.50.241.25

# 3. Deploy rápido
bash /opt/nexos-icp-github/deploy/icp/quick-deploy.sh

# Pronto! (~1-2 min)
```

---

## 🔄 Rollback Manual

Se algo der errado e o rollback automático não funcionar:

```bash
# Conectar na VPS
ssh root@209.50.241.25

# Ver containers disponíveis
docker ps -a | grep nexos-icp

# Parar container atual
docker stop nexos-icp
docker rm nexos-icp

# Restaurar container anterior
prev_container=$(cat /opt/nexos-icp-config/previous-container)
docker rename "$prev_container" nexos-icp
docker start nexos-icp

# Verificar
docker logs nexos-icp --tail 20
curl http://127.0.0.1:3015/api/health
```

---

## 🛠️ Troubleshooting

### Erro: "Working tree is dirty"

**Causa:** Há mudanças não commitadas no repositório da VPS.

**Solução:**
```bash
ssh root@209.50.241.25
cd /opt/nexos-icp-github
git status
git reset --hard origin/main
```

### Erro: "Permission denied (publickey)"

**Causa:** Chave SSH não está configurada.

**Solução:**
```bash
# Configurar senha SSH temporariamente
# Ou configurar chave SSH:
ssh-copy-id root@209.50.241.25
```

### Erro: "Build failed"

**Causa:** Erro no código ou dependências.

**Solução:**
```bash
# Ver logs completos na VPS
ssh root@209.50.241.25
cat /tmp/build.log
```

### Container não fica healthy

**Causa:** Erro na aplicação ou banco de dados.

**Solução:**
```bash
# Ver logs do container
ssh root@209.50.241.25
docker logs nexos-icp --tail 100

# Verificar banco
docker exec postgresql_17 psql -U nexos_icp -d nexos_icp -c "SELECT 1"
```

---

## ⚙️ Configuração Avançada

### Variáveis de Ambiente (auto-deploy.sh)

```bash
# Customizar conexão SSH
export VPS_HOST="209.50.241.25"
export VPS_USER="root"
export VPS_PORT="22"

./deploy/icp/auto-deploy.sh
```

### Deploy Sem Confirmação (CI/CD)

```bash
# Para automação total (use com cuidado!)
yes | ./deploy/icp/auto-deploy.sh "Deploy automático CI/CD"
```

### Notificações por Email (Opcional)

Adicione ao final de `auto-deploy.sh`:

```bash
# Após a linha "info Deploy concluído com sucesso!"
echo "Deploy NEXOS CRM concluído" | mail -s "Deploy OK" seu@email.com
```

---

## 📊 Monitoramento Pós-Deploy

Após cada deploy, verifique:

```bash
# 1. Health check
curl https://nexos.chorstconsult.com.br/api/health

# 2. Login funciona
curl -X POST https://nexos.chorstconsult.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"chorstconsult@gmail.com","password":"Admin@2026"}'

# 3. Dashboard carrega
curl -I https://nexos.chorstconsult.com.br/

# 4. Logs do container
ssh root@209.50.241.25 "docker logs nexos-icp --tail 50"
```

---

## 🔐 Segurança

- ✅ Credenciais **nunca** são expostas nos scripts
- ✅ Senhas permanecem em `/opt/nexos-icp-config/app.env` (modo 600)
- ✅ Conexão SSH usa autenticação padrão do sistema
- ✅ Logs não contêm informações sensíveis
- ✅ Rollback automático protege contra deploys quebrados

**Leia:** `SEGURANCA.md` para guia completo de segurança.

---

## 📝 Exemplos de Uso

### Deploy após correção de bug

```bash
# Corrigir código
vim apps/api/api/dashboard.js

# Testar localmente
npm test

# Deploy
./deploy/icp/auto-deploy.sh "fix: Corrigir erro 500 no dashboard B2B"
```

### Deploy de nova feature

```bash
# Desenvolver feature
git checkout -b feature/nova-funcionalidade
# ... fazer mudanças ...
git commit -m "feat: Adicionar relatório de vendas"

# Merge na main
git checkout main
git merge feature/nova-funcionalidade

# Deploy
./deploy/icp/auto-deploy.sh "feat: Adicionar relatório de vendas

- Novo endpoint /api/reports/sales
- Interface no dashboard
- Gráficos interativos"
```

### Deploy emergencial

```bash
# Corrigir direto no GitHub (web editor)
# Depois na VPS:
ssh root@209.50.241.25
bash /opt/nexos-icp-github/deploy/icp/quick-deploy.sh
```

---

## 🎓 Boas Práticas

1. **Sempre teste localmente antes** (quando possível)
2. **Use mensagens de commit descritivas**
3. **Monitore logs após deploy**
4. **Mantenha backups atualizados**
5. **Documente mudanças significativas**
6. **Faça deploy em horário de menor uso** (se possível)
7. **Tenha um plano de rollback pronto**

---

## 📞 Suporte

- **Logs de deploy:** `/tmp/deploy.log` (VPS)
- **Logs da aplicação:** `docker logs nexos-icp`
- **Status do container:** `docker ps -f name=nexos-icp`
- **Painel ICP:** https://vps8561.panel.icontainer.cloud:2090

---

**Deploy com confiança! 🚀**
