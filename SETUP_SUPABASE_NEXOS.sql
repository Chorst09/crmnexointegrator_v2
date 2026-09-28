-- ============================================
-- SETUP COMPLETO DO SUPABASE NEXOS
-- PostgreSQL Database
-- ============================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'SELLER',
  company_id UUID,
  region_id UUID,
  quota DECIMAL(10,2),
  "accessB2B" BOOLEAN DEFAULT true,
  "accessB2G" BOOLEAN DEFAULT true,
  "accessPreSales" BOOLEAN DEFAULT false,
  "permissionOverrides" JSONB DEFAULT '{}',
  "isCompanyOwner" BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- TABELA: companies
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  document VARCHAR(50),
  segment VARCHAR(100),
  "clientType" VARCHAR(50) DEFAULT 'B2B',
  size VARCHAR(50),
  website VARCHAR(255),
  logo TEXT,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  country VARCHAR(100) DEFAULT 'Brasil',
  region_id UUID,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  "leadScore" INTEGER DEFAULT 0,
  "churnRisk" DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_companies_region ON companies(region_id);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

-- ============================================
-- TABELA: contacts
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  position VARCHAR(100),
  "isPrimary" BOOLEAN DEFAULT false,
  company_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);

-- ============================================
-- TABELA: products
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(10,2) NOT NULL,
  margin DECIMAL(5,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ============================================
-- TABELA: opportunities
-- ============================================
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  "projectName" VARCHAR(255),
  "projectClientType" VARCHAR(50),
  description TEXT,
  value DECIMAL(10,2) NOT NULL,
  probability INTEGER DEFAULT 50,
  stage VARCHAR(50) NOT NULL,
  "b2gStage" VARCHAR(50),
  source VARCHAR(50),
  "expectedCloseDate" TIMESTAMP,
  "actualCloseDate" TIMESTAMP,
  "lossReason" TEXT,
  company_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_opportunities_company ON opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_b2gStage ON opportunities("b2gStage");

-- ============================================
-- TABELA: regions
-- ============================================
CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  country VARCHAR(100) DEFAULT 'Brasil',
  state VARCHAR(50),
  city VARCHAR(100),
  "isActive" BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_regions_code ON regions(code);
CREATE INDEX IF NOT EXISTS idx_regions_active ON regions("isActive");

-- ============================================
-- TABELA: tenant_companies (Licenciamento)
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  "legalName" VARCHAR(255),
  cnpj VARCHAR(20) UNIQUE,
  email VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'PROSPECT',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_companies_status ON tenant_companies(status);
CREATE INDEX IF NOT EXISTS idx_tenant_companies_cnpj ON tenant_companies(cnpj);

-- ============================================
-- INSERIR USUÁRIO MASTER PADRÃO
-- ============================================
INSERT INTO users (
  email,
  name,
  password,
  role,
  company_id,
  active,
  "accessB2B",
  "accessB2G",
  "accessPreSales"
) VALUES (
  'master@master.com',
  'Master User',
  '$2b$10$lTKAs0VqeitQZRE5/t5ZtuLnZ83pcXURoJAmtBgB/zUlqaa4BnvTw.',
  'MASTER',
  NULL,
  true,
  true,
  true,
  true
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- VERIFICAR USUÁRIO CRIADO
-- ============================================
SELECT id, name, email, role, active FROM users WHERE email = 'master@master.com';

-- ============================================
-- FIM DO SCRIPT
-- ============================================
