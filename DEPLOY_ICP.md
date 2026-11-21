# NEXOS CRM Deployment to ICP VPS

Complete guide for Docker-based deployment of NEXOS CRM to ICP VPS (209.50.241.25) with domain `nexos.chorstconsult.com.br`.

## Architecture

- **Frontend:** Vite build → static files served by Nginx
- **Backend:** Node.js + Express + Prisma ORM → Docker container
- **Database:** PostgreSQL (exclusive database `nexos_icp` + user `nexos_icp`)
- **Port:** Internal 3000 → mapped to 127.0.0.1:3015 on VPS → Nginx proxy to domain
- **Network:** Docker network `icontainer-network` (managed by ICP platform)
- **Volumes:** Named volumes for uploads and attachments (persistent across deployments)

## Prerequisites

- VPS: 209.50.241.25, root access, SSH key or password
- Domain: nexos.chorstconsult.com.br (configured in ICP panel)
- GitHub: Repository github.com/Chorst09/crmnexointegrator_v2 (main branch)
- Master account: chorstconsult@gmail.com / Admin@2026

## One-Time Setup (First Deployment Only)

### Option 1: Remote Setup Script (Recommended)

On your local machine:

```bash
cd crmnexointegrator_v2-main
bash deploy/icp/SETUP_REMOTE.sh 209.50.241.25 root
```

This will:
1. Copy `setup-initial.sh` to VPS
2. Create PostgreSQL database and user
3. Generate configuration file (`/opt/nexos-icp-config/app.env`)
4. Set up SSH keys for GitHub (if needed)
5. Clean up temporary files

**During execution, you'll be prompted for:**
- PostgreSQL password for `nexos_icp` user (min 16 characters)
- JWT_SECRET (min 32 characters, random)
- SSH key generation (yes/no)

### Option 2: Manual Setup (ICP Terminal)

In ICP Panel → Server → Terminal:

```bash
# Create config directory
mkdir -p /opt/nexos-icp-config
chmod 700 /opt/nexos-icp-config

# Create database
docker exec postgresql_17 psql -U postgres -d postgres <<'SQL'
CREATE USER nexos_icp WITH ENCRYPTED PASSWORD 'YOUR_PASSWORD_HERE';
CREATE DATABASE nexos_icp OWNER nexos_icp ENCODING 'UTF8' LOCALE 'C.UTF-8' TEMPLATE template0;
GRANT CONNECT ON DATABASE nexos_icp TO nexos_icp;
GRANT USAGE ON SCHEMA public TO nexos_icp;
GRANT CREATE ON SCHEMA public TO nexos_icp;
SQL

# Create app.env (replace values)
cat > /opt/nexos-icp-config/app.env <<'ENV'
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://nexos_icp:YOUR_PASSWORD_URL_ENCODED@postgresql_17:5432/nexos_icp?schema=public
JWT_SECRET=YOUR_RANDOM_SECRET_MIN_32_CHARS
CORS_ORIGIN=https://nexos.chorstconsult.com.br
FRONTEND_URL=https://nexos.chorstconsult.com.br
API_URL=https://nexos.chorstconsult.com.br
MASTER_EMAILS=chorstconsult@gmail.com
DISABLE_STARTUP_WRITES=true
UPLOADS_DIR=/app/apps/api/uploads
EDITAIS_ATTACHMENTS_DIR=/app/apps/attachments/editais
ENV

chmod 600 /opt/nexos-icp-config/app.env
```

## Deploy or Update

Once setup is complete, deploy new versions:

### From Local Machine

```bash
cd crmnexointegrator_v2-main
bash deploy/icp/deploy.sh
```

### From VPS Terminal (ICP Panel)

```bash
cd /opt/nexos-icp-github || git clone --branch main https://github.com/Chorst09/crmnexointegrator_v2.git /opt/nexos-icp-github
cd /opt/nexos-icp-github
bash deploy/icp/deploy.sh
```

## Deployment Flow

The `deploy.sh` script:

1. **Validates:** Environment file, database connection, required dependencies
2. **Fetches:** Latest code from GitHub (main branch)
3. **Builds:** Docker image with Dockerfile.icp (multi-stage build)
4. **Tests:** Runs smoke tests in candidate container
5. **Switches:** Gracefully replaces running container with new version
6. **Verifies:** Health checks, HTTPS endpoint validation
7. **Rollback:** Restores previous container on any failure

**No downtime:** Old container runs until new container is verified healthy.

## Verify Deployment

After deploy completes:

```bash
# Check container status
docker ps -f name=nexos-icp

# View logs
docker logs -f nexos-icp

# Test health endpoint
curl -v http://127.0.0.1:3015/api/health

# Test HTTPS
curl -v https://nexos.chorstconsult.com.br/api/health
```

## Nginx Configuration

The domain `nexos.chorstconsult.com.br` must be configured to proxy to the container:

In ICP Panel:
1. **Web → Domínios → Criar**
   - Domain: `nexos.chorstconsult.com.br`
   - Type: Proxy HTTP
   - Target: `http://127.0.0.1:3015`

2. **Web → SSL → Obter**
   - Issue certificate for `nexos.chorstconsult.com.br`

3. **Web → Domínios → (select domain)**
   - Enable HTTPS
   - Select certificate
   - Minimum TLS: 1.2

## Master Account Creation

The master account is created during first deployment:

- Email: chorstconsult@gmail.com
- Password: Admin@2026
- Roles: All permissions (B2B, B2G, Pre-sales, Management, Automation)

**To reset master password:**

```bash
echo "NewPasswordHere" | docker run --rm --network icontainer-network \
  --env-file /opt/nexos-icp-config/app.env \
  -v /app/apps/api/prisma:/app/apps/api/prisma:ro \
  nexos-icp:latest \
  node deploy/icp/admin.cjs owner chorstconsult@gmail.com
```

## Troubleshooting

### Deployment fails: "app.env must exist with mode 600"

```bash
# Check file exists and permissions
ls -la /opt/nexos-icp-config/app.env
chmod 600 /opt/nexos-icp-config/app.env
```

### Database connection error

```bash
# Verify PostgreSQL container
docker ps -f name=postgresql_17

# Test connection
docker exec postgresql_17 psql -U nexos_icp -d nexos_icp -c "SELECT 1"

# Check env file
grep DATABASE_URL /opt/nexos-icp-config/app.env
```

### Container stuck in health check loop

```bash
# View container logs
docker logs nexos-icp

# Manually check health endpoint
docker exec nexos-icp node -e \
  "fetch('http://127.0.0.1:3000/api/health').then(r => console.log(r.status, r.statusText))"
```

### Nginx not routing to container

```bash
# Verify proxy setup in ICP Panel
# Test direct connection to container
curl -H "Host: nexos.chorstconsult.com.br" http://127.0.0.1:3015/

# Check Nginx logs (if accessible)
docker exec ic-nginx-rv3m tail -50 /var/log/nginx/access.log
```

## Rollback

If deployment fails, `deploy.sh` automatically restores the previous container. Manual rollback:

```bash
# List available containers
docker ps -a | grep nexos-icp

# Check release history
cat /opt/nexos-icp-config/current-release
cat /opt/nexos-icp-config/previous-container

# Restore previous version
previous=$(cat /opt/nexos-icp-config/previous-container)
docker rename "$previous" nexos-icp
docker start nexos-icp
```

## Database Backups

PostgreSQL is managed by ICP platform. To backup manually:

```bash
# Dump database
docker exec postgresql_17 pg_dump -U nexos_icp nexos_icp > nexos_icp_backup.sql

# Restore from backup
docker exec -i postgresql_17 psql -U nexos_icp nexos_icp < nexos_icp_backup.sql
```

## Security Notes

- **Secrets:** JWT_SECRET and database password stored only in `/opt/nexos-icp-config/app.env` (mode 600)
- **No plaintext passwords:** All credentials hashed (bcrypt for users, no storage in image)
- **Network isolation:** Container connects via Docker network, not exposed to host network
- **SSH access:** Use SSH keys when possible (configured during setup)
- **Nginx reverse proxy:** Container never exposed directly to internet

## Support

For issues during deployment:
1. Check the "Troubleshooting" section above
2. Review `docker logs nexos-icp` for detailed error messages
3. Verify app.env configuration matches deploy.sh requirements
4. Ensure PostgreSQL container is running: `docker ps -f name=postgresql_17`
