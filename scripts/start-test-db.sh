#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"
docker compose -f docker-compose.test-db.yml up -d

echo
echo "Instancia de teste iniciada:"
echo "  Host: localhost"
echo "  Port: 5435"
echo "  DB:   crm_test"
echo "  User: crm_test"
echo "  URL:  postgresql://crm_test:crm_test123@localhost:5435/crm_test?schema=public"
