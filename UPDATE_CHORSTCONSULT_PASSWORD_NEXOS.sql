-- Atualizar senha do usuário chorstconsult@gmail.com no nexos
-- Senha: admin123
-- Hash: $2b$10$lTKAs0VqeitQZRE5/t5ZtuLnZ83pcXURoJAmtBgB/zUlqaa4BnvTw.

UPDATE users 
SET 
  password = '$2b$10$lTKAs0VqeitQZRE5/t5ZtuLnZ83pcXURoJAmtBgB/zUlqaa4BnvTw.',
  role = 'MASTER',
  company_id = NULL,
  active = 1,
  accessB2B = 1,
  accessB2G = 1,
  accessPreSales = 1,
  quota = 999999
WHERE email = 'chorstconsult@gmail.com';

-- Verificar atualização
SELECT 
  id,
  email,
  name,
  role,
  company_id,
  active,
  accessB2B,
  accessB2G,
  accessPreSales,
  quota,
  substr(password, 1, 20) || '...' as password_hash_preview
FROM users 
WHERE email = 'chorstconsult@gmail.com';
