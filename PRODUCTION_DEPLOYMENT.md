# NexosCRM - Deployment em Produção

## Informações do Servidor

- **IP**: 209.50.241.25
- **Usuário**: root
- **Porta SSH**: 22
- **Senha**: <SSH_PASSWORD>

## Arquitetura de Produção

```
┌─────────────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy)                    │
│                    Porta 80 / 443                           │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐      ┌────────▼──────────┐
│  Frontend      │      │  Backend API     │
│  (React/Vite)  │      │  (Node.js)       │
│  Porta 3000    │      │  Porta 3001      │
└────────────────┘      └────────┬─────────┘
                                 │
                        ┌────────▼──────────┐
                        │  PostgreSQL      │
                        │  Porta 5432      │
                        └───────────────────┘
```

## Pré-requisitos no Servidor

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Instalar Nginx
apt install -y nginx

# Instalar PM2 globalmente
npm install -g pm2
```

## Estrutura de Diretórios no Servidor

```
/var/www/nexoscrm/
├── backend/
├── apps/web/
├── docker-compose.production.yml
├── nginx/
│   └── nginx.conf
└── .env.production
```

## Passo 1: Preparar o Servidor

```bash
# Conectar ao servidor
ssh root@209.50.241.25

# Criar diretório
mkdir -p /var/www/nexoscrm
cd /var/www/nexoscrm

# Clonar repositório (ou copiar arquivos)
git clone <seu-repositorio> .
# OU
# Copiar arquivos via SCP
```

## Passo 2: Configurar PostgreSQL com Docker

```bash
# Criar arquivo docker-compose.production.yml
cat > docker-compose.production.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: nexoscrm-postgres
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: nexoscrm
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d nexoscrm"]
      interval: 10s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
    driver: local
EOF

# Iniciar PostgreSQL
docker-compose -f docker-compose.production.yml up -d

# Aguardar container estar pronto
sleep 10
```

## Passo 3: Configurar Backend

```bash
cd /var/www/nexoscrm/backend

# Criar arquivo .env.production
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexoscrm?schema=public

# JWT
JWT_SECRET=<JWT_SECRET>
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=NexosCRM_Refresh_Secret_2024_CHANGE_THIS
JWT_REFRESH_EXPIRES_IN=30d

# CORS
CORS_ORIGIN=http://209.50.241.25

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=NexosCRM_Session_Secret_2024_CHANGE_THIS

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

# Instalar dependências
npm install

# Criar banco de dados e seed
npm run db:push
npm run db:seed

# Iniciar com PM2
pm2 start server.js --name "nexoscrm-api" --env production

# Salvar configuração PM2
pm2 save
pm2 startup
```

## Passo 4: Configurar Frontend

```bash
cd /var/www/nexoscrm/apps/web

# Criar arquivo .env.production
cat > .env.production << 'EOF'
VITE_API_URL=http://209.50.241.25/api
VITE_APP_NAME=CRM NEXOS
VITE_APP_VERSION=1.0.0
EOF

# Instalar dependências
npm install

# Build para produção
npm run build

# Copiar arquivos para Nginx
mkdir -p /var/www/nexoscrm/public
cp -r dist/* /var/www/nexoscrm/public/
```

## Passo 5: Configurar Nginx

```bash
# Criar arquivo de configuração Nginx
cat > /etc/nginx/sites-available/nexoscrm << 'EOF'
upstream backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name 209.50.241.25;
    
    # Limite de tamanho de upload
    client_max_body_size 100M;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript;
    gzip_min_length 1000;
    
    # Frontend
    location / {
        root /var/www/nexoscrm/public;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
    
    # API Backend
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
    
    # Uploads
    location /uploads/ {
        alias /var/www/nexoscrm/backend/uploads/;
        expires 30d;
    }
}
EOF

# Ativar site
ln -s /etc/nginx/sites-available/nexoscrm /etc/nginx/sites-enabled/

# Remover site padrão se existir
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Reiniciar Nginx
systemctl restart nginx
```

## Passo 6: Verificar Deployment

```bash
# Verificar se backend está rodando
curl http://localhost:3001/health

# Verificar se frontend está acessível
curl http://209.50.241.25

# Verificar logs do backend
pm2 logs nexoscrm-api

# Verificar logs do Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# Verificar status do PostgreSQL
docker ps | grep postgres
```

## Passo 7: Configurar SSL (Opcional mas Recomendado)

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Obter certificado
certbot --nginx -d 209.50.241.25

# Auto-renovação
systemctl enable certbot.timer
systemctl start certbot.timer
```

## Monitoramento e Manutenção

### Verificar Status

```bash
# Status do PM2
pm2 status

# Status do Docker
docker ps

# Status do Nginx
systemctl status nginx

# Uso de disco
df -h

# Uso de memória
free -h
```

### Logs

```bash
# Backend
pm2 logs nexoscrm-api

# Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# PostgreSQL
docker logs nexoscrm-postgres
```

### Backup do Banco de Dados

```bash
# Backup
docker exec nexoscrm-postgres pg_dump -U postgres nexoscrm > /var/www/nexoscrm/backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar
docker exec -i nexoscrm-postgres psql -U postgres nexoscrm < backup_file.sql
```

### Atualizar Aplicação

```bash
cd /var/www/nexoscrm

# Pull das mudanças
git pull origin main

# Backend
cd backend
npm install
npm run db:push
pm2 restart nexoscrm-api

# Frontend
cd ../apps/web
npm install
npm run build
cp -r dist/* /var/www/nexoscrm/public/

# Recarregar Nginx
nginx -s reload
```

## Credenciais de Acesso

**Admin:**
- Email: admin@crm.com
- Senha: admin123

**Sellers:**
- joao@crm.com / vendedor123
- maria@crm.com / vendedor123
- carlos@crm.com / vendedor123
- ana@crm.com / vendedor123

## Troubleshooting

### Backend não conecta ao banco
```bash
# Verificar se PostgreSQL está rodando
docker ps | grep postgres

# Verificar conexão
docker exec nexoscrm-postgres psql -U postgres -d nexoscrm -c "SELECT 1"
```

### Frontend retorna 404
```bash
# Verificar se arquivos estão em /var/www/nexoscrm/public
ls -la /var/www/nexoscrm/public/

# Verificar configuração do Nginx
nginx -t
```

### Porta já em uso
```bash
# Encontrar processo usando porta
lsof -i :3001
lsof -i :80

# Matar processo
kill -9 <PID>
```

## Checklist de Deployment

- [ ] PostgreSQL rodando em Docker
- [ ] Backend rodando com PM2
- [ ] Frontend buildado e em /var/www/nexoscrm/public
- [ ] Nginx configurado e rodando
- [ ] Banco de dados inicializado com seed
- [ ] Login funcionando
- [ ] Dashboard carregando
- [ ] API respondendo
- [ ] SSL configurado (opcional)
- [ ] Backups configurados

## Suporte

Para problemas, verifique:
1. Logs do backend: `pm2 logs nexoscrm-api`
2. Logs do Nginx: `/var/log/nginx/error.log`
3. Status do Docker: `docker ps`
4. Conectividade: `curl http://localhost:3001/health`
