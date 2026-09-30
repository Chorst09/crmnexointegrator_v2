# 🚀 NexosCRM - Sistema de CRM Completo

Sistema de CRM moderno e completo com módulos B2B, B2G e Pré-Vendas, desenvolvido com React, Netlify Functions e Supabase.

## ✨ Funcionalidades

### 📊 Módulo B2B (Business to Business)
- Gestão de clientes e empresas
- Funil de vendas e oportunidades
- Gestão de atividades e follow-ups
- Propostas comerciais e técnicas
- Contratos e pós-venda
- Dashboard e relatórios
- Comissionamento

### 🏛️ Módulo B2G (Business to Government)
- Monitoramento de editais e licitações
- Análise de Termos de Referência com IA
- Gestão de documentação
- Histórico de análises
- Acompanhamento de processos

### 💡 Módulo Pré-Vendas
- Solicitações de orçamento
- Precificação inteligente
- Fluxo de aprovação
- Cálculo de margem e custos
- Múltiplos regimes tributários

### 🔧 Funcionalidades Avançadas
- Sistema de permissões granular (RBAC)
- Multi-tenancy (múltiplas empresas)
- Licenciamento e assinaturas
- Integrações com ERPs
- Workflows automatizados
- Notificações multi-canal

## 🏗️ Arquitetura

### Stack Tecnológico

**Frontend:**
- React 18
- Vite
- TailwindCSS
- React Router
- Axios
- Chart.js

**Backend:**
- Netlify Functions (Serverless)
- Prisma ORM
- PostgreSQL (Supabase)
- JWT Authentication
- bcrypt

**Infraestrutura:**
- Netlify (Hosting + Functions)
- Supabase (Database)
- Git (Version Control)

### Estrutura do Projeto

```
nexoscrm/
├── apps/
│   └── web/                    # Frontend React
│       ├── src/
│       │   ├── components/     # Componentes reutilizáveis
│       │   ├── pages/          # Páginas da aplicação
│       │   ├── layout/         # Layouts
│       │   ├── config/         # Configurações
│       │   └── utils/          # Utilitários
│       ├── public/             # Arquivos estáticos
│       └── dist/               # Build de produção
│
├── backend/                    # API Express
│   ├── api/                    # Rotas HTTP
│   ├── lib/                    # Bibliotecas compartilhadas
│   ├── prisma/                 # Schema do banco
│   └── server.js               # Servidor
│
├── package.json                # Dependências raiz
└── README.md                   # Este arquivo
```

## 🚀 Deploy

### Deploy em Servidor

1. Configure as variáveis de ambiente.
2. Rode migrations e gere o Prisma Client.
3. Execute `./deploy-servidor.sh`.

## 💻 Desenvolvimento Local

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- PostgreSQL

### Instalação

```bash
# 1. Clonar repositório
git clone https://github.com/seu-usuario/nexoscrm.git
cd nexoscrm

# 2. Instalar dependências
npm install
cd apps/web && npm install && cd ../..
cd backend && npm install && cd ..

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# 4. Rodar migrations
npm run prisma:generate
npm run prisma:migrate

# 5. Iniciar desenvolvimento
npm run dev
```

### Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia frontend + API
npm run dev:web          # Apenas frontend
npm run dev:api          # Apenas API

# Build
npm run build            # Build do frontend
npm run build:web        # Build do frontend

# Prisma
npm run prisma:generate  # Gerar Prisma Client
npm run prisma:migrate   # Rodar migrations
npm run prisma:studio    # Abrir Prisma Studio

# Instalação
npm run install:all      # Instalar todas as dependências
```

## 🔐 Variáveis de Ambiente

### Desenvolvimento (.env)

```env
# Database (Supabase)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# JWT
JWT_SECRET=seu-segredo-jwt

# Auth
AUTH_MASTER_KEY=codigo-recuperacao
MASTER_EMAILS=admin@exemplo.com

# Environment
NODE_ENV=development
```

### Produção (Netlify)

Configure as mesmas variáveis no painel do Netlify:
**Site settings** → **Environment variables**

## 📚 Documentação

- [Guia de Deploy](./DEPLOY_NETLIFY_SUPABASE.md) - Deploy completo no Netlify + Supabase
- [Guia de Migração de APIs](./MIGRACAO_APIS.md) - Como migrar APIs para Netlify Functions
- [Documentação da API](#) - Em breve
- [Guia do Usuário](#) - Em breve

## 🔧 Migração de APIs

O projeto está em processo de migração do Express para Netlify Functions.

**Status:**
- ✅ Autenticação (auth)
- ✅ Health Check
- ✅ Clientes (clients)
- 🔄 Em andamento: Oportunidades, Produtos, Propostas
- ⏳ Pendente: Demais módulos

## 🧪 Testes

```bash
# Testar health check
curl https://seu-dominio.com/health

# Testar autenticação
curl -X POST https://seu-dominio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@exemplo.com","password":"senha123"}'
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

- 📧 Email: suporte@nexoscrm.com
- 💬 Discord: [Link do Discord](#)
- 📖 Documentação: [docs.nexoscrm.com](#)
- 🐛 Issues: [GitHub Issues](https://github.com/seu-usuario/nexoscrm/issues)

## 🎯 Roadmap

### Q1 2024
- [x] Migração para backend Express + PostgreSQL
- [x] Módulo de autenticação
- [x] APIs consolidadas no backend
- [ ] Testes automatizados

### Q2 2024
- [ ] App mobile (React Native)
- [ ] Integrações com WhatsApp Business
- [ ] Dashboard avançado com BI
- [ ] Relatórios customizáveis

### Q3 2024
- [ ] IA para análise de propostas
- [ ] Chatbot integrado
- [ ] Automações avançadas
- [ ] API pública para parceiros

## 👥 Time

- **Desenvolvedor Principal**: [Seu Nome]
- **Contribuidores**: [Lista de contribuidores]

## 🙏 Agradecimentos

- [Prisma](https://prisma.io) - ORM
- [React](https://react.dev) - Framework Frontend
- [TailwindCSS](https://tailwindcss.com) - CSS Framework

---

⭐ Se este projeto foi útil para você, considere dar uma estrela no GitHub!

**Feito com ❤️ por [Seu Nome]**
