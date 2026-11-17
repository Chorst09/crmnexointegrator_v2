#!/usr/bin/env bash

# deploy.sh – Quick deployment script
# Usage: ./deploy.sh "Commit message" "domain.com"
#   $1 – Commit message (default: "Deploy $(date +'%%Y-%%m-%%d %%H:%%M:%%S')")
#   $2 – Target domain (overrides PROD_DOMAIN secret, default: empty)

set -euo pipefail

# Default values
DEFAULT_MSG="Deploy $(date '+%Y-%m-%d %H:%M:%S')"
COMMIT_MSG="${1:-$DEFAULT_MSG}"
DOMAIN_OVERRIDE="${2:-}" 

# Show summary
echo "--- Deploy script starting ---"
echo "Commit message: $COMMIT_MSG"
if [[ -n "$DOMAIN_OVERRIDE" ]]; then
  echo "Domain override: $DOMAIN_OVERRIDE"
else
  echo "No domain override (will use PROD_DOMAIN secret)"
fi

# Stage changes
git add .
# Check if there are changes to commit
if git diff --cached --quiet; then
  echo "No changes to commit. Skipping commit step."
else
  git commit -m "$COMMIT_MSG"
fi

# Push to remote (current branch)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push origin "$CURRENT_BRANCH"

# Trigger GitHub Actions workflow (optional, GitHub automatically runs on push)
# If you want to manually dispatch:
if [[ -n "$DOMAIN_OVERRIDE" ]]; then
  echo "Dispatching workflow with domain override..."
  gh run watch --repo "${GITHUB_REPOSITORY}" --branch "$CURRENT_BRANCH" --json "{\"domain\":\"$DOMAIN_OVERRIDE\"}"
else
  echo "Push completed – workflow will run automatically."
fi

echo "--- Deploy script finished ---"
