# Guia de Deploy do CRM no Servidor 72.60.195.200 (Porta 8081)

## ⚠️ IMPORTANTE
- O Finanças Zen está rodando na porta 80 (HTTP padrão)
- Este CRM será implantado na porta 8081
- NÃO interferir com o Finanças Zen

## Pré-requisitos no Servidor

1. Node.js 18+ instalado
2. PostgreSQL instalado e rodando
3. PM2 para gerenciar processos (recomendado)
4. Nginx configurado (opcional, para proxy reverso)

## Passo 1: Conectar ao Servidor

```bash
ssh usuario@72.60.195.200
```

## Passo 2: Preparar Diretório do Projeto

```bash
# Criar diretório para o CRM (se não existir)
mkdir -p /var/www/crm-comercial
cd /var/www/crm-comercial

# Se já existe, fazer backup
# mv /var/www/crm-comercial /var/www/crm-comercial-backup-$(date +%Y%m%d-%H%M%S)
```

## Passo 3: Transferir Arquivos

### Opção A: Via Git (Recomendado)
```bash
cd /var/www/crm-comercial
git clone <seu-repositorio-git> .
# ou se já existe:
git pull origin main
```

### Opção B: Via SCP (do seu computador local)
```bash
# No seu computador local, comprimir o projeto
cd /caminho/do/projeto
tar -czf crm-comercial.tar.gz apps/ package*.json

# Enviar para o servidor
scp crm-comercial.tar.gz usuario@72.60.195.200:/var/www/crm-comercial/

# No servidor, descompactar
ssh usuario@72.60.195.200
cd /var/www/crm-comercial
tar -xzf crm-comercial.tar.gz
rm crm-comercial.tar.gz
```

## Passo 4: Configurar Banco de Dados PostgreSQL

```bash
# Conectar ao PostgreSQL
sudo -u postgres psql

# Criar banco de dados e usuário
CREATE DATABASE crm_comercial;
CREATE USER crm_user WITH ENCRYPTED PASSWORD 'senha_forte_aqui';
GRANT ALL PRIVILEGES ON DATABASE crm_comercial TO crm_user;
\q
```

## Passo 5: Configurar Variáveis de Ambiente - API

```bash
cd /var/www/crm-comercial/apps/api

# Criar arquivo .env
cat > .env << 'EOF'
NODE_ENV=production
PORT=8081
DATABASE_URL=postgresql://crm_user:senha_forte_aqui@localhost:5432/crm_comercial?schema=public
JWT_SECRET=troque-por-um-segredo-muito-forte-e-aleatorio-aqui
CORS_ORIGIN=http://72.60.195.200:8081,http://localhost:8081
EOF
```

## Passo 6: Instalar Dependências e Configurar API

```bash
cd /var/www/crm-comercial/apps/api

# Instalar dependências
npm install

# Gerar Prisma Client
npm run db:generate

# Executar migrações
npm run db:migrate:deploy

# Executar seed (dados iniciais)
npm run db:seed
```

## Passo 7: Build do Frontend

```bash
cd /var/www/crm-comercial/apps/web

# Criar arquivo .env
cat > .env << 'EOF'
VITE_API_URL=http://72.60.195.200:8081/api
EOF

# Instalar dependências
npm install

# Build do frontend
npm run build
```

## Passo 8: Configurar Servidor com PM2

```bash
# Instalar PM2 globalmente (se não estiver instalado)
sudo npm install -g pm2

# Criar arquivo de configuração PM2
cd /var/www/crm-comercial
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'crm-api',
    cwd: '/var/www/crm-comercial/apps/api',
    script: 'server.cjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8081
    },
    error_file: '/var/www/crm-comercial/logs/api-error.log',
    out_file: '/var/www/crm-comercial/logs/api-out.log',
    log_file: '/var/www/crm-comercial/logs/api-combined.log',
    time: true
  }]
};
EOF

# Criar diretório de logs
mkdir -p /var/www/crm-comercial/logs

# Iniciar aplicação com PM2
pm2 start ecosystem.config.js

# Salvar configuração do PM2
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup
# Execute o comando que o PM2 mostrar
```

## Passo 9: Configurar Nginx (Opcional - Servir Frontend)

```bash
# Criar configuração do Nginx para o CRM
sudo nano /etc/nginx/sites-available/crm-comercial

# Adicionar configuração:
```

```nginx
server {
    listen 8081;
    server_name 72.60.195.200;

    # Frontend (arquivos estáticos)
    location / {
        root /var/www/crm-comercial/apps/web/dist;
        try_files $uri $uri/ /index.html;
        
        # Headers de segurança
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    # API (proxy para Node.js)
    location /api {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads
    location /uploads {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/crm-comercial /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

## Passo 10: Configurar Firewall

```bash
# Permitir porta 8081
sudo ufw allow 8081/tcp

# Verificar status
sudo ufw status
```

## Passo 11: Verificar Instalação

```bash
# Verificar se o processo está rodando
pm2 status

# Ver logs em tempo real
pm2 logs crm-api

# Testar API
curl http://localhost:8081/api/health

# Testar do exterior
curl http://72.60.195.200:8081/api/health
```

## Comandos Úteis de Manutenção

```bash
# Ver logs
pm2 logs crm-api

# Reiniciar aplicação
pm2 restart crm-api

# Parar aplicação
pm2 stop crm-api

# Remover do PM2
pm2 delete crm-api

# Ver status
pm2 status

# Monitorar recursos
pm2 monit
```

## Credenciais Padrão do Sistema

Após o seed, você pode fazer login com:

- **Admin**: admin@crm.com / admin123
- **Diretor**: diretor@crm.com / diretor123
- **Vendedor**: vendedor@crm.com / vendedor123

## Troubleshooting

### Porta 8081 não responde
```bash
# Verificar se a porta está em uso
sudo netstat -tulpn | grep 8081

# Verificar logs do PM2
pm2 logs crm-api --lines 100

# Verificar firewall
sudo ufw status
```

### Erro de conexão com banco de dados
```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Testar conexão
psql -U crm_user -d crm_comercial -h localhost
```

### Frontend não carrega
```bash
# Verificar se o build foi feito
ls -la /var/www/crm-comercial/apps/web/dist

# Verificar configuração do Nginx
sudo nginx -t

# Ver logs do Nginx
sudo tail -f /var/log/nginx/error.log
```

## Acessar o Sistema

Após a instalação completa:

- **URL**: http://72.60.195.200:8081
- **API Health**: http://72.60.195.200:8081/api/health

## Notas Importantes

1. ⚠️ Troque o JWT_SECRET por um valor forte e aleatório
2. ⚠️ Troque a senha do banco de dados
3. ⚠️ Configure backups regulares do banco de dados
4. ⚠️ Considere usar HTTPS com certificado SSL
5. ⚠️ Monitore os logs regularmente
