FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependências
COPY package*.json ./
RUN npm ci

# Copiar código fonte
COPY . .

# Build args para variáveis de ambiente
ARG VITE_API_URL=http://209.50.241.25/api
ENV VITE_API_URL=$VITE_API_URL

# Build de produção
RUN npm run build

# Imagem final - apenas os arquivos estáticos
FROM nginx:alpine

# Copiar build
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuração do nginx para SPA (React Router)
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
