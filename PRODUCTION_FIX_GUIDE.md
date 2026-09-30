# Production Task Creation Fix Guide

## Problem
Task creation returns 500 errors with: `invalid input value for enum "TaskStatus": "TODO"`
- Frontend sends: `status: 'PENDENTE'` ✓
- Backend schema has: `@default(PENDENTE)` ✓
- Docker container has: STALE schema with `@default(TODO)` ✗

## Root Cause
Docker build is using cached Prisma schema from old container. When you pushed changes to `schema.prisma`, the Docker container on the server still has the old compiled schema.

## Solution: Quick Fix (Recommended)

### Option 1: Force Docker Rebuild (5 minutes)
SSH to production server and run:

```bash
cd /opt/nexoscrm/apps/api

# Stop containers
docker compose down

# Clean Prisma cache
rm -rf .prisma
rm -rf node_modules/.prisma

# Force rebuild without cache
docker compose build backend --no-cache

# Start containers
docker compose up -d backend

# Verify
docker compose logs backend | tail -20
```

### Option 2: Manual Prisma Regeneration (3 minutes)
If rebuild fails, regenerate Prisma manually inside the container:

```bash
cd /opt/nexoscrm/apps/api

# Enter the running container
docker compose exec backend bash

# Inside container:
rm -rf .prisma
npx prisma generate
exit

# Restart container
docker compose restart backend
```

### Option 3: Update schema in database (if needed)
If there are production schema mismatches:

```bash
cd /opt/nexoscrm/apps/api

# Push schema to database (WARNING: this may modify production data)
docker compose exec backend npx prisma db push
```

## Verification Steps

1. **Check Prisma error is gone:**
   ```bash
   docker compose logs backend | grep -i "prisma\|error"
   ```

2. **Test task creation:**
   ```bash
   curl -X POST http://209.50.241.25:3002/api/projetos/{projectId}/tasks \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {token}" \
     -d '{
       "title": "Test Task",
       "description": "Testing",
       "status": "PENDENTE",
       "priority": "MEDIUM"
     }'
   ```

3. **Check container is healthy:**
   ```bash
   docker compose ps
   ```

## File Locations
- Schema: `/opt/nexoscrm/apps/api/prisma/schema.prisma`
- Dockerfile: `/opt/nexoscrm/apps/api/Dockerfile`
- API endpoint: `POST /api/projetos/{id}/tasks`

## If Still Failing
1. Check Docker build logs: `docker compose build backend --no-cache 2>&1 | tail -100`
2. Check container runtime logs: `docker compose logs backend --tail=50`
3. Verify schema.prisma was pushed to server: `diff -u /opt/nexoscrm/apps/api/prisma/schema.prisma <(git show HEAD:apps/api/prisma/schema.prisma)`
