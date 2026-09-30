# 🏗️ Arquitetura do Servidor 72.60.195.200

## 📊 Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│                  Servidor 72.60.195.200                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────┐      ┌─────────────────────┐      │
│  │   Finanças Zen      │      │   CRM Comercial     │      │
│  │   (Existente)       │      │   (Novo)            │      │
│  ├─────────────────────┤      ├─────────────────────┤      │
│  │ Porta: 80           │      │ Porta: 8081         │      │
│  │ Dir: /var/www/      │      │ Dir: /var/www/      │      │
│  │      financaszen    │      │      crm-comercial  │      │
│  │ PM2: financaszen    │      │ PM2: crm-api        │      │
│  │ DB: financaszen_db  │      │ DB: crm_comercial   │      │
│  └─────────────────────┘      └─────────────────────┘      │
│           ↓                             ↓                    │
│  ┌─────────────────────┐      ┌─────────────────────┐      │
│  │ http://IP:80        │      │ http://IP:8081      │      │
│  │ (Não será tocado)   │      │ (Nova instalação)   │      │
│  └─────────────────────┘      └─────────────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🗂️ Estrutura de Diretórios

```
/var/www/
│
├── financaszen/                    ← NÃO SERÁ TOCADO
│   ├── node_modules/
│   ├── dist/
│   ├── .env
│   └── ...
│
└── crm-comercial/                  ← NOVO DIRETÓRIO
    ├── apps/
    │   ├── api/
    │   │   ├── api/
    │   │   ├── lib/
    │   │   ├── prisma/
    │   │   ├── server.cjs
    │   │   ├── .env                ← Configuração da API
    │   │   └── package.json
    │   │
    │   └── web/
    │       ├── src/
    │       ├── dist/               ← Build do frontend
    │       ├── .env                ← Configuração do frontend
    │       └── package.json
    │
    ├── logs/                       ← Logs do PM2
    │   ├── api-error.log
    │   ├── api-out.log
    │   └── api-combined.log
    │
    ├── ecosystem.config.js         ← Configuração PM2
    └── server-setup.sh             ← Script de configuração
```

## 🔌 Portas e Serviços

| Porta | Serviço | Status | Acesso |
|-------|---------|--------|--------|
| **80** | Finanças Zen | ✅ Mantém | http://72.60.195.200 |
| **8081** | CRM API + Frontend | 🆕 Novo | http://72.60.195.200:8081 |
| **5432** | PostgreSQL | ✅ Compartilhado | localhost (ambos usam) |

## 🗄️ Bancos de Dados PostgreSQL

```
PostgreSQL (localhost:5432)
│
├── financaszen_db                  ← Banco do Finanças Zen
│   ├── users
│   ├── transactions
│   └── ...
│
└── crm_comercial                   ← Banco do CRM (novo)
    ├── User
    ├── Company
    ├── Client
    ├── Opportunity
    ├── Product
    ├── Proposal
    └── ... (30+ tabelas)
```

## 🔄 Processos PM2

```bash
pm2 list

┌─────┬──────────────┬─────────┬─────────┬──────────┬──────────┐
│ id  │ name         │ status  │ port    │ memory   │ cpu      │
├─────┼──────────────┼─────────┼─────────┼──────────┼──────────┤
│ 0   │ financaszen  │ online  │ 80      │ 150 MB   │ 0%       │  ← Existente
│ 1   │ crm-api      │ online  │ 8081    │ 200 MB   │ 0%       │  ← Novo
└─────┴──────────────┴─────────┴─────────┴──────────┴──────────┘
```

## 🌐 Nginx (Opcional)

Se você quiser usar Nginx como proxy reverso:

```nginx
# /etc/nginx/sites-available/financaszen
server {
    listen 80;
    # ... configuração existente (não modificar)
}

# /etc/nginx/sites-available/crm-comercial (novo)
server {
    listen 8081;
    server_name 72.60.195.200;
    
    location / {
        root /var/www/crm-comercial/apps/web/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:8081;
        # ... headers
    }
}
```

## 🔐 Variáveis de Ambiente

### Finanças Zen (.env)
```bash
# Não será modificado
PORT=80
DATABASE_URL=postgresql://...financaszen_db
# ...
```

### CRM API (.env)
```bash
NODE_ENV=production
PORT=8081
DATABASE_URL=postgresql://crm_user:senha@localhost:5432/crm_comercial
JWT_SECRET=segredo-forte-aleatorio
CORS_ORIGIN=http://72.60.195.200:8081
```

### CRM Web (.env)
```bash
VITE_API_URL=http://72.60.195.200:8081/api
```

## 🔒 Firewall (UFW)

```bash
sudo ufw status

Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere        # SSH
80/tcp                     ALLOW       Anywhere        # Finanças Zen
8081/tcp                   ALLOW       Anywhere        # CRM (novo)
5432/tcp                   DENY        Anywhere        # PostgreSQL (apenas local)
```

## 📊 Fluxo de Requisições

### Finanças Zen (Não afetado)
```
Cliente → http://72.60.195.200:80
         ↓
    Nginx/Node.js (porta 80)
         ↓
    PostgreSQL (financaszen_db)
```

### CRM Comercial (Novo)
```
Cliente → http://72.60.195.200:8081
         ↓
    Node.js Express (porta 8081)
         ↓
    PostgreSQL (crm_comercial)
```

## 🔄 Fluxo de Deploy

```
┌─────────────────┐
│ Seu Computador  │
│                 │
│ 1. Preparar     │
│ 2. Comprimir    │
│ 3. Enviar (SCP) │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────┐
│ Servidor 72.60.195.200          │
│                                 │
│ 4. Descompactar                 │
│ 5. Instalar dependências        │
│ 6. Configurar .env              │
│ 7. Migrar banco de dados        │
│ 8. Build frontend               │
│ 9. Iniciar com PM2              │
└─────────────────────────────────┘
         │
         ↓
┌─────────────────┐
│ CRM Funcionando │
│ Porta 8081      │
└─────────────────┘
```

## ✅ Checklist de Independência

- [x] Diretórios separados
- [x] Portas diferentes
- [x] Processos PM2 independentes
- [x] Bancos de dados separados
- [x] Arquivos .env separados
- [x] Logs separados
- [x] Configurações Nginx separadas (se usado)

## 🎯 Conclusão

As duas aplicações são **COMPLETAMENTE INDEPENDENTES**:

1. ✅ Rodam em portas diferentes
2. ✅ Usam diretórios diferentes
3. ✅ Têm processos diferentes
4. ✅ Usam bancos de dados diferentes
5. ✅ Têm configurações diferentes

**Não há nenhuma forma de uma afetar a outra!**
