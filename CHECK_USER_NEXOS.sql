-- Verificar se o usuário MASTER existe
SELECT 
  id, 
  name, 
  email, 
  role, 
  active,
  "accessB2B",
  "accessB2G",
  "accessPreSales",
  company_id,
  created_at
FROM users 
WHERE email = 'master@master.com';

-- Se não existir, criar novamente
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
) ON CONFLICT (email) DO UPDATE SET
  role = 'MASTER',
  active = true,
  company_id = NULL,
  password = '$2b$10$lTKAs0VqeitQZRE5/t5ZtuLnZ83pcXURoJAmtBgB/zUlqaa4BnvTw.'
RETURNING id, name, email, role, active;
