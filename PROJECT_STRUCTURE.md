# 🏗️ Estrutura do Projeto CRM Comercial

## 📁 Nova Estrutura Organizada

```
crm-comercial/
├── 📁 frontend/                    # React + Vite Frontend
│   ├── 📁 public/
│   ├── 📁 src/
│   │   ├── 📁 components/         # Componentes reutilizáveis
│   │   ├── 📁 pages/             # Páginas da aplicação
│   │   ├── 📁 layout/            # Layout components
│   │   ├── 📁 hooks/             # Custom hooks
│   │   ├── 📁 services/          # API services
│   │   ├── 📁 utils/             # Utilitários
│   │   └── 📁 types/             # TypeScript types
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env.example
│
├── 📁 backend/                     # Node.js + Express Backend
│   ├── 📁 src/
│   │   ├── 📁 controllers/       # Controladores da API
│   │   ├── 📁 middleware/        # Middlewares
│   │   ├── 📁 routes/            # Rotas da API
│   │   ├── 📁 services/          # Lógica de negócio
│   │   ├── 📁 utils/             # Utilitários
│   │   ├── 📁 config/            # Configurações
│   │   └── 📁 types/             # TypeScript types
│   ├── 📁 prisma/                # Schema e migrações
│   │   ├── 📁 migrations/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── package.json
│   ├── server.js
│   └── .env.example
│
├── 📁 database/                    # Configurações de banco
│   ├── 📁 neon/                  # Configuração Neon PostgreSQL
│   │   ├── schema.sql
│   │   ├── seed.sql
│   │   └── migrations/
│   └── 📁 shared/                # Scripts compartilhados
│       ├── migrate.js
│       └── seed-data.js
│
├── 📁 docs/                       # Documentação
│   ├── API.md
│   ├── DEPLOYMENT.md
│   ├── DATABASE.md
│   └── DEVELOPMENT.md
│
├── 📁 scripts/                    # Scripts de automação
│   ├── setup.sh
│   ├── deploy-frontend.sh
│   ├── deploy-backend.sh
│   └── migrate-db.sh
│
├── docker-compose.yml             # Docker para desenvolvimento
├── .gitignore
├── README.md
└── package.json                   # Scripts raiz
```

## 🎯 Benefícios da Nova Estrutura

### **1. Separação Clara**
- Frontend e Backend completamente independentes
- Cada um com suas próprias dependências e configurações
- Deploy independente de cada parte

### **2. Multi-Database Support**
- Configuração para Neon PostgreSQL (produção)
- Configuração para SQLite local
- Scripts de migração compartilhados
- Seed data unificado

### **3. Escalabilidade**
- Estrutura preparada para crescimento
- Fácil adição de novos serviços
- Configuração para diferentes ambientes

### **4. Developer Experience**
- Scripts automatizados para setup
- Documentação completa
- Docker para desenvolvimento local
- Hot reload em desenvolvimento
