#!/usr/bin/env bash
# Initial one-time setup for NEXOS CRM on ICP VPS
# Prepares database, configuration, and network for first deployment
# Usage: bash setup-initial.sh

set -Eeuo pipefail
trap 'printf "\n⚠️  Setup interrupted\n" >&2; exit 130' INT TERM

echo "=== NEXOS CRM Initial Setup for ICP VPS ==="
echo ""
echo "This script prepares your VPS for NEXOS CRM Docker deployment:"
echo "  • Creates exclusive PostgreSQL database and user"
echo "  • Sets up config directory with encrypted environment file"
echo "  • Ensures Docker network connectivity"
echo "  • Generates SSH keys for GitHub access (if needed)"
echo ""

# Check prerequisites
for cmd in docker git curl; do
  command -v "$cmd" >/dev/null || { echo "❌ Missing: $cmd. Install and retry."; exit 1; }
done

docker network inspect icontainer-network >/dev/null 2>&1 || {
  echo "❌ Docker network icontainer-network not found."
  echo "   This network should be managed by ICP platform."
  exit 1
}

# Verify PostgreSQL is reachable
echo -n "Checking PostgreSQL connectivity... "
for i in {1..5}; do
  if docker exec postgresql_17 psql -U postgres -d postgres -c "SELECT 1" >/dev/null 2>&1; then
    echo "✓"
    break
  fi
  [[ $i -lt 5 ]] && sleep 2 || { echo "❌ PostgreSQL unreachable after 5 attempts"; exit 1; }
done

# Create config directory
config=/opt/nexos-icp-config
mkdir -p "$config"
chmod 700 "$config"
echo "✓ Config directory: $config"

# Check if database already exists
echo -n "Checking for existing database... "
if docker exec postgresql_17 psql -U postgres -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='nexos_icp'" | grep -q 1; then
  echo "Already exists"
  existing=true
else
  echo "Not found (will create)"
  existing=false
fi

# Check if app.env exists
if [[ -f "$config/app.env" ]]; then
  echo "✓ app.env already exists"
  envexists=true
else
  envexists=false
fi

if ! $existing || ! $envexists; then
  echo ""
  echo "Setup requires new configuration. Follow prompts:"
  echo ""

  # Get database password
  if ! $existing; then
    echo -n "Enter PostgreSQL password for nexos_icp user (min 16 chars, no quotes): "
    read -rs db_password || true
    echo ""
    if [[ ${#db_password} -lt 16 ]]; then
      echo "❌ Password too short. Minimum 16 characters."
      exit 1
    fi
  fi

  # Get JWT secret
  if ! $envexists; then
    echo -n "Enter JWT_SECRET (min 32 chars, random, no spaces): "
    read -rs jwt_secret || true
    echo ""
    if [[ ${#jwt_secret} -lt 32 ]]; then
      echo "❌ JWT_SECRET too short. Minimum 32 characters."
      exit 1
    fi
  fi
fi

# Create database and user if needed
if ! $existing; then
  echo ""
  echo "Creating database and user..."
  docker exec postgresql_17 psql -U postgres -d postgres <<SQL
CREATE USER nexos_icp WITH ENCRYPTED PASSWORD '$db_password';
CREATE DATABASE nexos_icp OWNER nexos_icp ENCODING 'UTF8' LOCALE 'C.UTF-8' TEMPLATE template0;
GRANT CONNECT ON DATABASE nexos_icp TO nexos_icp;
GRANT USAGE ON SCHEMA public TO nexos_icp;
GRANT CREATE ON SCHEMA public TO nexos_icp;
SQL
  echo "✓ Database and user created"
fi

# Create app.env if needed
if ! $envexists; then
  echo ""
  echo "Creating app.env..."

  # URL-encode password for PostgreSQL connection string
  db_password_encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$db_password'''))")

  cat > "$config/app.env" <<ENV
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://nexos_icp:${db_password_encoded}@postgresql_17:5432/nexos_icp?schema=public
JWT_SECRET=${jwt_secret}
CORS_ORIGIN=https://nexos.chorstconsult.com.br
FRONTEND_URL=https://nexos.chorstconsult.com.br
API_URL=https://nexos.chorstconsult.com.br
MASTER_EMAILS=chorstconsult@gmail.com
DISABLE_STARTUP_WRITES=true
UPLOADS_DIR=/app/apps/api/uploads
EDITAIS_ATTACHMENTS_DIR=/app/apps/attachments/editais
ENV

  chmod 600 "$config/app.env"
  echo "✓ app.env created (mode 600)"
fi

# Git SSH setup
echo ""
echo "GitHub SSH Setup:"
ssh_key="$config/deploy_key"
if [[ -f "$ssh_key" ]]; then
  echo "  ✓ SSH key already exists"
else
  echo -n "  Generate new SSH key for GitHub? (y/n): "
  read -r generate_ssh || generate_ssh=n
  if [[ $generate_ssh == y ]]; then
    ssh-keygen -t ed25519 -f "$ssh_key" -N "" -C "nexos-icp-deploy@$(hostname)"
    chmod 600 "$ssh_key" "$ssh_key.pub"
    echo ""
    echo "  Public key (add to GitHub Deploy Keys):"
    sed 's/^/    /' "$ssh_key.pub"
    echo ""
    echo "  → Go to: https://github.com/Chorst09/crmnexointegrator_v2/settings/keys"
    echo "  → Click 'Add deploy key' and paste the public key above"
  fi
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. If prompted above, add the SSH public key to GitHub Deploy Keys"
echo "  2. Run the deployment script:"
echo "     cd /opt/nexos-icp-github"
echo "     bash deploy/icp/deploy.sh"
echo ""
echo "  Or copy this to execute remotely:"
echo "     ssh root@209.50.241.25 'bash /opt/nexos-icp-config/deploy.sh'"
echo ""
