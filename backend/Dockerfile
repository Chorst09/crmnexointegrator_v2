FROM node:20-alpine

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache openssl

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências de produção
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# A imagem de produção deve usar as variáveis injetadas pelo Docker Compose.
# Arquivos .env locais podem sobrescrever DATABASE_URL durante comandos Prisma.
RUN rm -f .env .env.production

# Gerar Prisma Client
RUN npx prisma generate

# Criar diretório de uploads
RUN mkdir -p uploads logs

# Expor porta
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# Aplicar apenas ajustes aditivos conhecidos; migrations destrutivas ficam fora do boot.
CMD ["sh", "-c", "node prisma/ensure-schema.cjs && node server.js"]
