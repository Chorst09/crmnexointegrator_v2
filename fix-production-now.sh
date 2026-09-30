#!/bin/bash
# Complete production fix script - run this on your production server
# Usage: ssh root@209.50.241.25 'bash -s' < fix-production-now.sh

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  NEXOS INTEGRATOR - PRODUCTION DOCKER FIX                  ║"
echo "║  Task Creation 500 Error Resolution                        ║"
echo "╚════════════════════════════════════════════════════════════╝"

cd /opt/nexoscrm/apps/api || { echo "❌ Directory not found: /opt/nexoscrm/apps/api"; exit 1; }

echo ""
echo "📍 Current directory: $(pwd)"
echo ""

# Step 1: Stop containers
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1/6: Stopping Docker containers..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker compose down
echo "✅ Containers stopped"
echo ""

# Step 2: Clean Prisma cache
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2/6: Cleaning Prisma cache..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
rm -rf .prisma
echo "  ✓ Removed .prisma"
rm -rf node_modules/.prisma
echo "  ✓ Removed node_modules/.prisma"
rm -rf dist
echo "  ✓ Removed dist"
echo "✅ Prisma cache cleaned"
echo ""

# Step 3: Verify schema.prisma is correct
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3/6: Verifying schema.prisma..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if grep -q "status TaskStatus @default(PENDENTE)" prisma/schema.prisma; then
  echo "✅ Schema has correct default: @default(PENDENTE)"
else
  echo "❌ ERROR: Schema doesn't have @default(PENDENTE)"
  echo "   Please verify prisma/schema.prisma manually"
  exit 1
fi

if grep -q "enum TaskStatus" prisma/schema.prisma; then
  echo "✅ TaskStatus enum found"
  echo "   Values:"
  grep -A 10 "enum TaskStatus" prisma/schema.prisma | head -15
else
  echo "❌ ERROR: TaskStatus enum not found"
  exit 1
fi
echo ""

# Step 4: Force Docker rebuild
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4/6: Building Docker image (no cache)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "This may take 2-3 minutes..."
docker compose build backend --no-cache
echo "✅ Docker image built"
echo ""

# Step 5: Start containers
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5/6: Starting Docker containers..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker compose up -d backend
echo "✅ Backend container started"
echo ""

# Step 6: Wait and verify
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6/6: Verifying container health..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 5

echo ""
echo "Container status:"
docker compose ps backend

echo ""
echo "Recent logs (last 30 lines):"
docker compose logs backend --tail 30

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PRODUCTION FIX COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next: Test task creation"
echo "  1. Open browser: https://nexoscrm.com/projetos/{projectId}"
echo "  2. Click 'Quadro' tab → select any column"
echo "  3. Click '+ Adicionar Tarefa' button"
echo "  4. Fill in task details and submit"
echo "  5. Verify task appears in the column"
echo ""
echo "If errors still appear:"
echo "  • Check: docker compose logs backend | grep -i prisma"
echo "  • Check: docker compose logs backend | grep -i error"
echo ""
