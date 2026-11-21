# NEXOS CRM - Guia de Segurança

## 🔒 Status de Segurança Atual

### ✅ Implementado e Seguro

1. **Credenciais de Banco**
   - Armazenadas em `/opt/nexos-icp-config/app.env` (permissão 600)
   - Senha PostgreSQL com 16+ caracteres
   - JWT_SECRET com 32+ caracteres aleatórios
   - Não expostas em logs ou código

2. **Container Docker**
   - Isolamento via rede `icontainer-network`
   - Porta 3015 apenas em localhost (`127.0.0.1`)
   - Não exposto diretamente à internet
   - Volumes persistentes para uploads

3. **SSL/TLS**
   - Certificado Let's Encrypt válido
   - TLS 1.2+ apenas
   - HSTS habilitado (max-age=31536000)
   - HTTP/2 ativo

4. **Senhas de Usuário**
   - Bcrypt com salt de 12 rounds
   - Nunca armazenadas em plaintext
   - Hash irreversível

5. **Proxy Reverso**
   - Nginx gerenciado pelo ICP
   - Rate limiting (configuração ICP)
   - Headers de segurança

### ⚠️ Vulnerabilidades e Ações Necessárias

#### 1. CRÍTICO: Senha Root SSH

**Problema:** Senha root foi mencionada em configurações anteriores.

**Ação Imediata:**
```bash
# Conectar via SSH
ssh root@209.50.241.25

# Trocar senha
passwd

# Digite nova senha forte:
# - Mínimo 16 caracteres
# - Letras maiúsculas e minúsculas
# - Números e símbolos
# - Exemplo: Nx!2026#Vps$Sec@R3
```

#### 2. MÉDIO: Acesso SSH Sem Restrição de IP

**Problema:** SSH está aberto para qualquer IP.

**Mitigação (Opcional):**
```bash
# Instalar firewall
apt update && apt install ufw -y

# Permitir apenas seu IP (substitua YOUR_IP)
ufw allow from YOUR_IP to any port 22

# Permitir HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Ativar firewall
ufw enable
```

#### 3. BAIXO: Logs Podem Expor Dados

**Problema:** `docker logs` podem conter informações sensíveis.

**Mitigação:**
```bash
# Configurar log rotation
cat > /etc/logrotate.d/docker-nexos <<'EOF'
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size=10M
  missingok
  delaycompress
  copytruncate
}
EOF

# Testar configuração
logrotate -d /etc/logrotate.d/docker-nexos
```

---

## 🛡️ Hardening Recomendado

### 1. Fail2Ban (Proteção contra Brute Force)

```bash
# Instalar fail2ban
apt install fail2ban -y

# Configurar para SSH
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
EOF

# Iniciar
systemctl enable fail2ban
systemctl start fail2ban

# Verificar status
fail2ban-client status sshd
```

### 2. Desabilitar Login Root Direto (Após criar usuário sudo)

```bash
# Criar usuário não-root
adduser nexosadmin
usermod -aG sudo nexosadmin

# Copiar chave SSH (se usar)
mkdir -p /home/nexosadmin/.ssh
cp /root/.ssh/authorized_keys /home/nexosadmin/.ssh/
chown -R nexosadmin:nexosadmin /home/nexosadmin/.ssh
chmod 700 /home/nexosadmin/.ssh
chmod 600 /home/nexosadmin/.ssh/authorized_keys

# Desabilitar root login
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd

# Testar login com novo usuário ANTES de desconectar!
ssh nexosadmin@209.50.241.25
```

### 3. Configurar Backup Automático

```bash
# Script de backup diário
cat > /usr/local/bin/backup-nexos.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/root/backups-nexos"
DATE=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

# Backup do banco
docker exec postgresql_17 pg_dump -U nexos_icp nexos_icp | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# Backup dos uploads
tar czf "$BACKUP_DIR/uploads-$DATE.tar.gz" -C /var/lib/docker/volumes nexos-icp-uploads nexos-icp-attachments

# Manter apenas últimos 30 dias
find "$BACKUP_DIR" -name "*.gz" -mtime +30 -delete

echo "Backup concluído: $DATE"
EOF

chmod +x /usr/local/bin/backup-nexos.sh

# Agendar no cron (3h da manhã)
echo "0 3 * * * /usr/local/bin/backup-nexos.sh >> /var/log/nexos-backup.log 2>&1" | crontab -
```

### 4. Monitoramento de Integridade

```bash
# Instalar AIDE (Advanced Intrusion Detection Environment)
apt install aide -y

# Inicializar banco de dados
aideinit

# Copiar para produção
cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Verificar mudanças (executar periodicamente)
aide --check
```

---

## 🚀 Scripts de Deploy Criados

### 1. Deploy Automático (Local → VPS)

**Arquivo:** `deploy/icp/auto-deploy.sh`

**Uso:**
```bash
# Na sua máquina local
cd crmnexointegrator_v2-main
chmod +x deploy/icp/auto-deploy.sh

# Deploy com mensagem personalizada
./deploy/icp/auto-deploy.sh "Correção no dashboard B2B"

# Deploy com mensagem automática
./deploy/icp/auto-deploy.sh
```

**Recursos:**
- ✅ Detecta mudanças no Git
- ✅ Commit e push automático
- ✅ Deploy remoto via SSH
- ✅ Health checks
- ✅ Rollback automático em caso de falha
- ✅ Não expõe credenciais

### 2. Deploy Rápido (Direto na VPS)

**Arquivo:** `deploy/icp/quick-deploy.sh`

**Uso:**
```bash
# Na VPS (via SSH)
ssh root@209.50.241.25
bash /opt/nexos-icp-github/deploy/icp/quick-deploy.sh
```

**Recursos:**
- ✅ Verifica updates do GitHub
- ✅ Build e deploy em uma etapa
- ✅ Health checks
- ✅ Rollback automático

---

## 📝 Checklist de Segurança

Execute este checklist periodicamente (mensal):

```bash
# 1. Atualizar sistema
apt update && apt upgrade -y

# 2. Verificar usuários com acesso
cat /etc/passwd | grep -E 'bash|sh$'

# 3. Verificar processos suspeitos
ps aux | grep -v '\[' | sort -nrk 3,3 | head -20

# 4. Verificar conexões de rede
netstat -tunlp | grep LISTEN

# 5. Verificar logs de autenticação
tail -50 /var/log/auth.log

# 6. Verificar containers rodando
docker ps -a

# 7. Verificar tamanho dos backups
du -sh /root/backups-nexos/*

# 8. Testar endpoint de saúde
curl -v https://nexos.chorstconsult.com.br/api/health

# 9. Verificar certificado SSL
echo | openssl s_client -connect nexos.chorstconsult.com.br:443 2>/dev/null | openssl x509 -noout -dates

# 10. Verificar espaço em disco
df -h
```

---

## 🔐 Política de Senhas

### Senhas Atuais no Sistema

| Tipo | Onde Está | Permissão | Rotação |
|------|-----------|-----------|---------|
| Root SSH | Conhecimento | N/A | Trocar agora |
| PostgreSQL nexos_icp | /opt/nexos-icp-config/app.env | 600 (root) | Anual |
| JWT_SECRET | /opt/nexos-icp-config/app.env | 600 (root) | Anual |
| Master User (app) | Banco (hash bcrypt) | N/A | Conforme necessário |

### Rotação de Senha PostgreSQL

```bash
# 1. Gerar nova senha
NEW_PASS=$(openssl rand -base64 24)
echo "Nova senha: $NEW_PASS"

# 2. Alterar no PostgreSQL
docker exec postgresql_17 psql -U postgres -d postgres -c "ALTER USER nexos_icp PASSWORD '$NEW_PASS';"

# 3. Atualizar app.env
# URL-encode a senha
NEW_PASS_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$NEW_PASS'))")

# Editar app.env
nano /opt/nexos-icp-config/app.env
# Substituir DATABASE_URL=postgresql://nexos_icp:OLD_PASS@... por:
# DATABASE_URL=postgresql://nexos_icp:$NEW_PASS_ENCODED@postgresql_17:5432/nexos_icp?schema=public

# 4. Reiniciar container
docker restart nexos-icp

# 5. Verificar
curl http://127.0.0.1:3015/api/health
```

---

## 🚨 Resposta a Incidentes

### Container Comprometido

```bash
# 1. Parar container
docker stop nexos-icp

# 2. Investigar logs
docker logs nexos-icp --tail 1000 > /tmp/incident-logs.txt

# 3. Fazer backup forense
docker commit nexos-icp nexos-icp-forensics-$(date +%s)

# 4. Remover container comprometido
docker rm nexos-icp

# 5. Verificar banco de dados
docker exec postgresql_17 psql -U nexos_icp -d nexos_icp -c "\dt"

# 6. Deploy limpo
bash /opt/nexos-icp-github/deploy/icp/quick-deploy.sh

# 7. Trocar todas as credenciais (senhas, JWT_SECRET)
```

### Banco de Dados Comprometido

```bash
# 1. Dump completo
docker exec postgresql_17 pg_dumpall -U postgres > /tmp/full-backup-$(date +%s).sql

# 2. Analisar acessos suspeitos
docker exec postgresql_17 psql -U postgres -d nexos_icp -c "SELECT * FROM pg_stat_activity;"

# 3. Trocar senha PostgreSQL (ver seção acima)

# 4. Auditar tabela User
docker exec postgresql_17 psql -U nexos_icp -d nexos_icp -c "SELECT email, role, \"createdAt\" FROM \"User\" ORDER BY \"createdAt\" DESC LIMIT 20;"
```

---

## 📞 Contatos de Emergência

- **Hosting:** ICP Container (https://vps8561.panel.icontainer.cloud:2090)
- **GitHub:** github.com/Chorst09/crmnexointegrator_v2
- **Certificado SSL:** Let's Encrypt (renovação automática via ICP)

---

## ✅ Resumo: O que Fazer AGORA

1. **CRÍTICO - Trocar senha root SSH:**
   ```bash
   ssh root@209.50.241.25
   passwd
   ```

2. **Instalar Fail2Ban:**
   ```bash
   apt install fail2ban -y
   systemctl enable fail2ban
   systemctl start fail2ban
   ```

3. **Configurar backup automático:**
   ```bash
   # Copiar script de backup da seção acima
   ```

4. **Testar scripts de deploy:**
   ```bash
   chmod +x deploy/icp/auto-deploy.sh
   chmod +x deploy/icp/quick-deploy.sh
   ```

5. **Documentar nova senha root em local seguro** (gerenciador de senhas)

---

**Após implementar estas medidas, o sistema estará em conformidade com boas práticas de segurança.**
