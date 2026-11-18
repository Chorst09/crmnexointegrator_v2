#!/usr/bin/env bash
# --------------------------------------------------------------
# Deploy rápido – Nexos v2
# Uso: ./deploy.sh "Mensagem do commit" nexosv2.cnorstconsult.com.br
# --------------------------------------------------------------

set -euo pipefail

# ----- Parâmetros ------------------------------------------------
COMMIT_MSG="${1:-\"Deploy automático $(date +'%Y-%m-%d %H:%M')\"}"
TARGET_DOMAIN="${2:-\"nexosv2.cnorstconsult.com.br\"}"

# ----- Verificar alterações locais --------------------------------
if ! git diff-index --quiet HEAD --; then
  echo "⚠️  Há mudanças não commitadas. Abortando."
  exit 1
fi

# ----- Commit ----------------------------------------------------
echo "🗂️  Adicionando arquivos ao commit…"
git add .

if git diff --cached --quiet; then
  echo "🔎 Nenhuma alteração a ser commitada. Pulando commit."
else
  echo "✍️  Commitando: $COMMIT_MSG"
  git commit -m "$COMMIT_MSG"
fi

# ----- Push ------------------------------------------------------
echo "🚀 Enviando para o remote…"
git push origin HEAD

# ----- Disparar workflow manual (opcional) -----------------------
if [[ -n "$TARGET_DOMAIN" ]]; then
  echo "⚡ Disparando workflow manual para o domínio $TARGET_DOMAIN …"
  gh workflow run deploy.yml -f domain="$TARGET_DOMAIN"
fi

# ----- Acompanhar logs (opcional) -------------------------------
echo "📺 Aguardando logs do workflow…"
gh run watch --exit-status
