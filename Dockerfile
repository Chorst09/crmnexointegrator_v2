# Multi-stage Dockerfile para NEXOS CRM
# Build: Frontend (Vite) + Backend (Node.js)
# Runtime: Express server servindo frontend estático + API

# ===== STAGE 1: Build Frontend (Vite) =====
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Copiar package.json root e workspace
COPY package.json package-lock.json* ./
COPY apps/web/package*.json ./apps/web/

# Instalar dependências do frontend
RUN npm ci --workspace=apps/web

# Copiar código do frontend
COPY apps/web ./apps/web

# Build Vite
RUN npm run build --workspace=apps/web

# ===== STAGE 2: Build Backend + Prisma =====
FROM node:20-alpine AS backend-builder

WORKDIR /build

# Instalar dependências de build necessárias
RUN apk add --no-cache openssl python3 make g++

# Copiar package.json root e backend
COPY package.json package-lock.json* ./
COPY backend/package*.json ./backend/
COPY apps/api/package*.json ./apps/api/

# Instalar dependências do backend (production only)
RUN npm ci --only=production --workspace=backend

# Copiar schema Prisma e gerar cliente
COPY backend/prisma ./backend/prisma
COPY apps/api/prisma ./apps/api/prisma

RUN cd backend && npx prisma generate

# ===== STAGE 3: Runtime =====
FROM node:20-alpine

LABEL maintainer="Carlos Horst <chorstconsult@gmail.com>"
LABEL description="NEXOS CRM - Commercial API and Frontend"
LABEL version="1.0.0"

# Variáveis de build (documentação)
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=1.0.0

ENV NODE_ENV=production \
    NODE_PATH=/app/node_modules \
    PORT=3026 \
    PATH="/app/node_modules/.bin:$PATH"

WORKDIR /app

# Instalar apenas runtime essencial
RUN apk add --no-cache openssl curl dumb-init

# Criar usuário não-root (opcional, para maior segurança)
# RUN addgroup -g 1000 appuser && adduser -D -u 1000 -G appuser appuser

# Copiar node_modules e código do backend (Stage 2)
COPY --from=backend-builder /build/backend/node_modules ./node_modules
COPY --from=backend-builder /build/backend ./backend

# Copiar aplicação API (apps/api)
COPY apps/api/api ./apps/api/api
COPY apps/api/lib ./apps/api/lib
COPY apps/api/data ./apps/api/data
COPY apps/api/public ./apps/api/public
COPY apps/api/prisma ./apps/api/prisma

# Copiar frontend build (Stage 1) para ser servido estaticamente
COPY --from=frontend-builder /build/apps/web/dist ./apps/web/dist

# Criar diretórios de runtime
RUN mkdir -p uploads logs && chmod 755 uploads logs

# Health check (sem autenticação requerida)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3026/health || exit 1

# Usar dumb-init para gerenciar sinais corretamente
ENTRYPOINT ["/sbin/dumb-init", "--"]

# Comando de inicialização
CMD ["node", "backend/server.js"]

# Expor porta
EXPOSE 3026
