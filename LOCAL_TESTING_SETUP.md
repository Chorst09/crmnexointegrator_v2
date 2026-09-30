# NexosCRM Local Testing Setup Guide

## Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ installed
- Port 5173 available (frontend - apps/web)
- Port 3001 available (backend)
- Port 5434 available (PostgreSQL)

## Step 1: Start PostgreSQL Container

```bash
docker-compose -f docker-compose.local.yml up -d
```

This will start a PostgreSQL container named `nexosintegrator` with:
- User: `postgres`
- Password: `postgres`
- Database: `nexoscrm`
- Port: `5434` (mapped from 5432)

Verify it's running:
```bash
docker ps | grep nexosintegrator
```

## Step 2: Initialize Database Schema

The database schema is automatically created when you run the backend. To manually seed test data:

```bash
cd backend
npm run db:push
npm run db:seed
```

## Step 3: Start Backend Server

```bash
cd backend
npm install  # if needed
npm run dev
```

The backend will start on `http://localhost:3001`

Verify it's working:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"ok","timestamp":"...","uptime":...,"environment":"development"}
```

## Step 4: Start Frontend Dev Server

In a new terminal:

```bash
cd apps/web
npm install  # if needed
npm run dev
```

The frontend will start on `http://localhost:5173`

## Step 5: Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

## Login Credentials

- **Email**: admin@crm.com
- **Password**: admin123

Or use one of the test sellers:
- **Email**: joao@crm.com
- **Password**: vendedor123

## Testing Checklist

- [ ] Frontend loads at http://localhost:5173
- [ ] Login works with admin credentials
- [ ] Dashboard displays correctly
- [ ] All menu items are accessible
- [ ] API calls are working (check browser console for errors)
- [ ] Database operations work (create/read/update/delete)
- [ ] No CORS errors in browser console
- [ ] No database connection errors in backend logs

## Troubleshooting

### PostgreSQL Connection Issues
```bash
# Check if container is running
docker ps | grep nexosintegrator

# View container logs
docker logs nexosintegrator

# Restart container
docker-compose -f docker-compose.local.yml restart
```

### Backend Connection Issues
```bash
# Check backend logs
npm run dev  # will show logs in terminal

# Verify database URL in backend/.env
cat backend/.env | grep DATABASE_URL
```

### Frontend Issues
```bash
# Clear node_modules and reinstall
rm -rf apps/web/node_modules
cd apps/web
npm install
npm run dev
```

### Port Already in Use
```bash
# Find process using port 5173
lsof -i :5173

# Find process using port 3001
lsof -i :3001

# Find process using port 5434
lsof -i :5434
```

## Stopping Services

```bash
# Stop frontend (Ctrl+C in terminal)
# Stop backend (Ctrl+C in terminal)

# Stop PostgreSQL container
docker-compose -f docker-compose.local.yml down

# Stop and remove all data
docker-compose -f docker-compose.local.yml down -v
```

## Environment Files

The following `.env` files are already configured for local development:
- `backend/.env` - Points to localhost:5434
- `apps/web/.env` - Points to http://localhost:3001 (if needed)

No changes needed unless you want to use different ports.
