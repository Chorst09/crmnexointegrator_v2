#!/usr/bin/env bash
# Execute this on your local machine to set up the VPS
# It will copy setup-initial.sh and execute it remotely
# Usage: bash SETUP_REMOTE.sh <vps_ip> [vps_user]

VPS_IP="${1:-209.50.241.25}"
VPS_USER="${2:-root}"
VPS_PORT="${3:-22}"

set -Eeuo pipefail

echo "Connecting to VPS setup..."
echo "  VPS: $VPS_USER@$VPS_IP:$VPS_PORT"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy setup script to VPS
scp -P "$VPS_PORT" "$SCRIPT_DIR/setup-initial.sh" "$VPS_USER@$VPS_IP:/tmp/setup-nexos-icp.sh"

# Execute on VPS
ssh -p "$VPS_PORT" "$VPS_USER@$VPS_IP" 'bash /tmp/setup-nexos-icp.sh'

# Clean up
ssh -p "$VPS_PORT" "$VPS_USER@$VPS_IP" 'rm -f /tmp/setup-nexos-icp.sh'

echo "✓ Setup complete. VPS is ready for deployment."
