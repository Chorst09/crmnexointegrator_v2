# NEXOS CRM - Guia de Publicação na VPS via Docker/ICP

## 📋 Visão Geral

Este documento descreve o processo completo de publicação do **NEXOS CRM** na VPS da iContainer Cloud (ICP), usando Docker e GitHub Actions.

- **Domínio:** `nexos.chorstconsult.com.br`
- **Repositório:** `github.com/Chorst09/crmnexointegrator_v2` (branch: `main`)
- **VPS:** `209.50.241.25` (ICP Panel)
- **Infraestrutura:** Docker + Nginx Proxy + PostgreSQL compartilhado

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│        Usuário                           │
│   (navegador/cliente)                   │
└────────────────┬────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────┐
│     Nginx (ic-nginx-rv3m)               │
│     Host Network Mode                   │
│     ↓                                    │
│     Proxy: nexos.chorstconsult.com.br   │
│     → 127.0.0.1:3026                    │
└────────────────┬────────────────────────┘
                 │ HTTP localhost
                 ▼
┌─────────────────────────────────────────┐
│  NEXOS CRM Container (nexoscrm-api)    │
│  ├─ Frontend (Vite build)              │
│  ├─ Backend API (Express)              │
│  ├─ Prisma Client                      │
│  └─ Health Check (/health)             │
│                                         │
│  Network: icontainer-network            │
│  Port: 127.0.0.1:3026                   │
└────────────────┬────────────────────────┘
                 │ TCP
                 ▼
┌─────────────────────────────────────────┐
│     PostgreSQL (postgresql_17)          │
│     ├─ Database: nexoscrm               │
│     ├─ User: nexoscrm (exclusive)       │
│     └─ Port: 5432 (localhost only)      │
│                                         │
│     ⚠️ Compartilhado com FinançasZen   │
│        (bancos separados)               │
└─────────────────────────────────────────┘
```

---

## 📦 Stack da Aplicação

- **Frontend:** React + Vite (build estático)
- **Backend:** Node.js 20 + Express.js
- **ORM:** Prisma (PostgreSQL)
- **Autenticação:** JWT + bcryptjs
- **Build:** Multi-stage Docker (frontend + backend)
- **Runtime:** Node.js 20-alpine

---

## 🔒 Segurança

### Credenciais e Variáveis

1. **`.env.icp`** ❌ Não versionar
   - Contém senhas reais e tokens
   - Removido do git

2. **`.env.icp.example`** ✅ Versionado
   - Template sem valores sensíveis
   - Fornece documentação de variáveis

3. **`/opt/nexoscrm-config/app.env`** 🔐 VPS
   - Arquivo privado na VPS
   - Permissões: 600 (rw-------)
   - Proprietário: 1000:1000
   - Usado via `--env-file` no Docker

### Variáveis Obrigatórias

```bash
NODE_ENV=production          # Sempre "production" em produção
PORT=3026                    # Porta interna do container
DATABASE_URL=...             # Connection string PostgreSQL
JWT_SECRET=...               # Segredo JWT (min. 32 caracteres)
FRONTEND_URL=https://...     # URL do domínio
```

### Proteção de Senhas

- Nunca exibidas em logs ou commit
- Hashadas com bcrypt (10 rounds) no banco
- Solicitadas via input oculto (`read -sp`)
- Suportam percent-encoding (ex: `!` = `%21`)

---

## 🚀 Processo de Publicação

### Fase 1: Preparação Local (Repositório)

#### 1.1 Clonar e Validar

```bash
git clone https://github.com/Chorst09/crmnexointegrator_v2.git
cd crmnexointegrator_v2
git checkout main
```

#### 1.2 Instalar Dependências

```bash
npm install
cd apps/web && npm install && cd ../..
cd apps/api && npm install && cd ../..
cd backend && npm install && cd ..
```

#### 1.3 Build Local (Teste)

```bash
npm run build          # Build frontend + backend
npm run lint           # Validar sintaxe
```

#### 1.4 Testar Docker Localmente

```bash
docker build -t nexoscrm:test .
docker run --rm -p 3000:3026 \
  --env NODE_ENV=production \
  --env JWT_SECRET=test-secret-32-chars-minimum \
  nexoscrm:test
# Testar: curl http://localhost:3000/health
```

---

### Fase 2: Setup na VPS

#### 2.1 Acessar a VPS

```bash
# Via ICP Panel → Server → Terminal
# Ou via SSH:
ssh -i /path/to/key root@209.50.241.25
```

#### 2.2 Preparar Diretórios

```bash
# Repositório Git
sudo mkdir -p /opt/nexoscrm-github
sudo chown 1000:1000 /opt/nexoscrm-github
sudo chmod 755 /opt/nexoscrm-github

# Configuração privada
sudo mkdir -p /opt/nexoscrm-config
sudo chown 1000:1000 /opt/nexoscrm-config
sudo chmod 700 /opt/nexoscrm-config

# Upload de arquivo .env.icp.example
# ICP Panel → Server → Arquivos:
# 1. Localize /opt/nexoscrm-config
# 2. Faça upload de .env.icp.example
# 3. Renomeie para app.env
```

#### 2.3 Configurar Variáveis de Ambiente

```bash
# Na VPS, editar:
sudo nano /opt/nexoscrm-config/app.env

# Preencher:
NODE_ENV=production
PORT=3026
DATABASE_URL=postgresql://nexoscrm:SENHA@postgresql_17:5432/nexoscrm?schema=public
JWT_SECRET=<gerar com: openssl rand -base64 32>
FRONTEND_URL=https://nexos.chorstconsult.com.br
API_URL=https://nexos.chorstconsult.com.br/api

# Salvar e corrigir permissões:
sudo chmod 600 /opt/nexoscrm-config/app.env
```

#### 2.4 Configurar GitHub SSH Deploy Key

Na VPS:

```bash
# Gerar chave SSH para GitHub
ssh-keygen -t ed25519 -C "nexoscrm-deploy@209.50.241.25" -f ~/.ssh/id_ed25519_nexoscrm -N ""

# Copiar chave pública
cat ~/.ssh/id_ed25519_nexoscrm.pub
```

No GitHub (github.com/Chorst09/crmnexointegrator_v2):
- Ir para: **Settings → Deploy Keys**
- Adicionar chave pública
- ✅ Permitir acesso de escrita (ou apenas leitura se prefer)

Na VPS, validar:

```bash
ssh -i ~/.ssh/id_ed25519_nexoscrm -T git@github.com
# Esperado: "Hi Chorst09/crmnexointegrator_v2! You have successfully..."
```

#### 2.5 Clonar Repositório

Na VPS:

```bash
cd /opt/nexoscrm-github

git clone --depth 1 \
  -c core.sshCommand="ssh -i ~/.ssh/id_ed25519_nexoscrm" \
  git@github.com:Chorst09/crmnexointegrator_v2.git .

git config core.sshCommand "ssh -i ~/.ssh/id_ed25519_nexoscrm"
```

---

### Fase 3: Setup do Banco de Dados

#### 3.1 Criar Banco e Usuário

Na VPS, no terminal do servidor:

```bash
cd /opt/nexoscrm-github

# Executar setup do banco
./scripts/setup-db-nexoscrm.sh

# Será solicitada a senha do usuário "Chorst" do PostgreSQL
# Copie a CONNECTION STRING exibida
```

#### 3.2 Atualizar `app.env`

Após obter a senha gerada pelo script, atualizar:

```bash
sudo nano /opt/nexoscrm-config/app.env

# Colar a CONNECTION STRING em DATABASE_URL
DATABASE_URL=postgresql://nexoscrm:SENHA_GERADA@postgresql_17:5432/nexoscrm?schema=public

# Salvar
sudo chmod 600 /opt/nexoscrm-config/app.env
```

---

### Fase 4: Build e Deploy da Imagem Docker

#### 4.1 Construir Imagem

Na VPS:

```bash
cd /opt/nexoscrm-github

docker build -t nexoscrm:latest \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg VCS_REF=$(git rev-parse --short HEAD) \
  -f Dockerfile .
```

#### 4.2 Testar Container

```bash
# Teste sem porta pública
docker run --rm \
  --name nexoscrm-test \
  --env-file /opt/nexoscrm-config/app.env \
  --network icontainer-network \
  nexoscrm:latest &

sleep 10

# Validar
docker exec nexoscrm-test curl http://localhost:3026/health

# Parar
docker stop nexoscrm-test
```

#### 4.3 Deploy em Produção

**OPÇÃO 1: Manual via Script**

```bash
cd /opt/nexoscrm-github
./scripts/deploy-icp.sh
```

**OPÇÃO 2: Automatizado (um comando)**

```bash
docker rm -f nexoscrm-api 2>/dev/null || true && \
docker run -d \
  --name nexoscrm-api \
  --restart unless-stopped \
  --network icontainer-network \
  -p 127.0.0.1:3026:3026 \
  --env-file /opt/nexoscrm-config/app.env \
  nexoscrm:latest
```

Validar:

```bash
# Health check
curl http://127.0.0.1:3026/health

# Logs
docker logs -f nexoscrm-api
```

---

### Fase 5: Configurar Nginx Proxy e SSL

No ICP Panel → **Web → Domínios → Criar**

#### 5.1 Domínio Proxy

1. **Domínio:** `nexos.chorstconsult.com.br`
2. **Tipo:** Proxy HTTP
3. **Destino:** `127.0.0.1:3026`
4. **Protocolo:** HTTP (será convertido para HTTPS)
5. **Salvar**

#### 5.2 Certificado SSL

No ICP Panel → **Web → SSL → Obter**

1. **Domínio:** `nexos.chorstconsult.com.br`
2. **Método:** HTTP (automático)
3. **Conta ACME:** Selecionar disponível
4. **Auto-renovação:** ✅ Ativada
5. **Criar**

Aguardar sucesso da emissão.

#### 5.3 Aplicar SSL

No ICP Panel → **Web → Domínios → nexos.chorstconsult.com.br → Configuração**

1. **HTTPS:** ✅ Ativado
2. **Certificado:** Selecionar o emitido
3. **Redirecionamento HTTP → HTTPS:** ✅ Ativado
4. **TLS 1.2+:** ✅ Ativado
5. **Salvar**

#### 5.4 Testar

```bash
# HTTPS
curl -I https://nexos.chorstconsult.com.br/health

# Esperado: HTTP 200 OK
```

---

### Fase 6: Criar Conta MASTER

Na VPS:

```bash
cd /opt/nexoscrm-github

# Criar usuário administrativo
./scripts/create-master-user.sh chorstconsult@gmail.com Admin@2026

# Ou interativo (sem passar senha na CLI):
./scripts/create-master-user.sh chorstconsult@gmail.com
# Será solicitada a senha após execução
```

Confirmar:

```bash
# Acessar: https://nexos.chorstconsult.com.br
# Email: chorstconsult@gmail.com
# Senha: Admin@2026 (ou a que você definiu)
```

---

## 🔄 Atualizações Futuras

### Publicar Nova Versão

1. **Local:** Fazer commit e push na branch `main`

```bash
git add .
git commit -m "feat: descrição da mudança"
git push origin main
```

2. **Na VPS:** Execute um único comando

```bash
# Terminal do servidor (ICP → Server → Terminal):
cd /opt/nexoscrm-github && ./scripts/deploy-icp.sh
```

O script irá:
- ✅ Validar repositório Git
- ✅ Pull de nova versão
- ✅ Build Docker
- ✅ Testar container
- ✅ Substituir versão anterior
- ✅ Validar health check
- ✅ Rollback automático em falha

---

## 🛠️ Troubleshooting

### Container não inicia

```bash
# Ver logs
docker logs nexoscrm-api

# Validar arquivo .env
docker run --rm -it --env-file /opt/nexoscrm-config/app.env nexoscrm:latest env | sort

# Testar conexão ao banco
docker exec nexoscrm-api psql -h postgresql_17 -U nexoscrm -d nexoscrm -c "SELECT 1"
```

### Health check falha

```bash
# Dentro do container
docker exec -it nexoscrm-api curl http://localhost:3026/health

# Verificar logs da API
docker logs nexoscrm-api | tail -50
```

### HTTPS não funciona

```bash
# Validar Nginx está encaminhando
curl -v https://nexos.chorstconsult.com.br/health

# Validar certificado
echo | openssl s_client -servername nexos.chorstconsult.com.br -connect nexos.chorstconsult.com.br:443 2>/dev/null | openssl x509 -noout -dates
```

### Banco não conecta

```bash
# Testar conexão PostgreSQL
PGPASSWORD=SENHA psql -h 127.0.0.1 -p 5432 -U nexoscrm -d nexoscrm -c "SELECT 1"

# Ou via rede Docker:
docker exec nexoscrm-api psql postgresql://nexoscrm:SENHA@postgresql_17:5432/nexoscrm -c "SELECT 1"
```

---

## 📋 Checklist de Publicação

- [ ] Repositório clonado e validado localmente
- [ ] Build Docker funciona (local ou VPS)
- [ ] Arquivo `/opt/nexoscrm-config/app.env` criado e preenchido
- [ ] Banco `nexoscrm` criado e validado
- [ ] Usuário `nexoscrm` criado no PostgreSQL
- [ ] Container Docker rodando e health check OK
- [ ] Domínio proxy configurado no ICP
- [ ] Certificado SSL emitido e aplicado
- [ ] HTTPS funcional
- [ ] Conta MASTER criada e funcionando
- [ ] Login possível em https://nexos.chorstconsult.com.br
- [ ] Módulos do CRM acessíveis (Dashboard B2B, etc.)
- [ ] Uploads funcionando (se houver)
- [ ] FinançasZen continua operacional (não afetado)

---

## 📞 Suporte

Para problemas ou dúvidas:

1. Verificar logs: `docker logs nexoscrm-api`
2. Consultar esta documentação
3. Validar permissões de arquivos (`chmod 600 /opt/nexoscrm-config/app.env`)
4. Testar health check: `curl https://nexos.chorstconsult.com.br/health`

---

## 📚 Referências

- [Docker Documentation](https://docs.docker.com/)
- [Prisma ORM](https://www.prisma.io/)
- [Express.js](https://expressjs.com/)
- [iContainer Cloud Panel](https://vps8561.panel.icontainer.cloud:2090/)

---

**Versão:** 1.0.0  
**Atualizado:** 2026-11-21  
**Autor:** Carlos Horst / NEXOS CRM Team
