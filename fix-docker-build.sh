#!/bin/bash
# Script to fix Prisma schema validation error on production server
# Usage: ./fix-docker-build.sh <server_ip> <root_password>

SERVER=$1
ROOT_PASS=$2

if [ -z "$SERVER" ] || [ -z "$ROOT_PASS" ]; then
  echo "Usage: ./fix-docker-build.sh <server_ip> <root_password>"
  echo "Example: ./fix-docker-build.sh 209.50.241.25 mypassword"
  exit 1
fi

echo "Connecting to production server and fixing Prisma build..."

# SSH and execute fix commands
sshpass -p "$ROOT_PASS" ssh -o StrictHostKeyChecking=no root@"$SERVER" bash << 'EOF'

echo "=== Step 1: Navigate to app directory ==="
cd /opt/nexoscrm/apps/api || exit 1

echo "=== Step 2: Stop running containers ==="
docker compose down

echo "=== Step 3: Clean Prisma cache ==="
rm -rf .prisma
rm -rf node_modules/.prisma
rm -rf dist

echo "=== Step 4: Clean Docker build cache (force rebuild) ==="
docker compose build backend --no-cache

echo "=== Step 5: Start containers ==="
docker compose up -d backend

echo "=== Step 6: Wait for container to start ==="
sleep 5

echo "=== Step 7: Check container logs ==="
docker compose logs backend | tail -50

echo "=== Done! ==="

EOF

echo "Production server fix complete!"
