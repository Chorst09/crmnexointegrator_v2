-- Criar novo usuário MASTER no banco PostgreSQL do Nexos
-- Email: master@master.com
-- Senha: admin123
-- Hash: $2b$10$lTKAs0VqeitQZRE5/t5ZtuLnZ83pcXURoJAmtBgB/zUlqaa4BnvTw.

INSERT INTO users (
  id,
  name,
  email,
  password,
  role,
  active,
  created_at,
  updated_at,
  company_id,
  accessB2B,
  accessB2G,
  accessPreSales,
  quota
) VALUES (
  lower(hex(randomblob(16))),
  'Master User',
  'master@master.com',
  '$2b$10$lTKAs0VqeitQZRE5/t5ZtuLnZ83pcXURoJAmtBgB/zUlqaa4BnvTw.',
  'MASTER',
  1,
  datetime('now'),
  datetime('now'),
  NULL,
  1,
  1,
  1,
  999999
);

-- Verificar se foi criado
SELECT id, name, email, role, company_id, active 
FROM users 
WHERE email = 'master@master.com';
