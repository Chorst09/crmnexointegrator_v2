# NEXOS CRM ICP Deployment - Quick Start

## First Time Setup (5 minutes)

### Step 1: Run Setup Script
In ICP Panel → Server → Terminal, paste this:

```bash
# Download and run setup
curl -fsSL https://raw.githubusercontent.com/Chorst09/crmnexointegrator_v2/main/deploy/icp/setup-initial.sh | bash
```

This will prompt for:
- PostgreSQL password (min 16 chars)
- JWT_SECRET (min 32 chars, random)
- Generate SSH key? (yes/no)

### Step 2: Add SSH Key to GitHub (if you generated one)
If prompted in Step 1, the SSH key will be displayed. Go to:
- https://github.com/Chorst09/crmnexointegrator_v2/settings/keys
- Click "Add deploy key"
- Paste the public key

### Step 3: Deploy
Still in ICP Terminal:

```bash
cd /opt/nexos-icp-github && bash deploy/icp/deploy.sh
```

The script will:
- Clone/update repository
- Build Docker image
- Run health checks
- Deploy container
- Create master account

### Step 4: Configure Nginx
In ICP Panel → Web → Domínios:
1. **Create Domain:**
   - Name: `nexos.chorstconsult.com.br`
   - Type: Proxy HTTP
   - Target: `http://127.0.0.1:3015`

2. **Set SSL:**
   - Web → SSL → Issue for `nexos.chorstconsult.com.br`
   - Enable HTTPS, select cert, min TLS 1.2

### Done!
Access: https://nexos.chorstconsult.com.br
- Email: chorstconsult@gmail.com
- Password: Admin@2026

---

## Regular Updates

Every time you push changes to main branch:

```bash
# In ICP Terminal
cd /opt/nexos-icp-github && bash deploy/icp/deploy.sh
```

Takes ~2-3 minutes, zero downtime.

---

## Troubleshooting

### Check deployment status
```bash
docker ps -f name=nexos-icp
docker logs nexos-icp --tail 50
```

### Test health
```bash
curl http://127.0.0.1:3015/api/health
curl https://nexos.chorstconsult.com.br/api/health
```

### Database connection issues
```bash
# Verify PostgreSQL
docker exec postgresql_17 psql -U nexos_icp -d nexos_icp -c "SELECT 1"

# Check environment file
grep DATABASE_URL /opt/nexos-icp-config/app.env
```

### Need to rerun setup?
```bash
rm -rf /opt/nexos-icp-github /opt/nexos-icp-config
# Then run setup again from Step 1
```

---

## Useful Commands

```bash
# View current release
cat /opt/nexos-icp-config/current-release

# View logs real-time
docker logs -f nexos-icp

# SSH into container
docker exec -it nexos-icp /bin/sh

# Database connection
docker exec postgresql_17 psql -U nexos_icp nexos_icp

# Stop/start container
docker stop nexos-icp
docker start nexos-icp

# View all running services
docker ps --format "table {{.Names}}\t{{.Status}}"
```

---

## Full Documentation

See `DEPLOY_ICP.md` for complete guide, architecture, and advanced topics.
